# Design — Améliorations du Placement Manuel

**Date :** 2026-06-29
**Statut :** Approuvé

## Objectif

Deux améliorations indépendantes de l'onglet Manuel :
1. **Save/load placement** — sauvegarder et rappeler des configurations de placement manuel nommées, indépendamment des sessions complètes.
2. **Orientation du contenant** — basculer la vue canvas d'un camion entre portrait et paysage (swap width/depth).

---

## Feature 1 — Save/Load du placement manuel

### Structure de données

Placements sauvegardés stockés dans `localStorage` sous la clé `al_manual_sessions` (tableau) :

```json
{
  "id": "1719660000000-0",
  "name": "Plan Lyon",
  "savedAt": "2026-06-29T14:32:00Z",
  "data": {
    "truck1": [
      { "id": "mp_abc", "cabId": "cab1", "name": "Borne Standard", "color": "#00f5ff",
        "x": 0.2, "z": 0.5, "width": 0.65, "height": 1.75, "depth": 0.75, "rotation": 0 }
    ],
    "truck2": []
  }
}
```

`data` est l'objet `allPlacements` entier (tous les camions). Même format que `al_sessions` (session complète), avec une clé localStorage distincte.

L'auto-sauvegarde avant chargement utilise le nom `"Auto — DD/MM HH:MM"`.

### UI

Section **"Placements sauvegardés"** ajoutée dans la sidebar de ManualEditor, entre la section "Camions" et la section "Bornes" :

```
PLACEMENTS SAUVEGARDÉS
[ 💾 Sauvegarder ]
[ 📂 Charger ]
```

**Modal Sauvegarder :** input texte pré-rempli avec date courante, bouton Valider (désactivé si vide) et Annuler. Fermeture par clic overlay.

**Modal Charger :** liste des placements en ordre inverse (plus récent d'abord), bouton Charger + icône ✕ par entrée. Auto-sauvegarde silencieuse de l'état courant avant chargement. Message "Aucun placement sauvegardé" si liste vide.

### Architecture

**Nouveau fichier `frontend/src/components/placementSessions.js`** — data layer pur (même structure que `sessions.js`) avec la clé `al_manual_sessions` :
- `loadPlacementSessions(): PlacementSession[]`
- `savePlacementSession(name: string, data: AllPlacements): PlacementSession`
- `deletePlacementSession(id: string): void`

**Nouveau fichier `frontend/src/components/PlacementManager.js`** — composant React :
- Props : `allPlacements: object`, `onLoad: (data: AllPlacements) => void`
- Gère les 2 boutons et les modals
- L'auto-sauvegarde est dans `PlacementManager` (contrairement à `SessionManager` où elle est dans App.js — ici `allPlacements` est disponible directement en props)

**Nouveau fichier `frontend/src/components/PlacementManager.module.css`** — styles identiques à `SessionManager.module.css`.

**Modification `frontend/src/components/ManualEditor.js`** — intégration de `<PlacementManager>` dans la sidebar.

---

## Feature 2 — Orientation du contenant

### Comportement

Un bouton `[🔄]` apparaît à droite du nom de chaque camion dans la sidebar. Il bascule ce camion entre :
- **Portrait** (défaut) : canvas affiche `truck.width` horizontal × `truck.depth` vertical
- **Paysage** : canvas affiche `truck.depth` horizontal × `truck.width` vertical

En mode paysage :
- Les coordonnées stockées (`p.x`, `p.z`) ne changent pas — c'est uniquement la vue qui est swappée
- Les contraintes de placement (`clamp` dans `handleMouseDown` et `handleMouseMove`) utilisent les dimensions effectives
- Le label de dimensions dans le canvas affiche les valeurs dans l'ordre swappé
- Le ghost de prévisualisation utilise les dimensions effectives

L'orientation n'est pas persistée (état local React) — elle se réinitialise à la navigation.

### État

```js
const [orientations, setOrientations] = useState({}); // { [truckId]: true } pour landscape
```

Fonction helper dans ManualEditor (à l'intérieur du composant, après `useState`) :
```js
function effectiveTruck(tr) {
  return orientations[tr.id]
    ? { ...tr, width: tr.depth, depth: tr.width }
    : tr;
}
```

Partout dans le composant où `truck` est utilisé dans les calculs de dessin et de placement, on utilise `effectiveTruck(truck)` à la place. Les fonctions standalone `getScale`, `toCanvas`, `fromCanvas` n'ont pas besoin d'être modifiées — elles reçoivent le camion (avec dimensions effectives) en paramètre.

### Modifications dans `ManualEditor.js`

À chaque endroit où `truck` est passé à `getScale()` ou utilisé pour calculer des dimensions/contraintes :
- `draw()` → `const eTruck = effectiveTruck(truck);` en début de fonction, remplacer `truck.width`/`truck.depth` par `eTruck.width`/`eTruck.depth`
- `hitTest()` → `const eTruck = effectiveTruck(truck);`
- `handleMouseDown()` → `const eTruck = effectiveTruck(truck);`, clamp avec `eTruck.width`/`eTruck.depth`
- `handleMouseMove()` → `const eTruck = effectiveTruck(truck);`, clamp avec `eTruck.width`/`eTruck.depth`
- `getScale()` appelé avec `eTruck` partout

Le bouton `[🔄]` dans la liste des camions :
```jsx
<button onClick={() => setOrientations(prev => ({ ...prev, [tr.id]: !prev[tr.id] }))}>
  🔄
</button>
```

---

## Ce qui n'est pas inclus

- L'export JSON/CSV du placement manuel existant n'est pas modifié
- L'orientation n'est pas persistée dans les placements sauvegardés
- Pas de renommage des placements sauvegardés après création
