# Manual Placement Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le save/load nommé des placements manuels dans la sidebar de ManualEditor, et un bouton de bascule d'orientation (portrait/paysage) par camion dans le canvas.

**Architecture:** Un data layer `placementSessions.js` (analogue à `sessions.js`) gère la persistance localStorage. Un composant `PlacementManager.js` expose l'UI save/load. `ManualEditor.js` est modifié pour intégrer `PlacementManager` et pour le toggle d'orientation via un `useMemo` `effectiveTruck`.

**Tech Stack:** React 18, CSS Modules (variables CSS globales `--panel`, `--border`, `--text`, `--neon`), Jest (via react-scripts)

## Global Constraints

- Nouvelle clé localStorage : `al_manual_sessions` — ne pas toucher `al_cabinets`, `al_trucks`, `al_margin`, `al_manual`, `al_sessions`
- Pas de `window.prompt` ni `window.confirm` — modals React inline uniquement
- CSS Modules avec variables globales `var(--panel)`, `var(--border)`, `var(--text-dim)`, `var(--text)`, `var(--neon)`, `var(--neon4)`, `var(--mono)`
- Feature 2 : les coordonnées stockées (`p.x`, `p.z`) ne changent PAS avec l'orientation — seul le rendu est swappé
- Projet dans `/Users/sebastiendaenes/Desktop/Développement/arcade-loader/`

---

## Fichiers créés / modifiés

| Fichier | Action | Rôle |
|---|---|---|
| `frontend/src/components/placementSessions.js` | Créer | Data layer : load/save/delete placements dans `al_manual_sessions` |
| `frontend/src/components/__tests__/placementSessions.test.js` | Créer | Tests unitaires du data layer |
| `frontend/src/components/PlacementManager.js` | Créer | Composant React : boutons Save/Load + modals |
| `frontend/src/components/PlacementManager.module.css` | Créer | Styles du composant (variables CSS globales) |
| `frontend/src/components/ManualEditor.js` | Modifier | Intégrer PlacementManager + ajouter toggle orientation |

---

## Task 1: Data layer — `placementSessions.js`

**Files:**
- Create: `frontend/src/components/placementSessions.js`
- Test: `frontend/src/components/__tests__/placementSessions.test.js`

**Interfaces:**
- Produces:
  - `loadPlacementSessions(): PlacementSession[]`
  - `savePlacementSession(name: string, data: AllPlacements): PlacementSession`
  - `deletePlacementSession(id: string): void`

Types :
```js
// AllPlacements = { [truckId: string]: Placement[] }
// Placement = { id, cabId, name, color, x, z, width, height, depth, rotation }
// PlacementSession = { id: string, name: string, savedAt: string, data: AllPlacements }
```

- [ ] **Étape 1 : Écrire les tests**

Créer `frontend/src/components/__tests__/placementSessions.test.js` :

```js
import {
  loadPlacementSessions,
  savePlacementSession,
  deletePlacementSession,
} from '../placementSessions';

const MOCK_DATA = {
  truck1: [{ id: 'mp_1', cabId: 'c1', name: 'Borne', color: '#00f5ff', x: 0.2, z: 0.5, width: 0.65, height: 1.75, depth: 0.75, rotation: 0 }],
  truck2: [],
};

beforeEach(() => { localStorage.clear(); });

test('loadPlacementSessions returns empty array when nothing saved', () => {
  expect(loadPlacementSessions()).toEqual([]);
});

test('savePlacementSession persists and returns the session', () => {
  const s = savePlacementSession('Plan Lyon', MOCK_DATA);
  expect(s.name).toBe('Plan Lyon');
  expect(s.id).toBeDefined();
  expect(s.savedAt).toBeDefined();
  expect(s.data).toEqual(MOCK_DATA);
  const sessions = loadPlacementSessions();
  expect(sessions).toHaveLength(1);
  expect(sessions[0].name).toBe('Plan Lyon');
});

test('savePlacementSession appends to existing sessions', () => {
  savePlacementSession('A', MOCK_DATA);
  savePlacementSession('B', MOCK_DATA);
  expect(loadPlacementSessions()).toHaveLength(2);
});

test('deletePlacementSession removes the correct session', () => {
  const s1 = savePlacementSession('A', MOCK_DATA);
  const s2 = savePlacementSession('B', MOCK_DATA);
  deletePlacementSession(s1.id);
  const remaining = loadPlacementSessions();
  expect(remaining).toHaveLength(1);
  expect(remaining[0].id).toBe(s2.id);
});

test('deletePlacementSession with unknown id does nothing', () => {
  savePlacementSession('A', MOCK_DATA);
  deletePlacementSession('nonexistent');
  expect(loadPlacementSessions()).toHaveLength(1);
});
```

