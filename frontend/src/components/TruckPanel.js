import React, { useState, useRef } from 'react';
import styles from './Panel.module.css';
import { useLanguage } from '../i18n/LanguageContext';

function genId() { return 'truck_' + Math.random().toString(36).slice(2, 7); }

function TruckRow({ truck, onChange, onDelete, presets, dragHandlers }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();

  return (
    <div className={styles.itemCard} style={{ borderLeftColor: '#ffaa00' }} {...dragHandlers}>
      <div className={styles.itemHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.itemHeaderLeft}>
          <span className={styles.dragHandle} title={t('common.drag')}>⠿</span>
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
            <label>{t('truck.field.name')}</label>
            <input value={truck.name} onChange={(e) => onChange({ ...truck, name: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', display: 'block', marginBottom: '0.4rem' }}>
              {t('truck.field.preset')}
            </label>
            <select
              defaultValue=""
              onChange={(e) => {
                const val = e.target.value;
                const p = presets.find(p => (p.name || p.label) === val);
                if (p) onChange({ ...truck, width: p.width, height: p.height, depth: p.depth });
              }}
            >
              <option value="">{t('truck.preset.select')}</option>
              {presets.length === 0 && (
                <option disabled value="">{t('truck.preset.none')}</option>
              )}
              {presets.map(p => {
                const label = p.name || p.label;
                return (
                  <option key={p.id || label} value={label}>
                    {label} ({p.width}×{p.height}×{p.depth} m)
                  </option>
                );
              })}
            </select>
          </div>
          <div className={styles.dimsGrid}>
            <div className={styles.fieldRow}>
              <label>{t('truck.field.width')}</label>
              <input type="number" step={0.01} min={0}
                value={truck.width}
                onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange({ ...truck, width: v }); }} />
            </div>
            <div className={styles.fieldRow}>
              <label>{t('truck.field.height')}</label>
              <input type="number" step={0.01} min={0}
                value={truck.height}
                onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange({ ...truck, height: v }); }} />
            </div>
            <div className={styles.fieldRow}>
              <label>{t('truck.field.depth')}</label>
              <input type="number" step={0.01} min={0}
                value={truck.depth}
                onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange({ ...truck, depth: v }); }} />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <label>{t('truck.field.vol')}</label>
            <span className={styles.computed}>
              {(truck.width * truck.height * truck.depth).toFixed(2)} m³
            </span>
          </div>
          <button className={styles.deleteBtn} onClick={onDelete}>{t('truck.delete')}</button>
        </div>
      )}
    </div>
  );
}

export default function TruckPanel({ trucks, onChange, containerTemplates = [] }) {
  const dragIdx = useRef(null);
  const { t } = useLanguage();

  const handleChange = (idx, updated) => {
    const next = [...trucks];
    next[idx] = updated;
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...trucks, {
      id: genId(),
      name: t('truck.default.name', { n: trucks.length + 1 }),
      width: 2.4, height: 2.5, depth: 7.0,
    }]);
  };

  const totalVol = trucks.reduce((s, t) => s + t.width * t.height * t.depth, 0);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span className={styles.panelIcon}>🚛</span>
          {t('truck.title')}
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
            dragHandlers={{
              draggable: true,
              onDragStart: () => { dragIdx.current = i; },
              onDragOver: (e) => e.preventDefault(),
              onDrop: () => {
                const from = dragIdx.current;
                if (from === null || from === i) return;
                const next = [...trucks];
                const [item] = next.splice(from, 1);
                next.splice(i, 0, item);
                onChange(next);
              },
            }}
          />
        ))}
      </div>

      <button className={styles.addBtn} onClick={handleAdd}>
        {t('truck.add')}
      </button>
    </div>
  );
}
