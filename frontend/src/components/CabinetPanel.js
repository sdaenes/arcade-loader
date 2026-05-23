import React, { useState, useRef } from 'react';
import styles from './Panel.module.css';

const COLORS = ['#00f5ff','#ff00aa','#aaff00','#ffaa00','#aa00ff','#ff5500','#00ffaa','#ff0055'];

function genId() { return 'cab_' + Math.random().toString(36).slice(2, 7); }

function numInput(value, field, onChange, cab, extra = {}) {
  return (
    <input
      type="number"
      step={0.01}
      min={0}
      value={value}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange({ ...cab, [field]: v });
      }}
      {...extra}
    />
  );
}

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
              type="number" min={0} max={999}
              value={cabinet.quantity}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 0) onChange({ ...cabinet, quantity: v });
              }}
            />
          </div>
          <div className={styles.dimsGrid}>
            <div className={styles.fieldRow}>
              <label>Largeur (m)</label>
              {numInput(cabinet.width, 'width', onChange, cabinet)}
            </div>
            <div className={styles.fieldRow}>
              <label>Hauteur (m)</label>
              {numInput(cabinet.height, 'height', onChange, cabinet)}
            </div>
            <div className={styles.fieldRow}>
              <label>Profondeur (m)</label>
              {numInput(cabinet.depth, 'depth', onChange, cabinet)}
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
  const fileRef = useRef(null);

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

  const downloadTemplate = () => {
    const csv = 'nom,largeur,hauteur,profondeur,quantite,inclinable,couleur\nBorne Standard,0.65,1.75,0.75,10,non,#00f5ff\nBorne Cocktail,0.70,0.80,0.70,5,oui,#ff00aa\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-bornes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseColor = (raw, fallbackIdx) => {
    const c = String(raw || '').replace(/[\s"']/g, '');
    const hex = c.startsWith('#') ? c : c ? '#' + c : '';
    return /^#[0-9a-fA-F]{6}$/i.test(hex) ? hex : COLORS[fallbackIdx % COLORS.length];
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const text = await file.text();
      const rows = text.trim().split(/\r?\n/).slice(1); // skip header, handle CRLF
      const imported = rows.map((row, i) => {
        // strip surrounding quotes from each field (Excel CSV)
        const fields = row.split(/[,;]/).map(f => f.trim().replace(/^"|"$/g, ''));
        const [nom, largeur, hauteur, profondeur, quantite, inclinable, couleur] = fields;
        return {
          id: genId(),
          name: nom || `Borne ${i + 1}`,
          width: parseFloat(largeur) || 0.65,
          height: parseFloat(hauteur) || 1.75,
          depth: parseFloat(profondeur) || 0.75,
          quantity: parseInt(quantite, 10) || 1,
          canTilt: (inclinable || '').toLowerCase() === 'oui',
          color: parseColor(couleur, i),
        };
      }).filter(c => c.name);
      if (imported.length > 0) onChange(imported);
    } else if (ext === 'xls' || ext === 'xlsx') {
      const { read, utils } = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = utils.sheet_to_json(ws, { defval: '' });
      const imported = rows.map((row, i) => {
        const nom = String(row['nom'] || row['Nom'] || row['name'] || '').trim();
        return {
          id: genId(),
          name: nom || `Borne ${i + 1}`,
          width: parseFloat(row['largeur'] || row['Largeur'] || row['width']) || 0.65,
          height: parseFloat(row['hauteur'] || row['Hauteur'] || row['height']) || 1.75,
          depth: parseFloat(row['profondeur'] || row['Profondeur'] || row['depth']) || 0.75,
          quantity: parseInt(row['quantite'] || row['Quantité'] || row['quantity'], 10) || 1,
          canTilt: String(row['inclinable'] || row['canTilt'] || '').toLowerCase() === 'oui',
          color: parseColor(row['couleur'] || row['Couleur'] || row['color'], i),
        };
      }).filter(c => c.name);
      if (imported.length > 0) onChange(imported);
    }
  };

  const totalUnits = cabinets.reduce((s, c) => s + (c.quantity || 0), 0);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span className={styles.panelIcon}>🕹</span>
          Bornes d'arcade
        </div>
        <span className={styles.panelCount}>{totalUnits} unité{totalUnits > 1 ? 's' : ''}</span>
      </div>

      <div className={styles.importBar}>
        <button className={styles.importBtn} onClick={downloadTemplate} title="Télécharger le modèle CSV">
          ↓ Modèle CSV
        </button>
        <button className={styles.importBtn} onClick={() => fileRef.current?.click()} title="Importer CSV ou XLS">
          ↑ Importer CSV/XLS
        </button>
        <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx" style={{ display: 'none' }} onChange={handleImport} />
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
