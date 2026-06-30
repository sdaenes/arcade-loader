const express = require('express');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { optimizeLoading } = require('./optimizer');

const anthropic = new Anthropic();

const KNOWN_SOURCES = require('./knownSources.json');

async function fetchKnownSources() {
  const results = await Promise.allSettled(
    KNOWN_SOURCES.map(async (s) => {
      const res = await fetch(s.url, {
        headers: { 'User-Agent': 'ArcadeLoader/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${s.url}`);
      const html = await res.text();
      const text = html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ').trim()
        .slice(0, 15000);
      return { name: s.name, url: s.url, text };
    })
  );
  return results
    .filter(r => r.status === 'fulfilled' && r.value.text.length > 100)
    .map(r => r.value);
}

async function askClaudeFromSources(name, sources) {
  if (sources.length === 0) return null;

  // Ne passer à l'API que les sources qui mentionnent le nom de la borne
  const nameLower = name.toLowerCase();
  const relevant = sources.filter(s => s.text.toLowerCase().includes(nameLower));
  if (relevant.length === 0) return null;

  const sourcesText = relevant
    .map(s => `=== ${s.name} ===\n${s.text}`)
    .join('\n\n');

  const prompt = `Tu es un expert en bornes d'arcade.

Cherche la borne "${name}" dans les textes suivants et retourne ses dimensions physiques.

RÈGLE ABSOLUE : Lis le LABEL associé à chaque valeur dans la source (ex: "W", "D", "H", "Width", "Depth", "Height", "Largeur", "Longueur", "Hauteur", "Profondeur") et associe chaque valeur au bon champ JSON selon ce label — jamais selon l'ordre des chiffres.

Correspondances :
- width  ← W / Width / Largeur
- height ← H / Height / Hauteur
- depth  ← D / Depth / Longueur / Profondeur

RÈGLE ABSOLUE : Ne retourne JAMAIS des dimensions inventées ou estimées. Si la borne "${name}" n'est pas explicitement mentionnée dans ces textes avec ses dimensions, retourne found: false.

${sourcesText}

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown) :
{"found": true/false, "width": <en mètres ou null>, "height": <en mètres ou null>, "depth": <en mètres ou null>, "weight": <poids en kg ou null>, "category": "<type ou null>", "notes": "<source utilisée ou null>"}`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content.find(b => b.type === 'text')?.text?.trim() || '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let data;
  try { data = JSON.parse(jsonMatch[0]); } catch { return null; }
  if (!data.found) return null;
  return data;
}

async function askClaudeDeep(name, lang, signal) {
  const isEn = lang === 'en';
  const prompt = isEn
    ? `You are an arcade cabinet expert with extensive knowledge of manufacturers' technical specifications.

For the arcade cabinet "${name}", return its exact physical dimensions and weight from your training knowledge.

CRITICAL RULES:
- Return ONLY dimensions you are certain about from known manufacturer specifications.
- Read the label associated with each dimension (W/Width, D/Depth, H/Height) and assign correctly — never by numeric order.
- If you are not certain of the exact dimensions, return null for that field. Never estimate or invent values.

Reply ONLY with valid JSON (no markdown):
{"width": <meters or null>, "height": <meters or null>, "depth": <meters or null>, "weight": <kg or null>, "category": "<cabinet type or null>", "notes": "<manufacturer and source>"}`
    : `Tu es un expert en bornes d'arcade avec une connaissance approfondie des spécifications techniques des fabricants.

Pour la borne d'arcade "${name}", retourne ses dimensions physiques exactes et son poids depuis tes connaissances d'entraînement.

RÈGLES ABSOLUES :
- Retourne UNIQUEMENT des dimensions dont tu es certain d'après les spécifications fabricant connues.
- Lis le label associé à chaque dimension (L/Largeur, P/Profondeur, H/Hauteur) et assigne correctement — jamais selon l'ordre des chiffres.
- Si tu n'es pas certain des dimensions exactes, retourne null pour ce champ. Ne jamais estimer ni inventer.

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown) :
{"width": <mètres ou null>, "height": <mètres ou null>, "depth": <mètres ou null>, "weight": <kg ou null>, "category": "<type de borne ou null>", "notes": "<fabricant et source>"}`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  }, { signal });

  const raw = msg.content.find(b => b.type === 'text')?.text?.trim() || '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try { return JSON.parse(jsonMatch[0]); } catch { return null; }
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

// Garde contre les appels simultanés pour la même borne
const inProgress = new Set();

app.post('/api/search-cabinet', async (req, res) => {
  const { name, deep = false, categories = [], lang = 'fr' } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nom de borne requis.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY non configurée sur le serveur.' });
  }

  const key = `${name.trim().toLowerCase()}|${lang}|${deep}`;
  if (inProgress.has(key)) {
    return res.status(429).json({ error: 'Recherche déjà en cours pour cette borne.' });
  }

  // Abort controller lié à la déconnexion du client
  const abort = new AbortController();
  req.on('close', () => abort.abort());

  inProgress.add(key);
  try {
    // Étape 1 : sources connues
    const sources = await fetchKnownSources();
    let data = await askClaudeFromSources(name.trim(), sources);

    // Étape 2 : uniquement en mode approfondi, si étape 1 n'a rien trouvé
    if (!data && deep) {
      data = await askClaudeDeep(name.trim(), lang, abort.signal);
    }

    // Si rien trouvé : retourner null sans halluciner
    if (!data) {
      return res.json({
        width: null, height: null, depth: null, weight: null,
        category: null, suggestedNewCategory: null, notes: '',
      });
    }

    // Correspondance catégorie
    const catList = categories.length > 0 ? categories : null;
    let category = typeof data.category === 'string' && data.category !== 'null' ? data.category : null;
    let suggestedNewCategory = null;
    if (category && catList) {
      const match = catList.find(c => c.toLowerCase() === category.toLowerCase());
      if (!match) {
        suggestedNewCategory = category;
        category = null;
      } else {
        category = match;
      }
    }

    res.json({
      width:  typeof data.width  === 'number' ? Math.round(data.width  * 100) / 100 : null,
      height: typeof data.height === 'number' ? Math.round(data.height * 100) / 100 : null,
      depth:  typeof data.depth  === 'number' ? Math.round(data.depth  * 100) / 100 : null,
      weight: typeof data.weight === 'number' ? Math.round(data.weight) : null,
      category,
      suggestedNewCategory,
      notes: typeof data.notes === 'string' ? data.notes : '',
    });
  } catch (err) {
    if (!res.headersSent) {
      console.error('search-cabinet error:', err.message);
      res.status(500).json({ error: err.message || 'Erreur lors de la recherche.' });
    }
  } finally {
    inProgress.delete(key);
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
