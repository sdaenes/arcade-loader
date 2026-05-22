import React, { useState } from 'react';
import styles from './Panel.module.css';

const COLORS = ['#00f5ff','#ff00aa','#aaff00','#ffaa00','#aa00ff','#ff5500','#00ffaa','#ff0055'];

function genId() { return 'cab_' + Math.random().toString(36).slice(2, 7); }

function CabinetRow({ cabinet, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.itemCard} style={{ borderLeftColor: cabinet.color }}>
      <div className={styles.itemHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.itemHeaderLeft}>
          <span className={styles.colorDot} style={{ background: cabinet.color }} />
          <span className={styles.itemName}>{cabinet.name}</span>
        </div>
        <div className={styles.itemHeaderRight}>
          <span className={styles.itemDims}>
            {cabinet.width}×{cabinet.height}×{cabinet.depth} m
          </span>
          <span className={styles.itemQty}>×{cabinet.quantity}</span>
          <span className={styles.expandChevron}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.itemBody}>
          <div className={styles.fieldRow}>
            <label>Nom</label>
            <input
              value={cabinet.name}
              onChange={(e) => onChange({ ...cabinet, name: e.target.value })}
            />
          </div>
          <div className={styles.fieldRow}>
            <label>Quantité</label>
            <input
              type="number" min={1} max={999}
              value={cabinet.quantity}
              onChange={(e) => onChange({ ...cabinet, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
            />
          </div>
          <div className={styles.dimsGrid}>
            <div className={styles.fieldRow}>
              <label>Largeur (m)</label>
              <input
                type="number" step={0.01} min={0.1}
                value={cabinet.width}
                onChange={(e) => onChange({ ...cabinet, width: parseFloat(e.target.value) || 0.1 })}
              />
            </div>
            <div className={styles.fieldRow}>
              <label>Hauteur (m)</label>
              <input
                type="number" step={0.01} min={0.1}
                value={cabinet.height}
                onChange={(e) => onChange({ ...cabinet, height: parseFloat(e.target.value) || 0.1 })}
              />
            </div>
            <div className={styles.fieldRow}>
              <label>Profondeur (m)</label>
              <input
                type="number" step={0.01} min={0.1}
                value={cabinet.depth}
                onChange={(e) => onChange({ ...cabinet, depth: parseFloat(e.target.value) || 0.1 })}
              />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <label>Volume unitaire</label>
            <span className={styles.computed}>
              {(cabinet.width * cabinet.height * cabinet.depth).toFixed(3)} m³
            </span>
          </div>
          <div className={styles.colorPicker}>
            <label>Couleur</label>
            <div className={styles.colorSwatches}>
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`${styles.swatch} ${cabinet.color === c ? styles.swatchActive : ''}`}
                  style={{ background: c }}
                  onClick={() => onChange({ ...cabinet, color: c })}
                />
              ))}
            </div>
          </div>
          <div className={styles.fieldRow}>
            <label>Peut être inclinée ?</label>
            <input
              type="checkbox"
              checked={cabinet.canTilt}
              onChange={(e) => onChange({ ...cabinet, canTilt: e.target.checked })}
              style={{ width: 'auto' }}
            />
          </div>
          <button className={styles.deleteBtn} onClick={onDelete}>Supprimer</button>
        </div>
      )}
    </div>
  );
}

export default function CabinetPanel({ cabinets, onChange }) {
  const handleChange = (idx, updated) => {
    const next = [...cabinets];
    next[idx] = updated;
    onChange(next);
  };

  const handleDelete = (idx) => {
    onChange(cabinets.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    const colorIdx = cabinets.length % COLORS.length;
    onChange([...cabinets, {
      id: genId(),
      name: `Borne ${cabinets.length + 1}`,
      width: 0.65, height: 1.75, depth: 0.75,
      quantity: 1,
      canTilt: false,
      color: COLORS[colorIdx],
    }]);
  };

  const totalUnits = cabinets.reduce((s, c) => s + (c.quantity || 1), 0);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span className={styles.panelIcon}>🕹</span>
          Bornes d'arcade
        </div>
        <span className={styles.panelCount}>{totalUnits} unité{totalUnits > 1 ? 's' : ''}</span>
      </div>

      <div className={styles.itemList}>
        {cabinets.map((cab, i) => (
          <CabinetRow
            key={cab.id}
            cabinet={cab}
            onChange={(updated) => handleChange(i, updated)}
            onDelete={() => handleDelete(i)}
          />
        ))}
      </div>

      <button className={styles.addBtn} onClick={handleAdd}>
        + Ajouter une borne
      </button>
    </div>
  );
}
