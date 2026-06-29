# Cabinet Search Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la recherche de dimensions des bornes d'arcade par un flux en deux étapes : (1) pages de listes connues, (2) recherche web du manuel via Claude Opus + outil web_search — sans aucune hallucination.

**Architecture:** `knownSources.json` contient la liste des URLs sources. `fetchKnownSources()` fetche ces pages en parallèle. `askClaudeFromSources()` (Claude Haiku) extrait les dimensions si la borne y est trouvée. En fallback, `askClaudeWebSearch()` (Claude Opus + web_search_20260209) cherche le manuel en ligne. Si rien n'est trouvé, toutes les dimensions sont `null`.

**Tech Stack:** Node.js 18+, Express, `@anthropic-ai/sdk` ^0.98.0, outils serveur Anthropic (`web_search_20260209`)

## Global Constraints

- Modèle Haiku : `claude-haiku-4-5-20251001` (extraction mécanique depuis texte)
- Modèle Opus : `claude-opus-4-8` (recherche web autonome)
- Outil web search : `{ type: 'web_search_20260209', name: 'web_search' }` — serveur Anthropic, pas de boucle d'outil côté client
- Règle anti-hallucination : si aucune source ne contient de dimensions chiffrées, retourner `null` pour `width`, `height`, `depth`, `weight` — jamais d'estimation
- Les fonctions `searchArcadeOtaku`, `searchWikipedia`, `extractWikiParam` sont supprimées
- Format de retour du endpoint inchangé : `{ width, height, depth, weight, category, suggestedNewCategory, notes }`
- Projet dans `/Users/sebastiendaenes/Desktop/Développement/arcade-loader/`

---

## Fichiers créés / modifiés

| Fichier | Action | Rôle |
|---|---|---|
| `backend/src/knownSources.json` | Créer | Liste des URLs de listes connues |
| `backend/src/index.js` | Modifier | Remplacer les anciennes fonctions et le handler par le nouveau flux |

---

## Task 1: knownSources.json + fetchKnownSources()

**Files:**
- Create: `backend/src/knownSources.json`
- Modify: `backend/src/index.js` (ajouter require + fonction, supprimer anciennes fonctions)

**Interfaces:**
- Produces: `fetchKnownSources(): Promise<{name: string, url: string, text: string}[]>`

- [ ] **Étape 1 : Créer `backend/src/knownSources.json`**

```json
[
  {
    "name": "ArcadeOtaku — List of Candy Cabinets",
    "url": "https://wiki.arcadeotaku.com/w/List_of_Candy_Cabinets"
  },
  {
    "name": "ArcadeOtaku — List of Upright Cabinets",
    "url": "https://wiki.arcadeotaku.com/w/List_of_Upright_Cabinets"
  },
  {
    "name": "Wikipedia — List of Japanese arcade cabinets",
    "url": "https://en.wikipedia.org/wiki/List_of_Japanese_arcade_cabinets"
  },
  {
    "name": "Wikipedia — List of North American arcade cabinets",
    "url": "https://en.wikipedia.org/wiki/List_of_North_American_arcade_video_game_cabinets"
  }
]
```

- [ ] **Étape 2 : Dans `backend/src/index.js`, supprimer les 3 anciennes fonctions et remplacer le bloc de code**

Supprimer entièrement ces fonctions (lignes 9–92 environ dans le fichier actuel) :
- `extractWikiParam(wikitext, paramNames)`
- `searchArcadeOtaku(name)`
- `searchWikipedia(name)`

Puis, juste après la ligne `const anthropic = new Anthropic();`, ajouter :

```js
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
```

- [ ] **Étape 3 : Vérifier que le serveur démarre sans erreur**

```bash
cd /Users/sebastiendaenes/Desktop/Développement/arcade-loader/backend && node src/index.js &
sleep 2
curl -s http://localhost:3001/health
kill %1
```

Résultat attendu : `{"status":"ok","version":"1.0.0"}`

- [ ] **Étape 4 : Commit**

```bash
git add backend/src/knownSources.json backend/src/index.js
git commit -m "feat: known sources list + fetchKnownSources — remove old search functions"
```

---

## Task 2: askClaudeFromSources() + askClaudeWebSearch()

