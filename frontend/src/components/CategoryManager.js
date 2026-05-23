import React, { useState, useRef } from 'react';
import styles from './CategoryManager.module.css';

function CategoryRow({ category, onUpdate, onDelete, dragHandlers }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(category);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== category) onUpdate(trimmed);
    else setValue(category);
    setEditing(false);
  };

  return (
    <div className={styles.row} {...dragHandlers}>
      <span className={styles.dragHandle} title="Glisser pour réordonner">⠿</span>
      <span className={styles.chip} />
      {editing ? (
        <input
          className={styles.editInput}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setValue(category); setEditing(false); }
          }}
          autoFocus
        />
      ) : (
        <span className={styles.label} onClick={() => setEditing(true)} title="Cliquer pour renommer">
          {category}
        </span>
      )}
      <button className={styles.deleteBtn} onClick={onDelete} title="Supprimer">✕</button>
    </div>
  );
}

export default function CategoryManager({ categories, onCategoriesChange }) {
  const [newCat, setNewCat] = useState('');
  const dragIdx = useRef(null);

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    onCategoriesChange([...categories, trimmed]);
    setNewCat('');
  };

  const handleUpdate = (idx, newVal) => {
    if (categories.includes(newVal)) return;
    const next = [...categories];
    next[idx] = newVal;
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
            <h2 className={styles.headerTitle}>Catégories de bornes</h2>
            <p className={styles.headerSub}>
              Gérez les catégories utilisées dans l'annuaire. Cliquez sur un nom pour le renommer, glissez pour réordonner.
            </p>
          </div>
        </div>
        <span className={styles.count}>{categories.length} catégorie{categories.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.list}>
          {categories.length === 0 && (
            <div className={styles.empty}>
              Aucune catégorie définie. Ajoutez-en ci-dessous.
            </div>
          )}
          {categories.map((cat, i) => (
            <CategoryRow
              key={cat + i}
              category={cat}
              onUpdate={(val) => handleUpdate(i, val)}
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
            className={styles.addInput}
            placeholder="Nouvelle catégorie…"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            className={styles.addBtn}
            onClick={handleAdd}
            disabled={!newCat.trim() || categories.includes(newCat.trim())}
          >
            + Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
