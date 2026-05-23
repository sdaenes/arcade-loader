import React, { useState } from 'react';
import styles from './Panel.module.css';

function genId() { return 'truck_' + Math.random().toString(36).slice(2, 7); }

const BUILTIN_PRESETS = [
  { label: 'Fourgon 12m³', width: 2.1, height: 2.2, depth: 2.6 },
  { label: 'Camion 20m³', width: 2.4, height: 2.5, depth: 7.0 },
  { label: 'Camion 30m³', width: 2.4, height: 2.5, depth: 8.5 },
  { label: 'Semi 90m³', width: 2.4, height: 2.5, depth: 13.6 },
  { label: "Container 20'", width: 2.35, height: 2.39, depth: 5.90 },
  { label: "Container 40'", width: 2.35, height: 2.39, depth: 12.03 },
];

function TruckRow({ truck, onChange, onDelete, presets }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.itemCard} style={{ borderLeftColor: '#ffaa00' }}>
      <div className={styles.itemHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.itemHeaderLeft}>
          <span className={styles.colorDot} style={{ background: '#ffaa00' }} />
          <span className={styles.itemName}>{truck.name}</span>
        </div>
        <div className={styles.itemHeaderRight}>
          <span className={styles.itemDims}>
            {truck.width}×{truck.height}×{truck.depth} m
          </span>
          <span className={styles.itemQty}>
            {(truck.width * truck.height * truck.depth).toFixed(1)}m³
          </span>
          <span className={styles.expandChevron}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.itemBody}>
          <div className={styles.fieldRow}>
            <label>Nom</label>
            <input value={truck.name} onChange={(e) => onChange({ ...truck, name: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', display: 'block', marginBottom: '0.4rem' }}>
              Modèle rapide
            </label>
            <select
              defaultValue=""
              onChange={(e) => {
                const all = [...presets, ...BUILTIN_PRESETS];
                const p = all.find(pr => pr.label === e.target.value);
                if (p) onChange({ ...truck, width: p.width, height: p.height, depth: p.depth });
              }}
            >
              <option value="">— Choisir un modèle —</option>
              {presets.length > 0 && (
                <optgroup label="Mes contenants">
                  {presets.map(p => (
                    <option key={p.id || p.label} value={p.label}>
                      {p.label} ({p.width}×{p.height}×{p.depth} m)
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Modèles standards">
                {BUILTIN_PRESETS.map(p => (
                  <option key={p.label} value={p.label}>{p.label} ({p.width}×{p.height}×{p.depth} m)</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className={styles.dimsGrid}>
            <div className={styles.fieldRow}>
              <label>Largeur (m)</label>
              <input type="number" step={0.01} min={0}
                value={truck.width}
                onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange({ ...truck, width: v }); }} />
            </div>
            <div className={styles.fieldRow}>
              <label>Hauteur (m)</label>
              <input type="number" step={0.01} min={0}
                value={truck.height}
                onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange({ ...truck, height: v }); }} />
            </div>
            <div className={styles.fieldRow}>
              <label>Profondeur (m)</label>
              <input type="number" step={0.01} min={0}
                value={truck.depth}
                onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange({ ...truck, depth: v }); }} />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <label>Volume total</label>
            <span className={styles.computed}>
              {(truck.width * truck.height * truck.depth).toFixed(2)} m³
            </span>
          </div>
          <button className={styles.deleteBtn} onClick={onDelete}>Supprimer</button>
        </div>
      )}
    </div>
  );
}

export default function TruckPanel({ trucks, onChange, containerTemplates = [] }) {
  const handleChange = (idx, updated) => {
    const next = [...trucks];
    next[idx] = updated;
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...trucks, {
      id: genId(),
      name: `Camion ${trucks.length + 1}`,
      width: 2.4, height: 2.5, depth: 7.0,
    }]);
  };

  const totalVol = trucks.reduce((s, t) => s + t.width * t.height * t.depth, 0);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span className={styles.panelIcon}>🚛</span>
          Camions / Containers
        </div>
        <span className={styles.panelCount}>{totalVol.toFixed(1)} m³ total</span>
      </div>

      <div className={styles.itemList}>
        {trucks.map((truck, i) => (
          <TruckRow
            key={truck.id}
            truck={truck}
            presets={containerTemplates}
            onChange={(updated) => handleChange(i, updated)}
            onDelete={() => onChange(trucks.filter((_, j) => j !== i))}
          />
        ))}
      </div>

      <button className={styles.addBtn} onClick={handleAdd}>
        + Ajouter un camion / container
      </button>
    </div>
  );
}