- [ ] **Étape 2 : Vérifier que les tests échouent**

```bash
cd /Users/sebastiendaenes/Desktop/Développement/arcade-loader/frontend && npm test -- --testPathPattern=placementSessions.test --watchAll=false
```

Résultat attendu : `FAIL` avec `Cannot find module '../placementSessions'`

- [ ] **Étape 3 : Implémenter `placementSessions.js`**

Créer `frontend/src/components/placementSessions.js` :

```js
const LS_KEY = 'al_manual_sessions';
let sessionCounter = 0;

export function loadPlacementSessions() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(sessions) {
  localStorage.setItem(LS_KEY, JSON.stringify(sessions));
}

export function savePlacementSession(name, data) {
  const session = {
    id: `${Date.now()}-${sessionCounter++}`,
    name,
    savedAt: new Date().toISOString(),
    data,
  };
  const sessions = loadPlacementSessions();
  sessions.push(session);
  persist(sessions);
  return session;
}

export function deletePlacementSession(id) {
  persist(loadPlacementSessions().filter(s => s.id !== id));
}
```

- [ ] **Étape 4 : Vérifier que les tests passent**

```bash
cd /Users/sebastiendaenes/Desktop/Développement/arcade-loader/frontend && npm test -- --testPathPattern=placementSessions.test --watchAll=false
```

Résultat attendu : `PASS` — 5 tests

- [ ] **Étape 5 : Commit**

```bash
git add frontend/src/components/placementSessions.js frontend/src/components/__tests__/placementSessions.test.js
git commit -m "feat: placement sessions data layer"
```

---

## Task 2: Composant `PlacementManager`

**Files:**
- Create: `frontend/src/components/PlacementManager.js`
- Create: `frontend/src/components/PlacementManager.module.css`

**Interfaces:**
- Consumes (depuis Task 1): `loadPlacementSessions`, `savePlacementSession`, `deletePlacementSession`
- Props reçues:
  - `allPlacements: AllPlacements` — état courant de tous les placements
  - `onLoad: (data: AllPlacements) => void` — appelé avec les données de la session chargée

- [ ] **Étape 1 : Créer `PlacementManager.module.css`**

Créer `frontend/src/components/PlacementManager.module.css` :

```css
.section {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.title {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-dim);
  font-weight: 700;
  margin-bottom: 0.3rem;
}

.btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 0.75rem;
  padding: 0.35rem 0.6rem;
  border-radius: 4px;
  text-align: left;
  transition: all 0.15s;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.btn:hover { color: var(--neon); border-color: var(--neon); }

/* Modal */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  min-width: 300px;
  max-width: 440px;
  width: 90%;
}

.modalTitle {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.85rem;
}

.input {
  width: 100%;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: rgba(255,255,255,0.04);
  color: var(--text);
  font-size: 0.82rem;
  box-sizing: border-box;
  margin-bottom: 0.85rem;
}

.modalButtons {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
}

.btnPrimary {
  padding: 0.4rem 0.9rem;
  border: none;
  border-radius: 4px;
  background: #3a7bd5;
  color: #fff;
  font-size: 0.78rem;
  cursor: pointer;
}

.btnPrimary:hover { background: #2e6abf; }

.btnPrimary:disabled {
  background: #2a4a7f;
  opacity: 0.5;
  cursor: not-allowed;
}

.btnSecondary {
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--text-dim);
  font-size: 0.78rem;
  cursor: pointer;
}

.btnSecondary:hover { background: rgba(255,255,255,0.05); }

.sessionList {
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: 0.75rem;
}

.sessionItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  margin-bottom: 0.35rem;
  background: rgba(255,255,255,0.02);
}

.sessionName {
  font-size: 0.82rem;
  color: var(--text);
  font-weight: 500;
}

.sessionDate {
  font-size: 0.68rem;
  color: var(--text-dim);
  margin-top: 0.1rem;
}

.sessionActions {
  display: flex;
  gap: 0.35rem;
}

.btnLoad {
  padding: 0.25rem 0.55rem;
  border: 1px solid #3a7bd5;
  border-radius: 3px;
  background: transparent;
  color: #3a7bd5;
  font-size: 0.7rem;
  cursor: pointer;
}

.btnLoad:hover { background: rgba(58,123,213,0.12); }

.btnDelete {
  padding: 0.25rem 0.45rem;
  border: 1px solid #c0392b;
  border-radius: 3px;
  background: transparent;
  color: #c0392b;
  font-size: 0.7rem;
  cursor: pointer;
}

.btnDelete:hover { background: rgba(192,57,43,0.12); }

.emptyState {
  text-align: center;
  color: var(--text-dim);
  font-size: 0.78rem;
  padding: 1.25rem 0;
  opacity: 0.6;
}
```

