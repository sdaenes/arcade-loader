const express = require('express');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { optimizeLoading } = require('./optimizer');

const anthropic = new Anthropic();

function extractWikiParam(wikitext, paramNames) {
  for (const param of paramNames) {
    const regex = new RegExp('\\|\\s*' + param + '\\s*=\\s*([^\\n|{}]+)', 'i');
    const match = wikitext.match(regex);
    if (match) return match[1].trim();
  }
  return null;
}

async function searchArcadeOtaku(name) {
  try {
    const base = 'https://wiki.arcadeotaku.com/api.php';
    const searchRes = await fetch(
      `${base}?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&srlimit=2`,
      { headers: { 'User-Agent': 'ArcadeLoader/1.0' }, signal: AbortSignal.timeout(5000) }
    );
    const searchData = await searchRes.json();
    const hits = searchData?.query?.search || [];
    if (hits.length === 0) return null;

    const title = hits[0].title;
    const [wikitextRes, extractRes] = await Promise.all([
      fetch(
        `${base}?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}&format=json`,
        { headers: { 'User-Agent': 'ArcadeLoader/1.0' }, signal: AbortSignal.timeout(5000) }
      ),
      fetch(
        `${base}?action=query&prop=extracts&titles=${encodeURIComponent(title)}&format=json&exlimit=1&exchars=3000`,
        { headers: { 'User-Agent': 'ArcadeLoader/1.0' }, signal: AbortSignal.timeout(5000) }
      ),
    ]);
    const [wikitextData, extractData] = await Promise.all([wikitextRes.json(), extractRes.json()]);

    const wtPage = Object.values(wikitextData?.query?.pages || {})[0];
    const wikitext = wtPage?.revisions?.[0]?.slots?.main?.['*'] || '';
    const dimRaw = extractWikiParam(wikitext, ['dimensions', 'dimension', 'dim', 'size']);
    const weightRaw = extractWikiParam(wikitext, ['weight', 'masse', 'poids']);

    const exPage = Object.values(extractData?.query?.pages || {})[0];
    const text = exPage?.extract
      ? exPage.extract
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
          .slice(0, 2000)
      : '';

    if (!text && !dimRaw) return null;
    return { title, text, dimRaw, weightRaw };
  } catch (_) { return null; }
}

