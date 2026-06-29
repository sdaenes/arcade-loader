# Session Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de sauvegarder des sessions complètes (bornes + camions + marge + placements manuels), de les rappeler, et d'exporter/importer en JSON — avec des boutons dans l'onglet Setup.

**Architecture:** Un module de données pur (`sessions.js`) encapsule toute la logique localStorage. Un composant React (`SessionManager.js`) gère l'UI (boutons + modals). `App.js` est modifié pour intégrer le composant et le handler de chargement.

**Tech Stack:** React 18, CSS Modules, Jest (via react-scripts), localStorage

## Global Constraints

- Ne pas modifier les clés localStorage existantes (`al_cabinets`, `al_trucks`, `al_margin`, `al_manual`) — les sessions sont stockées dans `al_sessions` (nouvelle clé)
- Pas de `window.prompt` ni `window.confirm` — modals React inline uniquement
- Suivre le style CSS existant des autres composants (`*.module.css`, variables CSS du projet)
- Les `results` d'optimisation ne sont PAS inclus dans les sessions sauvegardées

---

## Fichiers créés / modifiés

| Fichier | Action | Rôle |
|---|---|---|
| `frontend/src/components/sessions.js` | Créer | Data layer pur : lecture/écriture/suppression localStorage, export/import JSON |
| `frontend/src/components/__tests__/sessions.test.js` | Créer | Tests unitaires du data layer |
| `frontend/src/components/SessionManager.js` | Créer | Composant React : boutons + modals Sauvegarder/Charger/Exporter/Importer |
| `frontend/src/components/SessionManager.module.css` | Créer | Styles CSS du composant |
| `frontend/src/App.js` | Modifier | Ajouter `handleLoadSession`, intégrer `<SessionManager>` dans l'onglet Setup |

---

## Task 1: Data layer — `sessions.js`

**Files:**
- Create: `frontend/src/components/sessions.js`
- Test: `frontend/src/components/__tests__/sessions.test.js`

**Interfaces:**
- Produces:
  - `loadSessions(): Session[]`
  - `saveSession(name: string, data: SessionData): Session` — retourne la session créée
  - `deleteSession(id: string): void`
  - `exportSessionsJSON(): string` — retourne le JSON stringifié de toutes les sessions
  - `importSessionsJSON(jsonString: string): { imported: number, skipped: number }` — fusionne sans doublons

Types internes :
```js
// SessionData
{ cabinets: [], trucks: [], errorMargin: number, manualPlacements: {} }

// Session
{ id: string, name: string, savedAt: string, data: SessionData }
```

- [ ] **Étape 1 : Écrire les tests**

Créer `frontend/src/components/__tests__/sessions.test.js` :

```js
import {
  loadSessions,
  saveSession,
  deleteSession,
  exportSessionsJSON,
  importSessionsJSON,
} from '../sessions';

const MOCK_DATA = {
  cabinets: [{ id: 'c1', name: 'Test', width: 0.65, height: 1.75, depth: 0.75, quantity: 1, canTilt: false, color: '#fff' }],
  trucks: [{ id: 't1', name: 'Camion', width: 2.4, height: 2.5, depth: 7.0 }],
  errorMargin: 5,
  manualPlacements: {},
};

beforeEach(() => {
  localStorage.clear();
});

test('loadSessions returns empty array when nothing saved', () => {
  expect(loadSessions()).toEqual([]);
});

test('saveSession persists a session and returns it', () => {
  const session = saveSession('Ma session', MOCK_DATA);
  expect(session.name).toBe('Ma session');
  expect(session.id).toBeDefined();
  expect(session.savedAt).toBeDefined();
  expect(session.data).toEqual(MOCK_DATA);

  const sessions = loadSessions();
  expect(sessions).toHaveLength(1);
  expect(sessions[0].name).toBe('Ma session');
});

test('saveSession appends to existing sessions', () => {
  saveSession('Session A', MOCK_DATA);
  saveSession('Session B', MOCK_DATA);
  expect(loadSessions()).toHaveLength(2);
});

test('deleteSession removes the correct session', () => {
  const s1 = saveSession('A', MOCK_DATA);
  const s2 = saveSession('B', MOCK_DATA);
  deleteSession(s1.id);
  const remaining = loadSessions();
  expect(remaining).toHaveLength(1);
  expect(remaining[0].id).toBe(s2.id);
});

test('deleteSession with unknown id does nothing', () => {
  saveSession('A', MOCK_DATA);
  deleteSession('nonexistent-id');
  expect(loadSessions()).toHaveLength(1);
});

test('exportSessionsJSON returns valid JSON array', () => {
  saveSession('Export test', MOCK_DATA);
  const json = exportSessionsJSON();
  const parsed = JSON.parse(json);
  expect(Array.isArray(parsed)).toBe(true);
  expect(parsed[0].name).toBe('Export test');
});

test('importSessionsJSON merges sessions without duplicates', () => {
  const s1 = saveSession('Existing', MOCK_DATA);
  const toImport = JSON.stringify([
    { id: s1.id, name: 'Existing', savedAt: s1.savedAt, data: MOCK_DATA },
    { id: 'new-id-999', name: 'Nouveau', savedAt: new Date().toISOString(), data: MOCK_DATA },
  ]);
  const result = importSessionsJSON(toImport);
  expect(result.imported).toBe(1);
  expect(result.skipped).toBe(1);
  expect(loadSessions()).toHaveLength(2);
});

test('importSessionsJSON returns 0/0 for empty array', () => {
  const result = importSessionsJSON('[]');
  expect(result.imported).toBe(0);
  expect(result.skipped).toBe(0);
});

test('importSessionsJSON throws on invalid JSON', () => {
  expect(() => importSessionsJSON('not-json')).toThrow();
});
```

