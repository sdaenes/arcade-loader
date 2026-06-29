# Design — Refonte de la recherche de dimensions de bornes

**Date :** 2026-06-29
**Statut :** Approuvé

## Problème actuel

L'approche existante recherche des pages individuelles sur ArcadeOtaku et Wikipedia, puis demande à Claude d'extraire les dimensions. Claude hallucine des dimensions quand aucune source fiable n'est trouvée, et extrait incorrectement même quand une source est trouvée. Les sources fiables sont des **pages de listes** (ArcadeOtaku candy list, Wikipedia Japanese arcade cabinets) que l'approche actuelle ne consulte pas.

## Nouveau flux de recherche

```
searchCabinet(name)
  │
  ├─ Étape 1 : Sources connues (parallèle)
  │   ├─ Fetch knownSources.json → fetcher chaque URL
  │   └─ Claude Haiku extrait les dimensions si la borne est dans la liste
  │
  └─ Si non trouvé → Étape 2 : Recherche web du manuel
       └─ Claude Opus + outil web_search → trouve le manuel → extrait dimensions
           └─ Si toujours pas trouvé → retourne null pour toutes les dimensions
```

**Règle anti-hallucination :** Claude ne retourne jamais de dimensions inventées. Si aucune source n'en contient, `width`/`height`/`depth`/`weight` sont `null`.

## Sources connues

Fichier `backend/src/knownSources.json` — liste initiale :

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

Ce fichier est modifiable sans toucher au code. Les URLs supplémentaires découvertes lors de recherches peuvent y être ajoutées manuellement.

## Architecture backend

### Nouveaux fichiers / modifications

| Fichier | Action |
|---|---|
| `backend/src/knownSources.json` | Créer — liste des URLs sources |
| `backend/src/index.js` | Modifier — réécrire la route `/api/search-cabinet` |

### Suppression

- Fonctions `searchArcadeOtaku()` et `searchWikipedia()` supprimées (recherche sur pages individuelles)
- Le prompt qui demandait à Claude de deviner ("utilise tes connaissances") est supprimé

### Étape 1 — Sources connues

```js
async function fetchKnownSources() {
  const sources = require('./knownSources.json');
  const results = await Promise.allSettled(
    sources.map(s => fetch(s.url, { headers: {'User-Agent': 'ArcadeLoader/1.0'}, signal: AbortSignal.timeout(8000) })
      .then(r => r.text())
      .then(html => ({ name: s.name, url: s.url, text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 15000) }))
    )
  );
  return results.filter(r => r.status === 'fulfilled').map(r => r.value);
}
```

Appel à Claude Haiku avec les textes :

```js
async function askClaudeFromSources(name, sources) {
  // Prompt strict : "found: true/false + dimensions si trouvées, null sinon"
  // Modèle : claude-haiku-4-5 (extraction mécanique, pas de raisonnement)
  // Pas d'outils, pas de thinking
}
```

### Étape 2 — Recherche web du manuel

```js
async function askClaudeWebSearch(name, lang) {
  // Modèle : claude-opus-4-8 + tool web_search_20260209
  // thinking: { type: "adaptive" }
  // Prompt : cherche le manuel technique ou fiche produit officielle de "[name]"
  // et extrais width/height/depth/weight. Retourne null si non trouvé.
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    tools: [{ type: 'web_search_20260209', name: 'web_search' }],
    messages: [{ role: 'user', content: prompt }],
  });
  // Extraire le JSON de la réponse texte finale
}
```

### Format de retour (inchangé)

```json
{
  "width": 0.65,
  "height": 1.75,
  "depth": 0.75,
  "weight": 120,
  "category": "Upright",
  "suggestedNewCategory": null,
  "notes": "... Source dimensions : ArcadeOtaku — List of Upright Cabinets."
}
```

Si aucune dimension trouvée : `"width": null, "height": null, "depth": null, "weight": null`.

## Frontend — Aucun changement

Les boutons "Recherche rapide" et "Analyse approfondie" restent :
- **Rapide** : Étape 1 uniquement (sources connues, modèle léger)
- **Approfondie** : Étapes 1 + 2 (sources connues + recherche web manuel)

## Ce qui est supprimé

- Recherche ArcadeOtaku sur pages individuelles
- Recherche Wikipedia sur pages individuelles  
- Le fallback "utilise tes connaissances" dans le prompt Claude
- Le paramètre `deep` qui activait le mode `thinking: adaptive` (maintenant toujours utilisé en étape 2)