- [ ] **Étape 2 : Créer `PlacementManager.js`**

Créer `frontend/src/components/PlacementManager.js` :

```js
import React, { useState } from 'react';
import styles from './PlacementManager.module.css';
import {
  loadPlacementSessions,
  savePlacementSession,
  deletePlacementSession,
} from './placementSessions';

function formatDate(isoString) {
  const d = new Date(isoString);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatNow() {
  const d = new Date();
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function PlacementManager({ allPlacements, onLoad }) {
  const [modal, setModal] = useState(null); // 'save' | 'load' | null
  const [saveName, setSaveName] = useState('');
  const [sessions, setSessions] = useState([]);

  function openSave() {
    setSaveName(formatNow());
    setModal('save');
  }

  function openLoad() {
    setSessions(loadPlacementSessions());
    setModal('load');
  }

  function handleSave() {
    if (!saveName.trim()) return;
    savePlacementSession(saveName.trim(), allPlacements);
    setModal(null);
  }

  function handleLoad(session) {
    savePlacementSession(`Auto — ${formatNow()}`, allPlacements);
    onLoad(session.data);
    setModal(null);
  }

  function handleDelete(id) {
    deletePlacementSession(id);
    setSessions(loadPlacementSessions());
  }

  return (
    <div className={styles.section}>
      <div className={styles.title}>Placements sauvegardés</div>
      <button className={styles.btn} onClick={openSave}>💾 Sauvegarder</button>
      <button className={styles.btn} onClick={openLoad}>📂 Charger</button>

      {modal === 'save' && (
        <div className={styles.overlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Nommer le placement</div>
            <input
              className={styles.input}
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
              placeholder="Ex : Plan Lyon juin"
            />
            <div className={styles.modalButtons}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={handleSave} disabled={!saveName.trim()}>Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'load' && (
        <div className={styles.overlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Charger un placement</div>
            <div className={styles.sessionList}>
              {sessions.length === 0 ? (
                <div className={styles.emptyState}>Aucun placement sauvegardé</div>
              ) : (
                sessions.slice().reverse().map(s => (
                  <div key={s.id} className={styles.sessionItem}>
                    <div>
                      <div className={styles.sessionName}>{s.name}</div>
                      <div className={styles.sessionDate}>{formatDate(s.savedAt)}</div>
                    </div>
                    <div className={styles.sessionActions}>
                      <button className={styles.btnLoad} onClick={() => handleLoad(s)}>Charger</button>
                      <button className={styles.btnDelete} aria-label={`Supprimer ${s.name}`} onClick={() => handleDelete(s.id)}>✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className={styles.modalButtons}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Étape 3 : Vérifier la compilation**

```bash
cd /Users/sebastiendaenes/Desktop/Développement/arcade-loader/frontend && npm run build 2>&1 | grep -E "error|compiled" | head -5
```

Résultat attendu : `Successfully compiled` (ou `Compiled successfully`)

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/components/PlacementManager.js frontend/src/components/PlacementManager.module.css
git commit -m "feat: PlacementManager component — save/load named placements"
```

---

## Task 3: ManualEditor — Intégration de PlacementManager (Feature 1)

**Files:**
- Modify: `frontend/src/components/ManualEditor.js`

**Interfaces:**
- Consumes (depuis Task 2): `PlacementManager` avec props `allPlacements: AllPlacements`, `onLoad: (data: AllPlacements) => void`
- `onPlacementsChange` est déjà une prop de `ManualEditor` — c'est le callback à passer à `PlacementManager.onLoad`