- [ ] **Étape 2 : Vérifier que les tests échouent**

```bash
cd frontend && npm test -- --testPathPattern=sessions.test --watchAll=false
```

Résultat attendu : `FAIL` avec `Cannot find module '../sessions'`

- [ ] **Étape 3 : Implémenter `sessions.js`**

Créer `frontend/src/components/sessions.js` :

```js
const LS_KEY = 'al_sessions';

export function loadSessions() {
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

export function saveSession(name, data) {
  const session = {
    id: String(Date.now()),
    name,
    savedAt: new Date().toISOString(),
    data,
  };
  const sessions = loadSessions();
  sessions.push(session);
  persist(sessions);
  return session;
}

export function deleteSession(id) {
  const sessions = loadSessions().filter(s => s.id !== id);
  persist(sessions);
}

export function exportSessionsJSON() {
  return JSON.stringify(loadSessions(), null, 2);
}

export function importSessionsJSON(jsonString) {
  const incoming = JSON.parse(jsonString);
  const existing = loadSessions();
  const existingIds = new Set(existing.map(s => s.id));
  let imported = 0;
  let skipped = 0;
  for (const s of incoming) {
    if (existingIds.has(s.id)) {
      skipped++;
    } else {
      existing.push(s);
      imported++;
    }
  }
  persist(existing);
  return { imported, skipped };
}
```

- [ ] **Étape 4 : Vérifier que les tests passent**

```bash
cd frontend && npm test -- --testPathPattern=sessions.test --watchAll=false
```

Résultat attendu : `PASS` — 9 tests

- [ ] **Étape 5 : Commit**

```bash
git add frontend/src/components/sessions.js frontend/src/components/__tests__/sessions.test.js
git commit -m "feat: session data layer — load/save/delete/export/import"
```

---

## Task 2: Composant `SessionManager`

**Files:**
- Create: `frontend/src/components/SessionManager.js`
- Create: `frontend/src/components/SessionManager.module.css`

**Interfaces:**
- Consumes (depuis Task 1): `loadSessions`, `saveSession`, `deleteSession`, `exportSessionsJSON`, `importSessionsJSON`
- Props reçues:
  - `cabinets: array`
  - `trucks: array`
  - `errorMargin: number`
  - `manualPlacements: object`
  - `onLoad: (data: SessionData) => void` — appelé quand l'utilisateur charge une session

- [ ] **Étape 1 : Créer `SessionManager.module.css`**

