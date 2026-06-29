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

  const sourcesText = sources
    .map(s => `=== ${s.name} ===\n${s.text}`)
    .join('\n\n');

  const prompt = `Tu es un expert en bornes d'arcade.

Cherche la borne "${name}" dans les textes suivants et retourne ses dimensions EXACTEMENT telles qu'indiquées dans le texte.

RÈGLE ABSOLUE : Ne retourne JAMAIS des dimensions inventées ou estimées. Si la borne "${name}" n'est pas explicitement mentionnée dans ces textes avec ses dimensions, retourne found: false.

${sourcesText}

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown) :
{"found": true/false, "width": <largeur en mètres ou null>, "height": <hauteur en mètres ou null>, "depth": <profondeur en mètres ou null>, "weight": <poids en kg ou null>, "category": "<type ou null>", "notes": "<source utilisée ou null>"}`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content.find(b => b.type === 'text')?.text?.trim() || '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const data = JSON.parse(jsonMatch[0]);
  if (!data.found) return null;
  return data;
}

async function askClaudeWebSearch(name, lang) {
  const isEn = lang === 'en';
  const prompt = isEn
    ? `Search for the technical manual or official product sheet of the arcade cabinet "${name}". Find the exact physical dimensions (width, height, depth in meters) and weight (in kg). Extract them from a reliable source such as a manufacturer manual or official spec sheet.

ABSOLUTE RULE: If you cannot find reliable dimensions from an actual source, return null for all dimension fields. Never invent or estimate dimensions.

Reply ONLY with valid JSON (no markdown):
{"width": <meters or null>, "height": <meters or null>, "depth": <meters or null>, "weight": <kg or null>, "category": "<cabinet type or null>", "notes": "<source URL and brief description>"}`
    : `Cherche le manuel technique ou la fiche produit officielle de la borne d'arcade "${name}". Trouve les dimensions physiques exactes (largeur, hauteur, profondeur en mètres) et le poids (en kg). Extrais-les depuis une source fiable : manuel fabricant, fiche technique officielle.

RÈGLE ABSOLUE : Si tu ne trouves pas de dimensions fiables depuis une vraie source, retourne null pour tous les champs de dimensions. Ne jamais inventer ni estimer.

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown) :
{"width": <mètres ou null>, "height": <mètres ou null>, "depth": <mètres ou null>, "weight": <kg ou null>, "category": "<type de borne ou null>", "notes": "<URL source et description courte>"}`;

  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    tools: [{ type: 'web_search_20260209', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }],
  });

  // Prendre le dernier bloc texte (après les appels d'outils)
  const textBlocks = msg.content.filter(b => b.type === 'text');
  const raw = textBlocks[textBlocks.length - 1]?.text?.trim() || '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  return JSON.parse(jsonMatch[0]);
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
    // Étape 1 : sources connues
    const sources = await fetchKnownSources();
    let data = await askClaudeFromSources(name.trim(), sources);

    // Étape 2 : recherche web du manuel (mode approfondi ou fallback non trouvé)
    if (!data && deep) {
      data = await askClaudeWebSearch(name.trim(), lang);
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
    console.error('search-cabinet error:', err.message);
    res.status(500).json({ error: err.message || 'Erreur lors de la recherche.' });
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