- [ ] **Étape 1 : Ajouter l'import dans `ManualEditor.js`**

En haut du fichier, après les imports existants (ligne ~3) :

```js
import PlacementManager from './PlacementManager';
```

- [ ] **Étape 2 : Intégrer `<PlacementManager>` dans la sidebar**

Dans la sidebar (entre la section "Camions" et la section "Bornes"), ajouter `<PlacementManager>` après le `</div>` qui ferme la section camions :

Localiser ce bloc dans `ManualEditor.js` (section camions, autour de la ligne 342) :

```jsx
        <div className={styles.sideSection}>
          <div className={styles.sideTitle}>{t('manual.section.truck')}</div>
          {trucks.map((tr, i) => (
            // ...
          ))}
        </div>

        <div className={styles.sideSection}>
          <div className={styles.sideTitle}>
            {t('manual.section.cabs')}
```

Insérer `<PlacementManager>` entre les deux sections :

```jsx
        <div className={styles.sideSection}>
          <div className={styles.sideTitle}>{t('manual.section.truck')}</div>
          {trucks.map((tr, i) => (
            // ... (inchangé)
          ))}
        </div>

        <PlacementManager
          allPlacements={allPlacements}
          onLoad={onPlacementsChange}
        />

        <div className={styles.sideSection}>
          <div className={styles.sideTitle}>
            {t('manual.section.cabs')}
```

- [ ] **Étape 3 : Tester le flux complet manuellement**

1. Lancer `cd /Users/sebastiendaenes/Desktop/Développement/arcade-loader/frontend && npm start`
2. Naviguer vers l'onglet Manuel
3. Vérifier que la section "Placements sauvegardés" apparaît dans la sidebar avec les 2 boutons
4. Placer une borne sur un camion
5. Cliquer "💾 Sauvegarder" → nommer → valider
6. Supprimer le placement (bouton "Tout effacer")
7. Cliquer "📂 Charger" → la session apparaît → charger
8. Vérifier que le placement est restauré
9. Vérifier qu'une session "Auto — …" a été créée automatiquement
10. Arrêter le serveur

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/components/ManualEditor.js
git commit -m "feat: integrate PlacementManager in ManualEditor sidebar"
```

---

## Task 4: ManualEditor — Orientation du contenant (Feature 2)

**Files:**
- Modify: `frontend/src/components/ManualEditor.js`

**Contexte :** `ManualEditor.js` dessine le camion actif avec `truck.width` (horizontal) et `truck.depth` (vertical). En mode paysage, on swap ces deux dimensions. Les coordonnées stockées (`p.x`, `p.z`) ne changent pas — seul le rendu et les contraintes de placement utilisent les dimensions effectives.

- [ ] **Étape 1 : Ajouter l'état `orientations` et le `useMemo` `effectiveTruck`**

Dans le composant `ManualEditor`, après la ligne `const dragRef = useRef(null);` (ligne ~29), ajouter :

```js
const [orientations, setOrientations] = useState({}); // { [truckId]: true } = landscape
```

Puis après la définition de `const truck = trucks[truckIdx] || trucks[0];` (ligne ~33), ajouter :

```js
const effectiveTruck = useMemo(() => {
  if (!truck) return null;
  return orientations[truck.id]
    ? { ...truck, width: truck.depth, depth: truck.width }
    : truck;
}, [truck, orientations]);
```

- [ ] **Étape 2 : Mettre à jour `draw` pour utiliser `effectiveTruck`**

Remplacer la fonction `draw` existante par la version suivante (les changements sont `effectiveTruck` au lieu de `truck`, et `orientations` ajouté aux dépendances) :

```js
const draw = useCallback(() => {
  const canvas = canvasRef.current;
  if (!canvas || !effectiveTruck) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const scale = getScale(effectiveTruck, W, H);

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#1a1a3a';
  ctx.lineWidth = 1;
  const step = scale * 0.5;
  for (let x = PADDING; x <= PADDING + effectiveTruck.width * scale; x += step) {
    ctx.beginPath(); ctx.moveTo(x, PADDING); ctx.lineTo(x, PADDING + effectiveTruck.depth * scale); ctx.stroke();
  }
  for (let y = PADDING; y <= PADDING + effectiveTruck.depth * scale; y += step) {
    ctx.beginPath(); ctx.moveTo(PADDING, y); ctx.lineTo(PADDING + effectiveTruck.width * scale, y); ctx.stroke();
  }

  // Truck outline
  ctx.strokeStyle = '#ffaa00';
  ctx.lineWidth = 2;
  ctx.strokeRect(PADDING, PADDING, effectiveTruck.width * scale, effectiveTruck.depth * scale);

  // Dimension labels
  ctx.fillStyle = '#ffaa00';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${effectiveTruck.width} m`, PADDING + (effectiveTruck.width * scale) / 2, PADDING - 8);
  ctx.save();
  ctx.translate(PADDING - 10, PADDING + (effectiveTruck.depth * scale) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${effectiveTruck.depth} m`, 0, 0);
  ctx.restore();

  // Placements
  for (const p of placements) {
    const { cx, cy } = toCanvas(p.x, p.z, scale);
    const pw = (p.rotation === 90 ? p.depth : p.width) * scale;
    const pd = (p.rotation === 90 ? p.width : p.depth) * scale;
    const isSelected = p.id === selectedId;

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = p.color;
    ctx.fillRect(cx, cy, pw, pd);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = isSelected ? '#ffffff' : p.color;
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.strokeRect(cx, cy, pw, pd);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(9, Math.min(13, pw / 6))}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name;
    ctx.fillText(label, cx + pw / 2, cy + pd / 2);
    ctx.textBaseline = 'alphabetic';
  }

  // Ghost preview
  if (activeCab && dragRef.current?.ghost) {
    const g = dragRef.current.ghost;
    const pw = activeCab.width * scale;
    const pd = activeCab.depth * scale;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = activeCab.color;
    ctx.fillRect(g.cx - pw / 2, g.cy - pd / 2, pw, pd);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = activeCab.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(g.cx - pw / 2, g.cy - pd / 2, pw, pd);
    ctx.setLineDash([]);
  }

  // Info line
  ctx.fillStyle = 'rgba(255,170,0,0.8)';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${effectiveTruck.name}  |  ${effectiveTruck.width}×${effectiveTruck.depth} m  (${t('manual.canvas.view')})`, PADDING, H - 12);
  ctx.fillText(t('manual.canvas.placed', { n: placements.length }), W - 160, H - 12);
}, [effectiveTruck, placements, selectedId, activeCab, t]);
```

