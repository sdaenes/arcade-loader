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
