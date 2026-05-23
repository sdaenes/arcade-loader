import React, { useState } from 'react';
import styles from './ContainerManager.module.css';

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

function ContainerCard({ container, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const vol = (container.width * container.height * container.depth).toFixed(2);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.cardHeaderLeft}>
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
            <label className={styles.fieldLabel}>Nom</label>
            <input
              value={container.name}
              onChange={(e) => onUpdate({ ...container, name: e.target.value })}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Modèle rapide</label>
            <select
              defaultValue=""
              onChange={(e) => {
                const p = FACTORY_PRESETS.find(pr => pr.label === e.target.value);
                if (p) onUpdate({ ...container, ...p, name: container.name || p.label });
              }}
            >
              <option value="">— Choisir un modèle —</option>
              {FACTORY_PRESETS.map(p => (
                <option key={p.label} value={p.label}>
                  {p.label} ({p.width}×{p.height}×{p.depth} m)
                </option>
              ))}
            </select>
          </div>

          <div className={styles.dimsGrid}>
            <NumField label="Largeur (m)" value={container.width}
              onChange={(v) => onUpdate({ ...container, width: v })} />
            <NumField label="Hauteur (m)" value={container.height}
              onChange={(v) => onUpdate({ ...container, height: v })} />
            <NumField label="Profondeur (m)" value={container.depth}
              onChange={(v) => onUpdate({ ...container, depth: v })} />
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Volume intérieur</label>
            <span className={styles.computed}>{vol} m³</span>
          </div>

          {container.notes !== undefined && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Notes</label>
              <textarea
                className={styles.notes}
                rows={2}
                value={container.notes || ''}
                onChange={(e) => onUpdate({ ...container, notes: e.target.value })}
              />
            </div>
          )}

          <button className={styles.deleteBtn} onClick={onDelete}>Supprimer</button>
        </div>
      )}
    </div>
  );
}

export default function ContainerManager({ containerTemplates, onContainerTemplatesChange }) {
  const handleUpdate = (idx, updated) => {
    const next = [...containerTemplates];
    next[idx] = updated;
    onContainerTemplatesChange(next);
  };

  const handleAdd = () => {
    onContainerTemplatesChange([...containerTemplates, {
      id: genId(),
      name: `Contenant ${containerTemplates.length + 1}`,
      width: 2.4,
      height: 2.5,
      depth: 7.0,
      notes: '',
    }]);
  };

  const handleImportPreset = (preset) => {
    onContainerTemplatesChange([...containerTemplates, {
      id: genId(),
      name: preset.label,
      width: preset.width,
      height: preset.height,
      depth: preset.depth,
      notes: '',
    }]);
  };

  return (
    <div className={styles.manager}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🚛</span>
          <div>
            <h2 className={styles.headerTitle}>Gestionnaire de contenants</h2>
            <p className={styles.headerSub}>
              Créez et gérez vos camions, containers et fourgons. Ils apparaîtront comme préréglages dans l'onglet Configuration.
            </p>
          </div>
        </div>
        <span className={styles.count}>{containerTemplates.length} contenant{containerTemplates.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.presetsSection}>
          <div className={styles.presetsTitle}>
            Modèles standards — cliquez pour ajouter
          </div>
          <div className={styles.presetsList}>
            {FACTORY_PRESETS.map(p => (
              <button
                key={p.label}
                className={styles.presetChip}
                onClick={() => handleImportPreset(p)}
              >
                <span className={styles.presetLabel}>{p.label}</span>
                <span className={styles.presetDim}>{p.width}×{p.height}×{p.depth} m</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.list}>
          {containerTemplates.length === 0 && (
            <div className={styles.empty}>
              Aucun contenant défini. Ajoutez des modèles standards ci-dessus ou créez-en un personnalisé.
            </div>
          )}
          {containerTemplates.map((ct, i) => (
            <ContainerCard
              key={ct.id}
              container={ct}
              onUpdate={(updated) => handleUpdate(i, updated)}
              onDelete={() => onContainerTemplatesChange(containerTemplates.filter((_, j) => j !== i))}
            />
          ))}
        </div>

        <button className={styles.newBtn} onClick={handleAdd}>
          + Créer un contenant personnalisé
        </button>
      </div>
    </div>
  );
}