Note : `effectiveTruck` est un spread de `truck`, donc `effectiveTruck.name === truck.name` — `truck` n'est pas nécessaire dans les dépendances.

- [ ] **Étape 3 : Mettre à jour `hitTest` pour utiliser `effectiveTruck`**

Remplacer la fonction `hitTest` existante par :

```js
const hitTest = useCallback((cx, cy) => {
  const canvas = canvasRef.current;
  if (!canvas || !effectiveTruck) return null;
  const scale = getScale(effectiveTruck, canvas.width, canvas.height);
  for (let i = placements.length - 1; i >= 0; i--) {
    const p = placements[i];
    const { cx: px, cy: py } = toCanvas(p.x, p.z, scale);
    const pw = (p.rotation === 90 ? p.depth : p.width) * scale;
    const pd = (p.rotation === 90 ? p.width : p.depth) * scale;
    if (cx >= px && cx <= px + pw && cy >= py && cy <= py + pd) return p;
  }
  return null;
}, [effectiveTruck, placements]);
```

- [ ] **Étape 4 : Mettre à jour `handleMouseDown` pour utiliser `effectiveTruck`**

Remplacer la fonction `handleMouseDown` existante par :

```js
const handleMouseDown = (e) => {
  const { cx, cy } = getPos(e);
  const canvas = canvasRef.current;
  const scale = getScale(effectiveTruck, canvas.width, canvas.height);

  if (activeCab) {
    const counts = cabCounts.find(c => c.id === activeCab.id);
    if (counts && counts.remaining <= 0) return;
    const { x, z } = fromCanvas(cx, cy, scale);
    const px = Math.max(0, Math.min(effectiveTruck.width - activeCab.width, x - activeCab.width / 2));
    const pz = Math.max(0, Math.min(effectiveTruck.depth - activeCab.depth, z - activeCab.depth / 2));
    const newPlacement = {
      id: genId(),
      cabId: activeCab.id,
      name: activeCab.name,
      color: activeCab.color,
      x: px, z: pz,
      width: activeCab.width,
      height: activeCab.height,
      depth: activeCab.depth,
      rotation: 0,
    };
    setPlacements(prev => [...prev, newPlacement]);
    setSelectedId(newPlacement.id);
    return;
  }

  const hit = hitTest(cx, cy);
  if (hit) {
    setSelectedId(hit.id);
    const { cx: hx, cy: hy } = toCanvas(hit.x, hit.z, scale);
    dragRef.current = { id: hit.id, offX: cx - hx, offZ: cy - hy };
  } else {
    setSelectedId(null);
  }
};
```