async function searchWikipedia(name) {
  for (const lang of ['fr', 'en']) {
    try {
      const base = `https://${lang}.wikipedia.org/w/api.php`;
      const query = `${name} arcade borne cabinet`;
      const searchRes = await fetch(
        `${base}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=2`,
        { headers: { 'User-Agent': 'ArcadeLoader/1.0' }, signal: AbortSignal.timeout(6000) }
      );
      const searchData = await searchRes.json();
      const hits = searchData?.query?.search || [];
      if (hits.length === 0) continue;

      const title = hits[0].title;
      const extractRes = await fetch(
        `${base}?action=query&prop=extracts&titles=${encodeURIComponent(title)}&format=json&exlimit=1&exchars=6000`,
        { headers: { 'User-Agent': 'ArcadeLoader/1.0' }, signal: AbortSignal.timeout(6000) }
      );
      const extractData = await extractRes.json();
      const pages = extractData?.query?.pages || {};
      const page = Object.values(pages)[0];
      if (!page?.extract || page.extract.length < 100) continue;

      const text = page.extract
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ').trim();
      return { lang, title, text };
    } catch (_) { /* try next language */ }
  }
  return null;
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve React build in production
const frontendBuild = path.join(__dirname, '../../frontend/build');
app.use(express.static(frontendBuild));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.post('/api/optimize', (req, res) => {
  try {
    const { cabinets, trucks, errorMargin = 5 } = req.body;
    if (!cabinets || !Array.isArray(cabinets) || cabinets.length === 0) {
      return res.status(400).json({ error: 'Au moins une borne est requise.' });
    }
    if (!trucks || !Array.isArray(trucks) || trucks.length === 0) {
      return res.status(400).json({ error: 'Au moins un camion est requis.' });
    }
    const result = optimizeLoading(cabinets, trucks, errorMargin);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erreur interne du serveur' });
  }
});

app.post('/api/search-cabinet', async (req, res) => {
  const { name, deep = false, categories = [], lang = 'fr' } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nom de borne requis.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY non configurée sur le serveur.' });
  }
  try {
    const [wikiData, otakuData] = await Promise.all([
      searchWikipedia(name.trim()),
      searchArcadeOtaku(name.trim()),
    ]);

    const catList = categories.length > 0 ? categories.join(', ') : null;
    const catInstruction = catList
      ? `Catégories disponibles : ${catList}. Choisis la plus appropriée. Si aucune ne convient, mets ta meilleure approximation dans "category" ET le nom suggéré dans "suggestedNewCategory".`
      : 'Aucune catégorie définie. Laisse "category" et "suggestedNewCategory" à null.';

    const jsonFormat = `{"width": <m>, "height": <m>, "depth": <m>, "weight": <kg>, "category": "<catégorie ou null>", "suggestedNewCategory": <null ou "nom suggéré">, "notes": "<description>"}`;

    const buildSourcesBlock = () => {
      const parts = [];
      if (otakuData) {
        let section = `=== ARCADE OTAKU (source prioritaire) ===\nPage : "${otakuData.title}"`;
        if (otakuData.dimRaw) section += `\nDimensions : ${otakuData.dimRaw}`;
        if (otakuData.weightRaw) section += `\nPoids : ${otakuData.weightRaw}`;
        if (otakuData.text) section += `\n\n${otakuData.text}`;
        parts.push(section);
      }
      if (wikiData) parts.push(`=== WIKIPEDIA ${wikiData.lang.toUpperCase()} ===\nPage : "${wikiData.title}"\n${wikiData.text}`);
      return parts.length > 0
        ? `[SOURCES DISPONIBLES]\n\n${parts.join('\n\n')}\n\n`
        : '[AUCUNE SOURCE EXTERNE TROUVÉE — utilise tes connaissances]\n\n';
    };

    const sourcesBlock = buildSourcesBlock();

    const dimSourceLabel = otakuData?.dimRaw
      ? `Arcade Otaku — "${otakuData.title}"`
      : wikiData
      ? `Wikipedia ${wikiData.lang.toUpperCase()} — "${wikiData.title}"`
      : 'estimation Claude';

    const dimsRule = otakuData?.dimRaw
      ? `DIMENSIONS & POIDS (PRIORITÉ ABSOLUE) : Arcade Otaku indique dimensions="${otakuData.dimRaw}"${otakuData.weightRaw ? ` et poids="${otakuData.weightRaw}"` : ''}. Convertis en mètres/kg et affecte correctement width/height/depth selon ta connaissance du modèle.`
      : wikiData
      ? 'DIMENSIONS & POIDS : Extrais depuis Wikipedia si disponibles, sinon utilise tes connaissances.'
      : 'DIMENSIONS & POIDS : Utilise tes connaissances.';

    const notesLangRule = lang === 'en'
      ? `NOTES: 5-10 lines max. Include: manufacturer, year, type, key features, notable variants. End with: "Dimension source: ${dimSourceLabel}."`
      : lang === 'ja'
      ? `NOTES（日本語で記述）：5〜10行以内。メーカー、年、タイプ、主な特徴、主要なバリアントを含めること。最後に「寸法ソース：${dimSourceLabel}」と記載すること。`
      : `NOTES : 5 à 10 lignes maximum. Mentionne fabricant, année, type, caractéristiques principales, variantes notables. Termine obligatoirement par : "Source dimensions : ${dimSourceLabel}."`;

    const commonInstructions = `Tu es un expert en bornes d'arcade. Pour la borne "${name.trim()}" :

RÈGLES :
- ${notesLangRule}
- CATÉGORIE : ${catInstruction}
- ${dimsRule}

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown) :
${jsonFormat}`;

    const promptSimple = `${sourcesBlock}${commonInstructions}`;

    const promptDeep = `${sourcesBlock}${commonInstructions}

Raisonne étape par étape :
1. Identifie fabricant, modèle exact, année, variantes
2. Vérifie les dimensions dans chaque source disponible et retiens les plus fiables
3. Indique le niveau de confiance : ÉLEVÉ / MOYEN / FAIBLE`;

    const requestParams = {
      model: 'claude-opus-4-7',
      max_tokens: deep ? 2048 : 768,
      messages: [{ role: 'user', content: deep ? promptDeep : promptSimple }],
    };
    if (deep) requestParams.thinking = { type: 'adaptive' };

    const msg = await anthropic.messages.create(requestParams);

    const textBlock = msg.content.find(b => b.type === 'text');
    const raw = textBlock ? textBlock.text.trim() : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Format JSON invalide dans la réponse.');
    const data = JSON.parse(jsonMatch[0]);

    const result = {
      width:  typeof data.width  === 'number' ? Math.round(data.width  * 100) / 100 : null,
      height: typeof data.height === 'number' ? Math.round(data.height * 100) / 100 : null,
      depth:  typeof data.depth  === 'number' ? Math.round(data.depth  * 100) / 100 : null,
      weight: typeof data.weight === 'number' ? Math.round(data.weight) : null,
      category: typeof data.category === 'string' && data.category !== 'null' ? data.category : null,
      suggestedNewCategory: typeof data.suggestedNewCategory === 'string' && data.suggestedNewCategory !== 'null' ? data.suggestedNewCategory : null,
      notes:  typeof data.notes  === 'string' ? data.notes : '',
    };
    res.json(result);
  } catch (err) {
    console.error('search-cabinet error:', err.message);
    res.status(500).json({ error: err.message || 'Erreur lors de la recherche Claude.' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(frontendBuild, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).json({ message: 'ArcadeLoader API running. Frontend not built yet.' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`🎮 Arcade Loader running on port ${PORT}`);
});
