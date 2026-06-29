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
