import React, { useState, useCallback, useRef } from 'react';
import styles from './CabinetDirectory.module.css';

const API_BASE = process.env.REACT_APP_API_URL || '';
const COLORS = ['#00f5ff','#ff00aa','#aaff00','#ffaa00','#aa00ff','#ff5500','#00ffaa','#ff0055'];

function genId() { return 'dir_' + Math.random().toString(36).slice(2, 8); }

function Field({ label, value, onChange, type = 'text', unit }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.fieldInput}>
        <input
          type={type}
          step={type === 'number' ? 0.01 : undefined}
          min={type === 'number' ? 0 : undefined}
          value={value}
          onChange={(e) => {
            if (type === 'number') {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(v);
            } else {
              onChange(e.target.value);
            }
          }}
        />
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
    </div>
  );
}

function CabinetCard({ cab, onUpdate, onDelete, onAddToList, dragHandlers }) {
  const [expanded, setExpanded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const doSearch = useCallback(async (deep) => {
    setSearching(deep ? 'deep' : 'quick');
    setSearchError(null);
    try {
      const res = await fetch(`${API_BASE}/api/search-cabinet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cab.name, deep }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      onUpdate({
        ...cab,
        width:  data.width  ?? cab.width,
        height: data.height ?? cab.height,
        depth:  data.depth  ?? cab.depth,
        weight: data.weight ?? cab.weight,
        notes:  data.notes  || cab.notes,
      });
      setExpanded(true);
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  }, [cab, onUpdate]);

  return (
    <div className={styles.card} style={{ borderLeftColor: cab.color }} {...dragHandlers}>
      <div className={styles.cardHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.cardHeaderLeft}>
          <span className={styles.dragHandle} title="Glisser pour réordonner">⠿</span>
          <span className={styles.dot} style={{ background: cab.color }} />
          <span className={styles.cardName}>{cab.name || '—'}</span>
          {cab.weight != null && (
            <span className={styles.cardMeta}>{cab.weight} kg</span>
          )}
        </div>
        <div className={styles.cardHeaderRight}>
          {cab.width && cab.height && cab.depth && (
            <span className={styles.cardDims}>
              {cab.width}×{cab.height}×{cab.depth} m
            </span>
          )}
          <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.cardBody}>
          <Field
            label="Nom de la borne"
            value={cab.name}
            onChange={(v) => onUpdate({ ...cab, name: v })}
          />
          <div className={styles.dimsGrid}>
            <Field label="Largeur (m)" type="number" value={cab.width ?? ''} unit="m"
              onChange={(v) => onUpdate({ ...cab, width: v })} />
            <Field label="Hauteur (m)" type="number" value={cab.height ?? ''} unit="m"
              onChange={(v) => onUpdate({ ...cab, height: v })} />
            <Field label="Profondeur (m)" type="number" value={cab.depth ?? ''} unit="m"
              onChange={(v) => onUpdate({ ...cab, depth: v })} />
            <Field label="Poids (kg)" type="number" value={cab.weight ?? ''} unit="kg"
              onChange={(v) => onUpdate({ ...cab, weight: v })} />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Notes</label>
            <textarea
              className={styles.notes}
              value={cab.notes || ''}
              rows={2}
              onChange={(e) => onUpdate({ ...cab, notes: e.target.value })}
            />
          </div>

          {searchError && (
            <div className={styles.searchError}>⚠ {searchError}</div>
          )}

          <div className={styles.cardActions}>
            <button
              className={styles.searchBtn}
              onClick={() => doSearch(false)}
              disabled={!!searching || !cab.name.trim()}
              title="Recherche rapide via Claude"
            >
              {searching === 'quick' ? (
                <span className={styles.dots}>Recherche<span>.</span><span>.</span><span>.</span></span>
              ) : (
                '✦ Rechercher via Claude'
              )}
            </button>
            <button
              className={styles.deepBtn}
              onClick={() => doSearch(true)}
              disabled={!!searching || !cab.name.trim()}
              title="Recherche approfondie — Claude raisonne en détail sur le modèle exact"
            >
              {searching === 'deep' ? (
                <span className={styles.dots}>Analyse<span>.</span><span>.</span><span>.</span></span>
              ) : (
                '⚡ Recherche approfondie'
              )}
            </button>
            <button
              className={styles.addBtn}
              onClick={() => onAddToList(cab)}
              disabled={!cab.width || !cab.height || !cab.depth}
              title="Ajouter à la liste des bornes (onglet Configuration)"
            >
              + Ajouter à la config
            </button>
            <button className={styles.deleteBtn} onClick={onDelete}>
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CabinetDirectory({ directory, onDirectoryChange, onAddToConfig }) {
  const dragIdx = useRef(null);

  const handleUpdate = (idx, updated) => {
    const next = [...directory];
    next[idx] = updated;
    onDirectoryChange(next);
  };

  const handleDelete = (idx) => {
    onDirectoryChange(directory.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    const colorIdx = directory.length % COLORS.length;
    onDirectoryChange([...directory, {
      id: genId(),
      name: '',
      width: null,
      height: null,
      depth: null,
      weight: null,
      notes: '',
      color: COLORS[colorIdx],
    }]);
  };

  const handleAddToConfig = (cab) => {
    onAddToConfig({
      name: cab.name || 'Borne',
      width: cab.width || 0.65,
      height: cab.height || 1.75,
      depth: cab.depth || 0.75,
      color: cab.color,
    });
  };

  return (
    <div className={styles.directory}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>📋</span>
          <div>
            <h2 className={styles.headerTitle}>Annuaire des bornes</h2>
            <p className={styles.headerSub}>
              Référencez vos bornes avec leurs dimensions. Claude peut les compléter automatiquement.
            </p>
          </div>
        </div>
        <span className={styles.count}>{directory.length} borne{directory.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.list}>
        {directory.length === 0 && (
          <div className={styles.empty}>
            Aucune borne dans l'annuaire. Cliquez sur "Ajouter une borne" pour commencer.
          </div>
        )}
        {directory.map((cab, i) => (
          <CabinetCard
            key={cab.id}
            cab={cab}
            onUpdate={(updated) => handleUpdate(i, updated)}
            onDelete={() => handleDelete(i)}
            onAddToList={handleAddToConfig}
            dragHandlers={{
              draggable: true,
              onDragStart: () => { dragIdx.current = i; },
              onDragOver: (e) => e.preventDefault(),
              onDrop: () => {
                const from = dragIdx.current;
                if (from === null || from === i) return;
                const next = [...directory];
                const [item] = next.splice(from, 1);
                next.splice(i, 0, item);
                onDirectoryChange(next);
              },
            }}
          />
        ))}
      </div>

      <button className={styles.newBtn} onClick={handleAdd}>
        + Ajouter une borne
      </button>
    </div>
  );
}