- [ ] **Étape 5 : Mettre à jour `handleMouseMove` pour utiliser `effectiveTruck`**

Remplacer la fonction `handleMouseMove` existante par :

```js
const handleMouseMove = (e) => {
  const { cx, cy } = getPos(e);
  const canvas = canvasRef.current;
  const scale = getScale(effectiveTruck, canvas.width, canvas.height);

  if (activeCab) {
    dragRef.current = { ...dragRef.current, ghost: { cx, cy } };
    draw();
    return;
  }

  if (!dragRef.current?.id) return;
  const { id, offX, offZ } = dragRef.current;
  const p = placements.find(pl => pl.id === id);
  if (!p) return;
  const { x: rawX, z: rawZ } = fromCanvas(cx - offX, cy - offZ, scale);
  const pw = p.rotation === 90 ? p.depth : p.width;
  const pd = p.rotation === 90 ? p.width : p.depth;
  const nx = Math.max(0, Math.min(effectiveTruck.width - pw, rawX));
  const nz = Math.max(0, Math.min(effectiveTruck.depth - pd, rawZ));
  setPlacements(prev => prev.map(pl => pl.id === id ? { ...pl, x: nx, z: nz } : pl));
};
```

- [ ] **Étape 6 : Ajouter le bouton `[🔄]` dans la liste des camions**

Dans la liste des camions (autour de la ligne 333), remplacer le bouton camion existant par une version avec le toggle d'orientation :

```jsx
{trucks.map((tr, i) => (
  <div key={tr.id} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
    <button
      className={`${styles.truckBtn} ${truckIdx === i ? styles.truckBtnActive : ''}`}
      style={{ flex: 1 }}
      onClick={() => { setTruckIdx(i); setSelectedId(null); setActiveCabId(null); }}
    >
      🚛 {tr.name}
      <span className={styles.truckDim}>{tr.width}×{tr.depth} m</span>
    </button>
    <button
      title={orientations[tr.id] ? 'Vue paysage (cliquer pour portrait)' : 'Vue portrait (cliquer pour paysage)'}
      style={{
        flexShrink: 0,
        background: orientations[tr.id] ? 'rgba(255,170,0,0.15)' : 'transparent',
        border: `1px solid ${orientations[tr.id] ? '#ffaa00' : 'var(--border)'}`,
        borderRadius: '4px',
        color: orientations[tr.id] ? '#ffaa00' : 'var(--text-dim)',
        fontSize: '0.75rem',
        padding: '0.35rem 0.45rem',
        cursor: 'pointer',
      }}
      onClick={() => setOrientations(prev => ({ ...prev, [tr.id]: !prev[tr.id] }))}
    >
      🔄
    </button>
  </div>
))}
```

- [ ] **Étape 7 : Tester le toggle d'orientation manuellement**

1. Lancer `cd /Users/sebastiendaenes/Desktop/Développement/arcade-loader/frontend && npm start`
2. Naviguer vers l'onglet Manuel
3. Choisir un semi-remorque (13.6m de profondeur) — le canvas est très haut en portrait
4. Cliquer `[🔄]` à droite du camion → le canvas bascule en paysage (13.6m horizontal)
5. Placer une borne — vérifier que le clamp est correct (borne reste dans les bornes du camion)
6. Faire glisser une borne — vérifier que le drag est limité aux bonnes dimensions
7. Recliquer `[🔄]` → retour en portrait, les placements sont toujours là aux mêmes coordonnées
8. Arrêter le serveur

- [ ] **Étape 8 : Commit**

```bash
git add frontend/src/components/ManualEditor.js
git commit -m "feat: orientation toggle per truck in manual editor"
```
