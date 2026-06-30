import React, { useState, useCallback, useRef, useMemo } from 'react';
import styles from './CabinetDirectory.module.css';
import { useLanguage } from '../i18n/LanguageContext';

const API_BASE = process.env.REACT_APP_API_URL || '';
const COLORS = ['#00f5ff','#ff00aa','#aaff00','#ffaa00','#aa00ff','#ff5500','#00ffaa','#ff0055'];
const CACHE_KEY = 'al_cabinet_search_cache';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

function getCacheKey(name, lang) { return `${name.trim().toLowerCase()}|${lang}`; }

function readCache(name, lang) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entry = store[getCacheKey(name, lang)];
    if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  } catch {}
  return null;
}

function writeCache(name, lang, data) {
  try {
    const store = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    store[getCacheKey(name, lang)] = { ts: Date.now(), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

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

function CabinetCard({ cab, onUpdate, onDelete, onAddToList, dragHandlers = {}, categories, onAddCategory, onDetails }) {
  const { draggable: isDraggable, onDragStart, ...dropHandlers } = dragHandlers;
  const [expanded, setExpanded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const abortRef = useRef(null);
  const { t, lang } = useLanguage();

  const stopSearch = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const doSearch = useCallback(async (deep) => {
    setSearching(deep ? 'deep' : 'quick');
    setSearchError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Vérifier le cache avant tout appel API (sauf recherche approfondie forcée)
      let data = !deep ? readCache(cab.name, lang) : null;

      if (!data) {
        const res = await fetch(`${API_BASE}/api/search-cabinet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: cab.name, deep, categories: categories.map(c => c.name), lang }),
          signal: controller.signal,
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur serveur');

        // Mettre en cache si des dimensions ont été trouvées
        if (data.width || data.height || data.depth) writeCache(cab.name, lang, data);
      }

      if (
        data.suggestedNewCategory &&
        !categories.some(c => c.name === data.suggestedNewCategory) &&
        window.confirm(t('dir.suggest.cat', { name: data.suggestedNewCategory }))
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
      if (e.name !== 'AbortError') setSearchError(e.message);
    } finally {
      setSearching(false);
      abortRef.current = null;
    }
  }, [cab, onUpdate, categories, onAddCategory, t, lang]);

  return (
    <div className={styles.card} style={{ borderLeftColor: cab.color }} {...dropHandlers}>
      <div className={styles.cardHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.cardHeaderLeft}>
          <span
            className={styles.dragHandle}
            draggable={isDraggable}
            onDragStart={onDragStart}
            onClick={(e) => e.stopPropagation()}
            title={t('common.drag')}
          >⠿</span>
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
            title={t('dir.details')}
          >
            {t('dir.details')}
          </button>
          <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.cardBody}>
          <Field label={t('dir.field.name')} value={cab.name}
            onChange={(v) => onUpdate({ ...cab, name: v })} />

          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('dir.field.category')}</label>
            <select
              value={cab.category || ''}
              onChange={(e) => onUpdate({ ...cab, category: e.target.value || null })}
            >
              <option value="">{t('dir.uncategorized')}</option>
              {categories.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.dimsGrid}>
            <Field label={t('dir.field.width')} type="number" value={cab.width ?? ''} unit="m"
              onChange={(v) => onUpdate({ ...cab, width: v })} />
            <Field label={t('dir.field.height')} type="number" value={cab.height ?? ''} unit="m"
              onChange={(v) => onUpdate({ ...cab, height: v })} />
            <Field label={t('dir.field.depth')} type="number" value={cab.depth ?? ''} unit="m"
              onChange={(v) => onUpdate({ ...cab, depth: v })} />
            <Field label={t('dir.field.weight')} type="number" value={cab.weight ?? ''} unit="kg"
              onChange={(v) => onUpdate({ ...cab, weight: v })} />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('dir.field.notes')}</label>
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
                ? <span className={styles.dots}>{t('dir.searching')}<span>.</span><span>.</span><span>.</span></span>
                : t('dir.search.quick')}
            </button>
            <button className={styles.deepBtn} onClick={() => doSearch(true)}
              disabled={!!searching || !cab.name.trim()}>
              {searching === 'deep'
                ? <span className={styles.dots}>{t('dir.analyzing')}<span>.</span><span>.</span><span>.</span></span>
                : t('dir.search.deep')}
            </button>
            {!!searching && (
              <button className={styles.stopBtn} onClick={stopSearch}>
                {t('dir.search.stop')}
              </button>
            )}
            <button className={styles.addBtn}
              onClick={() => onAddToList(cab)}
              disabled={!cab.width || !cab.height || !cab.depth}>
              {t('dir.add.config')}
            </button>
            <button className={styles.deleteBtn} onClick={onDelete}>{t('dir.delete')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CabinetDirectory({ directory, onDirectoryChange, onAddToConfig, categories = [], onAddCategory }) {
  const dragIdx = useRef(null);
  const [sortBy, setSortBy] = useState('manual');
  const [filterCat, setFilterCat] = useState('');
  const [detailsCab, setDetailsCab] = useState(null);
  const { t } = useLanguage();

  const SORT_OPTIONS = [
    { value: 'manual',   label: t('dir.sort.manual') },
    { value: 'name',     label: t('dir.sort.name') },
    { value: 'category', label: t('dir.sort.category') },
    { value: 'weight',   label: t('dir.sort.weight') },
    { value: 'volume',   label: t('dir.sort.volume') },
  ];

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
            <h2 className={styles.headerTitle}>{t('dir.title')}</h2>
            <p className={styles.headerSub}>{t('dir.subtitle')}</p>
          </div>
        </div>
        <span className={styles.count}>{t('dir.count', { n: directory.length })}</span>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <label className={styles.toolbarLabel}>{t('dir.sort.label')}</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className={styles.toolbarGroup}>
          <label className={styles.toolbarLabel}>{t('dir.filter.label')}</label>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">{t('dir.filter.all')}</option>
            {categories.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
          </select>
        </div>
        {filterCat && (
          <button className={styles.clearFilter} onClick={() => setFilterCat('')}>{t('dir.filter.clear')}</button>
        )}
      </div>

      <div className={styles.list}>
        {displayList.length === 0 && (
          <div className={styles.empty}>
            {directory.length === 0 ? t('dir.empty.dir') : t('dir.empty.filter')}
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

      <button className={styles.newBtn} onClick={handleAdd}>{t('dir.new')}</button>

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
                { label: t('dir.modal.width'),  value: detailsCab.width  != null ? `${detailsCab.width} m`  : '—' },
                { label: t('dir.modal.height'), value: detailsCab.height != null ? `${detailsCab.height} m` : '—' },
                { label: t('dir.modal.depth'),  value: detailsCab.depth  != null ? `${detailsCab.depth} m`  : '—' },
                { label: t('dir.modal.weight'), value: detailsCab.weight != null ? `${detailsCab.weight} kg` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className={styles.modalField}>
                  <span className={styles.modalFieldLabel}>{label}</span>
                  <span className={styles.modalFieldValue}>{value}</span>
                </div>
              ))}
            </div>
            {detailsCab.notes && (
              <div>
                <div className={styles.modalFieldLabel} style={{ marginBottom: '0.4rem' }}>{t('dir.modal.notes')}</div>
                <p className={styles.modalNotes}>{detailsCab.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