```css
.container {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1a1a1a;
}

.title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #888;
  margin-bottom: 0.75rem;
}

.buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  flex: 1;
  min-width: 100px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #444;
  border-radius: 4px;
  background: #252525;
  color: #ddd;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.btn:hover {
  background: #333;
  border-color: #666;
}

/* Modal */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 1.5rem;
  min-width: 320px;
  max-width: 480px;
  width: 90%;
}

.modalTitle {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #eee;
}

.input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #444;
  border-radius: 4px;
  background: #252525;
  color: #eee;
  font-size: 0.85rem;
  box-sizing: border-box;
  margin-bottom: 1rem;
}

.modalButtons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btnPrimary {
  padding: 0.45rem 1rem;
  border: none;
  border-radius: 4px;
  background: #3a7bd5;
  color: #fff;
  font-size: 0.82rem;
  cursor: pointer;
}

.btnPrimary:hover { background: #2e6abf; }

.btnSecondary {
  padding: 0.45rem 1rem;
  border: 1px solid #555;
  border-radius: 4px;
  background: transparent;
  color: #aaa;
  font-size: 0.82rem;
  cursor: pointer;
}

.btnSecondary:hover { background: #2a2a2a; }

/* Session list */
.sessionList {
  max-height: 280px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.sessionItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  border: 1px solid #333;
  border-radius: 4px;
  margin-bottom: 0.4rem;
  background: #252525;
}

.sessionName {
  font-size: 0.85rem;
  color: #ddd;
  font-weight: 500;
}

.sessionDate {
  font-size: 0.72rem;
  color: #777;
  margin-top: 0.1rem;
}

.sessionActions {
  display: flex;
  gap: 0.4rem;
}

.btnLoad {
  padding: 0.3rem 0.65rem;
  border: 1px solid #3a7bd5;
  border-radius: 3px;
  background: transparent;
  color: #3a7bd5;
  font-size: 0.75rem;
  cursor: pointer;
}

.btnLoad:hover { background: #3a7bd520; }

.btnDelete {
  padding: 0.3rem 0.5rem;
  border: 1px solid #c0392b;
  border-radius: 3px;
  background: transparent;
  color: #c0392b;
  font-size: 0.75rem;
  cursor: pointer;
}

.btnDelete:hover { background: #c0392b20; }

.emptyState {
  text-align: center;
  color: #666;
  font-size: 0.82rem;
  padding: 1.5rem 0;
}

.feedbackMsg {
  margin-top: 0.75rem;
  font-size: 0.78rem;
  color: #5cb85c;
  text-align: center;
}
```

- [ ] **Étape 2 : Créer `SessionManager.js`**

