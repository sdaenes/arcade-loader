import React, { useState, useRef } from 'react';
import styles from './CategoryManager.module.css';
import { useLanguage } from '../i18n/LanguageContext';

function CategoryRow({ category, onUpdate, onDelete, dragHandlers }) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(category.name);
  const { t } = useLanguage();

  const commit = () => {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== category.name) onUpdate({ ...category, name: trimmed });
    else setNameVal(category.name);
    setEditing(false);
  };

  return (
    <div className={styles.row} {...dragHandlers}>
      <span className={styles.dragHandle} title={t('common.drag')}>⠿</span>
      <input
        type="color"
        className={styles.colorInput}
        value={category.color || '#888888'}
        title={t('cat.color.hint')}
        onChange={(e) => onUpdate({ ...category, color: e.target.value })}
      />
      {editing ? (
        <input
          className={styles.editInput}
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setNameVal(category.name); setEditing(false); }
          }}
          autoFocus
        />
      ) : (
        <span
          className={styles.label}
          style={{ color: category.color }}
          onClick={() => setEditing(true)}
          title={t('cat.rename.hint')}
        >
          {category.name}
        </span>
      )}
      <button className={styles.deleteBtn} onClick={onDelete} title="Supprimer">{t('cat.delete')}</button>
    </div>
  );
}

export default function CategoryManager({ categories, onCategoriesChange }) {
  const [newCat, setNewCat] = useState('');
  const [newColor, setNewColor] = useState('#00f5ff');
  const dragIdx = useRef(null);
  const { t } = useLanguage();

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed || categories.some(c => c.name === trimmed)) return;
    onCategoriesChange([...categories, { name: trimmed, color: newColor }]);
    setNewCat('');
  };

  const handleUpdate = (idx, updated) => {
    if (categories.some((c, i) => i !== idx && c.name === updated.name)) return;
    const next = [...categories];
    next[idx] = updated;
    onCategoriesChange(next);
  };

  const handleDelete = (idx) => {
    onCategoriesChange(categories.filter((_, i) => i !== idx));
  };

  return (
    <div className={styles.manager}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🏷</span>
          <div>
            <h2 className={styles.headerTitle}>{t('cat.title')}</h2>
            <p className={styles.headerSub}>{t('cat.subtitle')}</p>
          </div>
        </div>
        <span className={styles.count}>{t('cat.count', { n: categories.length })}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.list}>
          {categories.length === 0 && (
            <div className={styles.empty}>{t('cat.empty')}</div>
          )}
          {categories.map((cat, i) => (
            <CategoryRow
              key={cat.name + i}
              category={cat}
              onUpdate={(updated) => handleUpdate(i, updated)}
              onDelete={() => handleDelete(i)}
              dragHandlers={{
                draggable: true,
                onDragStart: () => { dragIdx.current = i; },
                onDragOver: (e) => e.preventDefault(),
                onDrop: () => {
                  const from = dragIdx.current;
                  if (from === null || from === i) return;
                  const next = [...categories];
                  const [item] = next.splice(from, 1);
                  next.splice(i, 0, item);
                  onCategoriesChange(next);
                },
              }}
            />
          ))}
        </div>

        <div className={styles.addBar}>
          <input
            type="color"
            className={styles.colorInput}
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            title={t('cat.color.hint')}
          />
          <input
            className={styles.addInput}
            placeholder={t('cat.placeholder')}
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            className={styles.addBtn}
            onClick={handleAdd}
            disabled={!newCat.trim() || categories.some(c => c.name === newCat.trim())}
          >
            {t('cat.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
