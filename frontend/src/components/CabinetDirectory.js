import React, { useState, useCallback, useRef, useMemo } from 'react';
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

function CabinetCard({ cab, onUpdate, onDelete, onAddToList, dragHandlers, categories, onAddCategory, onDetails }) {
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
        body: JSON.stringify({ name: cab.name, deep, categories: categories.map(c => c.name) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');

      if (
        data.suggestedNewCategory &&
        !categories.some(c => c.name === data.suggestedNewCategory) &&
        window.confirm(`Claude propose d'ajouter la catégorie "${data.suggestedNewCategory}". L'ajouter à la liste ?`)
      ) {
        onAddCategory(data.suggestedNewCategory);
      }

      onUpdate({
        ...cab,
        width:    data.width    ?? cab.width,
        height:   data.height   ?? cab.height,
        depth:    data.depth    ?? cab.depth,
        weight:   data.weight   ?? cab.weight,
        category: data.category ?? cab.category,
        notes:    data.notes    || cab.notes,
      });
      setExpanded(true);
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  }, [cab, onUpdate, categories, onAddCategory]);

  return (
    <div className={styles.card} style={{ borderLeftColor: cab.color }} {...dragHandlers}>
      <div className={styles.cardHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.cardHeaderLeft}>
          <span className={styles.dragHandle} title="Glisser pour réordonner">⠿</span>
          <span className={styles.dot} style={{ background: cab.color }} />
          <span className={styles.cardName}>{cab.name || '—'}</span>
          {cab.category && (() => {
            const catObj = categories.find(c => c.name === cab.category);
            const col = catObj?.color || '#888888';
            return (
              <span className={styles.catBadge} style={{ color: col, borderColor: col + '66', background: col + '18' }}>
                {cab.category}
              </span>
            );
          })()}
          {cab.weight != null && <span className={styles.cardMeta}>{cab.weight} kg</span>}
        </div>
        <div className={styles.cardHeaderRight}>
          {cab.width && cab.height && cab.depth && (
            <span className={styles.cardDims}>{cab.width}×{cab.height}×{cab.depth} m</span>
          )}
          <button
            className={styles.detailsBtn}
            onClick={(e) => { e.stopPropagation(); onDetails(cab); }}
            title="Voir les détails"
          >
            Détails
          </button>
          <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.cardBody}>
          <Field label="Nom de la borne" value={cab.name}
            onChange={(v) => onUpdate({ ...cab, name: v })} />

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Catégorie</label>
            <select
              value={cab.category || ''}
              onChange={(e) => onUpdate({ ...cab, category: e.target.value || null })}
            >
              <option value="">— Non catégorisé —</option>
              {categories.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

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

          {searchError && <div className={styles.searchError}>⚠ {searchError}</div>}

          <div className={styles.cardActions}>
            <button className={styles.searchBtn} onClick={() => doSearch(false)}
              disabled={!!searching || !cab.name.trim()}>
              {searching === 'quick'
                ? <span className={styles.dots}>Recherche<span>.</span><span>.</span><span>.</span></span>
                : '✦ Rechercher via Claude'}
            </button>
            <button className={styles.deepBtn} onClick={() => doSearch(true)}
              disabled={!!searching || !cab.name.trim()}>
              {searching === 'deep'
                ? <span className={styles.dots}>Analyse<span>.</span><span>.</span><span>.</span></span>
                : '⚡ Recherche approfondie'}
            </button>
            <button className={styles.addBtn}
              onClick={() => onAddToList(cab)}
              disabled={!cab.width || !cab.height || !cab.depth}>
              + Ajouter à la config
            </button>
            <button className={styles.deleteBtn} onClick={onDelete}>Supprimer</button>
          </div>
        </div>
      )}
    </div>
  );
}

const SORT_OPTIONS = [
  { value: 'manual',   label: 'Ordre manuel' },
  { value: 'name',     label: 'Nom A→Z' },
  { value: 'category', label: 'Catégorie' },
  { value: 'weight',   label: 'Poids ↑' },
  { value: 'volume',   label: 'Volume L×l×H ↑' },
];

