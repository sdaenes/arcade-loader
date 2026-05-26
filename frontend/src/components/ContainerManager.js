import React, { useState, useRef } from 'react';
import styles from './ContainerManager.module.css';
import { useLanguage } from '../i18n/LanguageContext';

function genId() { return 'ct_' + Math.random().toString(36).slice(2, 8); }

const FACTORY_PRESETS = [
  { label: 'Fourgon 12m³',   width: 2.1,  height: 2.2,  depth: 2.6  },
  { label: 'Camion 20m³',    width: 2.4,  height: 2.5,  depth: 7.0  },
  { label: 'Camion 30m³',    width: 2.4,  height: 2.5,  depth: 8.5  },
  { label: 'Semi 90m³',      width: 2.4,  height: 2.5,  depth: 13.6 },
  { label: "Container 20'",  width: 2.35, height: 2.39, depth: 5.90 },
  { label: "Container 40'",  width: 2.35, height: 2.39, depth: 12.03 },
];

function NumField({ label, value, onChange }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <input
        type="number"
        step={0.01}
        min={0}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
      />
    </div>
  );
}

function ContainerCard({ container, onUpdate, onDelete, dragHandlers }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();
  const vol = (container.width * container.height * container.depth).toFixed(2);

  return (
    <div className={styles.card} {...dragHandlers}>
      <div className={styles.cardHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.cardHeaderLeft}>
          <span className={styles.dragHandle} title={t('common.drag')}>⠿</span>
          <span className={styles.icon}>📦</span>
          <span className={styles.cardName}>{container.name || '—'}</span>
          <span className={styles.volBadge}>{vol} m³</span>
        </div>
        <div className={styles.cardHeaderRight}>
          <span className={styles.cardDims}>
            {container.width}×{container.height}×{container.depth} m
          </span>
          <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.cardBody}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('ct.field.name')}</label>
            <input
              value={container.name}
              onChange={(e) => onUpdate({ ...container, name: e.target.value })}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('ct.field.preset')}</label>
            <select
              defaultValue=""
              onChange={(e) => {
                const p = FACTORY_PRESETS.find(pr => pr.label === e.target.value);
                if (p) onUpdate({ ...container, ...p, name: container.name || p.label });
              }}
            >
              <option value="">{t('ct.preset.select')}</option>
              {FACTORY_PRESETS.map(p => (
                <option key={p.label} value={p.label}>
                  {p.label} ({p.width}×{p.height}×{p.depth} m)
                </option>
              ))}
            </select>
          </div>

          <div className={styles.dimsGrid}>
            <NumField label={t('ct.field.width')} value={container.width}
              onChange={(v) => onUpdate({ ...container, width: v })} />
            <NumField label={t('ct.field.height')} value={container.height}
              onChange={(v) => onUpdate({ ...container, height: v })} />
            <NumField label={t('ct.field.depth')} value={container.depth}
              onChange={(v) => onUpdate({ ...container, depth: v })} />
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>{t('ct.field.vol')}</label>
            <span className={styles.computed}>{vol} m³</span>
          </div>

          {container.notes !== undefined && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>{t('ct.field.notes')}</label>
              <textarea
                className={styles.notes}
                rows={2}
                value={container.notes || ''}
                onChange={(e) => onUpdate({ ...container, notes: e.target.value })}
              />
            </div>
          )}

          <button className={styles.deleteBtn} onClick={onDelete}>{t('ct.delete')}</button>
        </div>
      )}
    </div>
  );
}

export default function ContainerManager({ containerTemplates, onContainerTemplatesChange }) {
  const dragIdx = useRef(null);
  const { t } = useLanguage();

  const handleUpdate = (idx, updated) => {
    const next = [...containerTemplates];
    next[idx] = updated;
    onContainerTemplatesChange(next);
  };

  const handleAdd = () => {
    onContainerTemplatesChange([...containerTemplates, {
      id: genId(),
      name: t('ct.default.name', { n: containerTemplates.length + 1 }),
      width: 2.4,
      height: 2.5,
      depth: 7.0,
      notes: '',
    }]);
  };

  return (
    <div className={styles.manager}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🚛</span>
          <div>
            <h2 className={styles.headerTitle}>{t('ct.title')}</h2>
            <p className={styles.headerSub}>{t('ct.subtitle')}</p>
          </div>
        </div>
        <span className={styles.count}>{t('ct.count', { n: containerTemplates.length })}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.list}>
          {containerTemplates.length === 0 && (
            <div className={styles.empty}>{t('ct.empty')}</div>
          )}
          {containerTemplates.map((ct, i) => (
            <ContainerCard
              key={ct.id}
              container={ct}
              onUpdate={(updated) => handleUpdate(i, updated)}
              onDelete={() => onContainerTemplatesChange(containerTemplates.filter((_, j) => j !== i))}
              dragHandlers={{
                draggable: true,
                onDragStart: () => { dragIdx.current = i; },
                onDragOver: (e) => e.preventDefault(),
                onDrop: () => {
                  const from = dragIdx.current;
                  if (from === null || from === i) return;
                  const next = [...containerTemplates];
                  const [item] = next.splice(from, 1);
                  next.splice(i, 0, item);
                  onContainerTemplatesChange(next);
                },
              }}
            />
          ))}
        </div>

        <button className={styles.newBtn} onClick={handleAdd}>
          {t('ct.add')}
        </button>
      </div>
    </div>
  );
}
