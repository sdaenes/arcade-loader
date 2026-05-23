const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');
const { optimizeLoading } = require('./optimizer');

const openai = new OpenAI();

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
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nom de borne requis.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY non configurée sur le serveur.' });
  }
  try {
    const msg = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 512,
      messages: [{
        role: 'system',
        content: "Tu es un expert en bornes d'arcade. Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans texte autour).",
      }, {
        role: 'user',
        content: `Pour la borne d'arcade "${name.trim()}", fournis ses dimensions physiques typiques et son poids au format JSON exact :
{"width": <largeur en mètres>, "height": <hauteur en mètres>, "depth": <profondeur en mètres>, "weight": <poids en kg>, "notes": "<courte description en français>"}
Si tu ne connais pas cette borne précisément, fournis des estimations typiques et indique-le dans notes.`,
      }],
    });

    const raw = msg.choices[0].message.content.trim();
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