```js
import React, { useState, useRef } from 'react';
import styles from './SessionManager.module.css';
import {
  loadSessions,
  saveSession,
  deleteSession,
  exportSessionsJSON,
  importSessionsJSON,
} from './sessions';

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatAutoName() {
  const d = new Date();
  return `Auto — ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function SessionManager({ cabinets, trucks, errorMargin, manualPlacements, onLoad }) {
  const [modal, setModal] = useState(null); // 'save' | 'load' | null
  const [saveName, setSaveName] = useState('');
  const [sessions, setSessions] = useState([]);
  const [feedback, setFeedback] = useState('');
  const importRef = useRef(null);

  function openSave() {
    const d = new Date();
    setSaveName(`${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
    setModal('save');
  }

  function openLoad() {
    setSessions(loadSessions());
    setFeedback('');
    setModal('load');
  }

  function handleSave() {
    if (!saveName.trim()) return;
    saveSession(saveName.trim(), { cabinets, trucks, errorMargin, manualPlacements });
    setModal(null);
  }

  function handleLoad(session) {
    const autoName = formatAutoName();
    saveSession(autoName, { cabinets, trucks, errorMargin, manualPlacements });
    onLoad(session.data);
    setModal(null);
  }

  function handleDelete(id) {
    deleteSession(id);
    setSessions(loadSessions());
  }

  function handleExport() {
    const json = exportSessionsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arcade-loader-sessions.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = importSessionsJSON(ev.target.result);
        setFeedback(`${result.imported} importée(s), ${result.skipped} ignorée(s)`);
        setSessions(loadSessions());
      } catch {
        setFeedback('Fichier invalide.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className={styles.container}>
      <div className={styles.title}>Sessions</div>
      <div className={styles.buttons}>
        <button className={styles.btn} onClick={openSave}>💾 Sauvegarder</button>
        <button className={styles.btn} onClick={openLoad}>📂 Charger</button>
        <button className={styles.btn} onClick={handleExport}>⬆ Exporter JSON</button>
        <button className={styles.btn} onClick={() => importRef.current.click()}>⬇ Importer JSON</button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
      </div>

      {modal === 'save' && (
        <div className={styles.overlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Nommer la session</div>
            <input
              className={styles.input}
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
              placeholder="Ex : Transport Lyon juin"
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
            <div className={styles.modalTitle}>Charger une session</div>
            <div className={styles.sessionList}>
              {sessions.length === 0 ? (
                <div className={styles.emptyState}>Aucune session sauvegardée</div>
              ) : (
                sessions.slice().reverse().map(s => (
                  <div key={s.id} className={styles.sessionItem}>
                    <div>
                      <div className={styles.sessionName}>{s.name}</div>
                      <div className={styles.sessionDate}>{formatDate(s.savedAt)}</div>
                    </div>
                    <div className={styles.sessionActions}>
                      <button className={styles.btnLoad} onClick={() => handleLoad(s)}>Charger</button>
                      <button className={styles.btnDelete} onClick={() => handleDelete(s.id)}>✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {feedback && <div className={styles.feedbackMsg}>{feedback}</div>}
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

- [ ] **Étape 3 : Vérifier le rendu (lancer l'app)**

```bash
cd frontend && npm start
```

Naviguer vers l'onglet Setup. Vérifier que la zone "Sessions" apparaît avec les 4 boutons. Tester la modal Sauvegarder (nom pré-rempli, bouton Valider actif seulement si non vide). Fermer via Annuler et via clic sur l'overlay.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/components/SessionManager.js frontend/src/components/SessionManager.module.css
git commit -m "feat: SessionManager component — save/load/export/import modals"
```

---

## Task 3: Intégration dans `App.js`

**Files:**
- Modify: `frontend/src/App.js`

**Interfaces:**
- Consumes (depuis Task 2): `SessionManager` (props: `cabinets`, `trucks`, `errorMargin`, `manualPlacements`, `onLoad`)
- Consumes (depuis Task 1): signature de `SessionData` = `{ cabinets, trucks, errorMargin, manualPlacements }`

- [ ] **Étape 1 : Ajouter l'import dans `App.js`**

En haut du fichier, après les imports existants :

```js
import SessionManager from './components/SessionManager';
```

- [ ] **Étape 2 : Ajouter `handleLoadSession` dans `App.js`**

Après la fonction `handleResetManual` (ligne ~106), ajouter :

```js
const handleLoadSession = useCallback((data) => {
  setCabinets(data.cabinets ?? []);
  setTrucks(data.trucks ?? []);
  setErrorMargin(data.errorMargin ?? 5);
  setManualPlacements(data.manualPlacements ?? {});
  setResults(null);
}, []);
```

- [ ] **Étape 3 : Intégrer `<SessionManager>` dans l'onglet Setup**

Dans le rendu de l'onglet Setup (`{activeTab === 'setup' && ...}`), après la `<div className={styles.controlPanel}>` qui contient le slider de marge et le bouton optimiser (juste avant la fermeture `</div>` de `styles.column`), ajouter `<SessionManager>` :

Localiser ce bloc dans `App.js` (autour de la ligne 279) :

```jsx
            </div>
          </div>
        </div>
      )}
```

Juste avant le `</div>` fermant `styles.column` de la colonne droite (après `</div>` qui ferme `styles.controlPanel`), insérer :

```jsx
            <SessionManager
              cabinets={cabinets}
              trucks={trucks}
              errorMargin={errorMargin}
              manualPlacements={manualPlacements}
              onLoad={handleLoadSession}
            />
```

Le rendu final de la colonne droite dans l'onglet setup doit ressembler à :

```jsx
          <div className={styles.column}>
            <TruckPanel ... />
            <div className={styles.controlPanel}>
              {/* slider marge, summary, bouton optimiser */}
            </div>
            <SessionManager
              cabinets={cabinets}
              trucks={trucks}
              errorMargin={errorMargin}
              manualPlacements={manualPlacements}
              onLoad={handleLoadSession}
            />
          </div>
```

- [ ] **Étape 4 : Tester le flux complet**

1. Ajouter des bornes et un camion
2. Cliquer "💾 Sauvegarder" → entrer un nom → valider
3. Modifier les bornes (supprimer tout)
4. Cliquer "📂 Charger" → la session sauvegardée apparaît → cliquer "Charger"
5. Vérifier que les bornes et camions d'origine sont restaurés
6. Vérifier qu'une session "Auto — …" a été créée automatiquement (visible dans la liste)
7. Cliquer "⬆ Exporter JSON" → un fichier `arcade-loader-sessions.json` est téléchargé
8. Ouvrir le fichier dans un éditeur → vérifier la structure JSON

- [ ] **Étape 5 : Commit**

```bash
git add frontend/src/App.js
git commit -m "feat: integrate SessionManager in Setup tab"
```