**Files:**
- Modify: `backend/src/index.js` (ajouter les 2 fonctions Claude)

**Interfaces:**
- Consumes: `fetchKnownSources()` depuis Task 1
- Produces:
  - `askClaudeFromSources(name: string, sources: {name,url,text}[]): Promise<ResultData|null>`
  - `askClaudeWebSearch(name: string, lang: string): Promise<ResultData|null>`
  - `ResultData = { found?, width, height, depth, weight, category, notes, source }`

- [ ] **Étape 1 : Ajouter `askClaudeFromSources()` dans `backend/src/index.js`**

Ajouter après la fonction `fetchKnownSources()` :

```js
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
```

- [ ] **Étape 2 : Ajouter `askClaudeWebSearch()` dans `backend/src/index.js`**

Ajouter après `askClaudeFromSources()` :

```js
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
```

- [ ] **Étape 3 : Vérifier que le serveur démarre sans erreur de syntaxe**

```bash
cd /Users/sebastiendaenes/Desktop/Développement/arcade-loader/backend && node -e "require('./src/index.js')" 2>&1 | head -5 &
sleep 2
kill %1 2>/dev/null; echo "OK"
```

Résultat attendu : le processus démarre sans `SyntaxError`.

- [ ] **Étape 4 : Commit**

```bash
git add backend/src/index.js
git commit -m "feat: askClaudeFromSources (Haiku) + askClaudeWebSearch (Opus + web_search)"
```

---

## Task 3: Réécriture du handler `/api/search-cabinet`

**Files:**
- Modify: `backend/src/index.js` (remplacer le handler existant)

**Interfaces:**
- Consumes:
  - `fetchKnownSources(): Promise<Source[]>`
  - `askClaudeFromSources(name, sources): Promise<ResultData|null>`
  - `askClaudeWebSearch(name, lang): Promise<ResultData|null>`
- Endpoint : `POST /api/search-cabinet` — body : `{ name, deep, categories, lang }` — réponse : `{ width, height, depth, weight, category, suggestedNewCategory, notes }`

- [ ] **Étape 1 : Remplacer le handler `/api/search-cabinet` dans `backend/src/index.js`**

Localiser le handler existant qui commence par :
```js
app.post('/api/search-cabinet', async (req, res) => {
```
et se termine par sa fermeture `});`.

Le remplacer entièrement par :

```js
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
```

- [ ] **Étape 2 : Lancer le serveur backend**

```bash
cd /Users/sebastiendaenes/Desktop/Développement/arcade-loader/backend && node src/index.js &
sleep 3
```

- [ ] **Étape 3 : Test — borne dans une source connue (Astro City)**

```bash
curl -s -X POST http://localhost:3001/api/search-cabinet \
  -H "Content-Type: application/json" \
  -d '{"name": "Astro City", "deep": false, "lang": "fr"}' | jq .
```

Résultat attendu : `width`, `height`, `depth` non-null (l'Astro City est dans la liste candy d'ArcadeOtaku). Vérifier que les valeurs correspondent aux dimensions réelles (~0.72×1.80×0.72 m).

- [ ] **Étape 4 : Test — borne inconnue sans mode approfondi**

```bash
curl -s -X POST http://localhost:3001/api/search-cabinet \
  -H "Content-Type: application/json" \
  -d '{"name": "BorneInexistante99999", "deep": false, "lang": "fr"}' | jq .
```

Résultat attendu : `{"width": null, "height": null, "depth": null, "weight": null, "category": null, "suggestedNewCategory": null, "notes": ""}` — pas d'hallucination.

- [ ] **Étape 5 : Test — mode approfondi (recherche web)**

```bash
curl -s -X POST http://localhost:3001/api/search-cabinet \
  -H "Content-Type: application/json" \
  -d '{"name": "Vewlix Diamond", "deep": true, "lang": "fr"}' | jq .
```

Résultat attendu : width/height/depth non-null si le manuel est trouvé en ligne, null sinon — jamais de valeurs inventées.

- [ ] **Étape 6 : Arrêter le serveur et committer**

```bash
kill %1 2>/dev/null
git add backend/src/index.js
git commit -m "feat: rewrite search-cabinet handler — sources connues + web search fallback, no hallucination"
```