export default function CabinetDirectory({ directory, onDirectoryChange, onAddToConfig, categories = [], onAddCategory }) {
  const dragIdx = useRef(null);
  const [sortBy, setSortBy] = useState('manual');
  const [filterCat, setFilterCat] = useState('');
  const [detailsCab, setDetailsCab] = useState(null);

  const handleUpdate = (id, updated) => {
    onDirectoryChange(directory.map(c => c.id === id ? updated : c));
  };

  const handleDelete = (id) => {
    onDirectoryChange(directory.filter(c => c.id !== id));
  };

  const handleAdd = () => {
    const colorIdx = directory.length % COLORS.length;
    onDirectoryChange([...directory, {
      id: genId(), name: '', width: null, height: null, depth: null,
      weight: null, category: null, notes: '', color: COLORS[colorIdx],
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

  const displayList = useMemo(() => {
    let list = filterCat ? directory.filter(c => c.category === filterCat) : [...directory];
    if (sortBy === 'name')     list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortBy === 'category') list.sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));
    if (sortBy === 'weight')   list.sort((a, b) => (a.weight ?? Infinity) - (b.weight ?? Infinity));
    if (sortBy === 'volume')   list.sort((a, b) => ((a.width||0)*(a.height||0)*(a.depth||0)) - ((b.width||0)*(b.height||0)*(b.depth||0)));
    return list;
  }, [directory, sortBy, filterCat]);

  const isDragEnabled = sortBy === 'manual' && !filterCat;

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

      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <label className={styles.toolbarLabel}>Trier par</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className={styles.toolbarGroup}>
          <label className={styles.toolbarLabel}>Filtrer</label>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">Toutes les catégories</option>
            {categories.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
          </select>
        </div>
        {filterCat && (
          <button className={styles.clearFilter} onClick={() => setFilterCat('')}>✕ Effacer le filtre</button>
        )}
      </div>

      <div className={styles.list}>
        {displayList.length === 0 && (
          <div className={styles.empty}>
            {directory.length === 0
              ? 'Aucune borne dans l\'annuaire. Cliquez sur "Ajouter une borne" pour commencer.'
              : 'Aucune borne ne correspond au filtre sélectionné.'}
          </div>
        )}
        {displayList.map((cab) => {
          const origIdx = directory.findIndex(c => c.id === cab.id);
          return (
            <CabinetCard
              key={cab.id}
              cab={cab}
              categories={categories}
              onAddCategory={onAddCategory}
              onUpdate={(updated) => handleUpdate(cab.id, updated)}
              onDelete={() => handleDelete(cab.id)}
              onAddToList={handleAddToConfig}
              onDetails={setDetailsCab}
              dragHandlers={isDragEnabled ? {
                draggable: true,
                onDragStart: () => { dragIdx.current = origIdx; },
                onDragOver: (e) => e.preventDefault(),
                onDrop: () => {
                  const from = dragIdx.current;
                  if (from === null || from === origIdx) return;
                  const next = [...directory];
                  const [item] = next.splice(from, 1);
                  next.splice(origIdx, 0, item);
                  onDirectoryChange(next);
                },
              } : {}}
            />
          );
        })}
      </div>

      <button className={styles.newBtn} onClick={handleAdd}>+ Ajouter une borne</button>

      {detailsCab && (
        <div className={styles.modalOverlay} onClick={() => setDetailsCab(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleRow}>
                <h3 className={styles.modalTitle}>{detailsCab.name || '—'}</h3>
                {detailsCab.category && (() => {
                  const catObj = categories.find(c => c.name === detailsCab.category);
                  const col = catObj?.color || '#888';
                  return (
                    <span className={styles.catBadge} style={{ color: col, borderColor: col + '66', background: col + '18' }}>
                      {detailsCab.category}
                    </span>
                  );
                })()}
              </div>
              <button className={styles.modalClose} onClick={() => setDetailsCab(null)}>✕</button>
            </div>
            <div className={styles.modalGrid}>
              {[
                { label: 'Largeur', value: detailsCab.width != null ? `${detailsCab.width} m` : '—' },
                { label: 'Hauteur', value: detailsCab.height != null ? `${detailsCab.height} m` : '—' },
                { label: 'Profondeur', value: detailsCab.depth != null ? `${detailsCab.depth} m` : '—' },
                { label: 'Poids', value: detailsCab.weight != null ? `${detailsCab.weight} kg` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className={styles.modalField}>
                  <span className={styles.modalFieldLabel}>{label}</span>
                  <span className={styles.modalFieldValue}>{value}</span>
                </div>
              ))}
            </div>
            {detailsCab.notes && (
              <div>
                <div className={styles.modalFieldLabel} style={{ marginBottom: '0.4rem' }}>Notes</div>
                <p className={styles.modalNotes}>{detailsCab.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
