const express = require('express');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { optimizeLoading } = require('./optimizer');

const anthropic = new Anthropic();

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
  const { name, deep = false } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nom de borne requis.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY non configurée sur le serveur.' });
  }
  try {
    const promptSimple = `Tu es un expert en bornes d'arcade. Pour la borne "${name.trim()}", fournis ses dimensions physiques typiques et son poids.
Réponds UNIQUEMENT avec un objet JSON valide (sans markdown) au format exact suivant :
{"width": <largeur en mètres>, "height": <hauteur en mètres>, "depth": <profondeur en mètres>, "weight": <poids en kg>, "notes": "<courte description en français>"}
Si tu ne connais pas cette borne précisément, fournis des estimations typiques pour une borne de ce type et indique-le dans notes.`;

    const promptDeep = `Tu es un expert en bornes d'arcade. Effectue une recherche approfondie sur la borne "${name.trim()}".
Raisonne étape par étape :
1. Identifie le fabricant exact et le nom complet du modèle
2. Note les variantes existantes (version originale, mini, cocktail, deluxe, etc.) et précise laquelle tu décris
3. Donne les dimensions extérieures précises (largeur, hauteur, profondeur) en mètres avec au moins 2 décimales
4. Estime le poids en kg (avec accessoires standards : joystick, boutons, écran)
5. Indique ton niveau de confiance : ÉLEVÉ (specs officielles connues), MOYEN (très proche d'une source connue), FAIBLE (estimation)

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown) au format exact :
{"width": <m>, "height": <m>, "depth": <m>, "weight": <kg>, "notes": "<fabricant, modèle exact, variante décrite, niveau de confiance et source si connue>"}`;

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
