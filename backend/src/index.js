const express = require('express');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { optimizeLoading } = require('./optimizer');

const anthropic = new Anthropic();

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
  const { name, deep = false, categories = [] } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nom de borne requis.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY non configurée sur le serveur.' });
  }
  try {
    const wikiData = await searchWikipedia(name.trim());
    const wikiContext = wikiData
      ? `Voici le contenu Wikipedia pour "${wikiData.title}" (${wikiData.lang === 'fr' ? 'Wikipedia FR' : 'Wikipedia EN'}) :\n\n${wikiData.text}\n\n`
      : '';
    const wikiNote = wikiData ? `Source : ${wikiData.lang === 'fr' ? 'Wikipedia FR' : 'Wikipedia EN'} (${wikiData.title})` : 'Source : connaissances de Claude (aucune page Wikipedia trouvée)';

    const catList = categories.length > 0 ? categories.join(', ') : null;
    const catInstruction = catList
      ? `Catégories disponibles : ${catList}. Choisis la plus appropriée. Si aucune ne convient, mets la meilleure approximation dans "category" ET le nom suggéré dans "suggestedNewCategory".`
      : 'Aucune catégorie définie. Laisse "category" à null et "suggestedNewCategory" à null.';

    const jsonFormat = `{"width": <m>, "height": <m>, "depth": <m>, "weight": <kg>, "category": "<catégorie ou null>", "suggestedNewCategory": <null ou "nom suggéré">, "notes": "<description>"}`;

    const promptSimple = `${wikiContext}Extrais les dimensions physiques extérieures et le poids de la borne d'arcade "${name.trim()}".
${catInstruction}
Réponds UNIQUEMENT avec un objet JSON valide (sans markdown) :
${jsonFormat}
Dans "notes" : ${wikiNote}.`;

    const promptDeep = `${wikiContext}Analyse approfondie de la borne d'arcade "${name.trim()}".
${wikiData ? 'Le texte Wikipedia ci-dessus contient les données de référence — utilise-les en priorité.' : 'Aucune source Wikipedia trouvée — utilise tes connaissances.'}
Raisonne étape par étape :
1. Identifie fabricant, modèle exact et variante (originale, mini, cocktail, deluxe…)
2. Extrais les dimensions extérieures précises (largeur, hauteur, profondeur) en mètres
3. Note le poids avec accessoires standards
4. Indique niveau de confiance : ÉLEVÉ (source directe), MOYEN (source proche), FAIBLE (estimation)
5. ${catInstruction}

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown) :
${jsonFormat}
Dans "notes" : fabricant, variante, niveau de confiance, ${wikiNote}.`;

    const requestParams = {
      model: 'claude-opus-4-7',
      max_tokens: deep ? 4096 : 1024,
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
