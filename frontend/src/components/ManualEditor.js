import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import styles from './ManualEditor.module.css';
import { useLanguage } from '../i18n/LanguageContext';
import PlacementManager from './PlacementManager';

function genId() { return 'mp_' + Math.random().toString(36).slice(2, 9); }

const PADDING = 40; // canvas padding in px

function getScale(truck, canvasW, canvasH) {
  const scaleX = (canvasW - PADDING * 2) / (truck.width || 1);
  const scaleY = (canvasH - PADDING * 2) / (truck.depth || 1);
  return Math.min(scaleX, scaleY);
}

function toCanvas(x, z, scale) {
  return { cx: PADDING + x * scale, cy: PADDING + z * scale };
}

function fromCanvas(cx, cy, scale) {
  return { x: (cx - PADDING) / scale, z: (cy - PADDING) / scale };
}

export default function ManualEditor({ cabinets, trucks, allPlacements, onPlacementsChange }) {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const [truckIdx, setTruckIdx] = useState(0);
  const [activeCabId, setActiveCabId] = useState(null); // cabinet type id being placed
  const [selectedId, setSelectedId] = useState(null);   // placed instance id
  const dragRef = useRef(null); // { id, offsetX, offsetZ }
  const [orientations, setOrientations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('al_manual_orientations') || '{}'); } catch { return {}; }
  });

  const setAllPlacements = onPlacementsChange;

  const truck = trucks[truckIdx] || trucks[0];

  const effectiveTruck = useMemo(() => {
    if (!truck) return null;
    return orientations[truck.id]
      ? { ...truck, width: truck.depth, depth: truck.width }
      : truck;
  }, [truck, orientations]);
  const placements = useMemo(
    () => (truck && allPlacements[truck.id]) || [],
    [truck, allPlacements]
  );

  const cabCounts = cabinets.map(cab => {
    const placed = Object.values(allPlacements).reduce(
      (sum, tp) => sum + tp.filter(p => p.cabId === cab.id).length, 0
    );
    return { ...cab, placed, remaining: (cab.quantity || 0) - placed };
  });

  const activeCab = cabinets.find(c => c.id === activeCabId);

  const setPlacements = useCallback((next) => {
    setAllPlacements(prev => ({ ...prev, [truck.id]: typeof next === 'function' ? next(prev[truck.id] || []) : next }));
  }, [truck, setAllPlacements]);

  // ── Drawing ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !effectiveTruck) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const scale = getScale(effectiveTruck, W, H);

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth = 1;
    const step = scale * 0.5;
    for (let x = PADDING; x <= PADDING + effectiveTruck.width * scale; x += step) {
      ctx.beginPath(); ctx.moveTo(x, PADDING); ctx.lineTo(x, PADDING + effectiveTruck.depth * scale); ctx.stroke();
    }
    for (let y = PADDING; y <= PADDING + effectiveTruck.depth * scale; y += step) {
      ctx.beginPath(); ctx.moveTo(PADDING, y); ctx.lineTo(PADDING + effectiveTruck.width * scale, y); ctx.stroke();
    }

    // Truck outline
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.strokeRect(PADDING, PADDING, effectiveTruck.width * scale, effectiveTruck.depth * scale);

    // Dimension labels
    ctx.fillStyle = '#ffaa00';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${effectiveTruck.width} m`, PADDING + (effectiveTruck.width * scale) / 2, PADDING - 8);
    ctx.save();
    ctx.translate(PADDING - 10, PADDING + (effectiveTruck.depth * scale) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${effectiveTruck.depth} m`, 0, 0);
    ctx.restore();

    // Placements
    for (const p of placements) {
      const { cx, cy } = toCanvas(p.x, p.z, scale);
      const pw = (p.rotation === 90 ? p.depth : p.width) * scale;
      const pd = (p.rotation === 90 ? p.width : p.depth) * scale;
      const isSelected = p.id === selectedId;

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = p.color;
      ctx.fillRect(cx, cy, pw, pd);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = isSelected ? '#ffffff' : p.color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.strokeRect(cx, cy, pw, pd);

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(9, Math.min(13, pw / 6))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name;
      ctx.fillText(label, cx + pw / 2, cy + pd / 2);
      ctx.textBaseline = 'alphabetic';
    }

    // Ghost preview
    if (activeCab && dragRef.current?.ghost) {
      const g = dragRef.current.ghost;
      const pw = activeCab.width * scale;
      const pd = activeCab.depth * scale;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = activeCab.color;
      ctx.fillRect(g.cx - pw / 2, g.cy - pd / 2, pw, pd);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = activeCab.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(g.cx - pw / 2, g.cy - pd / 2, pw, pd);
      ctx.setLineDash([]);
    }

    // Info line
    ctx.fillStyle = 'rgba(255,170,0,0.8)';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${effectiveTruck.name}  |  ${effectiveTruck.width}×${effectiveTruck.depth} m  (${t('manual.canvas.view')})`, PADDING, H - 12);
    ctx.fillText(t('manual.canvas.placed', { n: placements.length }), W - 160, H - 12);
  }, [effectiveTruck, placements, selectedId, activeCab, t]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    localStorage.setItem('al_manual_orientations', JSON.stringify(orientations));
  }, [orientations]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      draw();
    });
    observer.observe(canvas);
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    draw();
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hit test
  const hitTest = useCallback((cx, cy) => {
    const canvas = canvasRef.current;
    if (!canvas || !effectiveTruck) return null;
    const scale = getScale(effectiveTruck, canvas.width, canvas.height);
    for (let i = placements.length - 1; i >= 0; i--) {
      const p = placements[i];
      const { cx: px, cy: py } = toCanvas(p.x, p.z, scale);
      const pw = (p.rotation === 90 ? p.depth : p.width) * scale;
      const pd = (p.rotation === 90 ? p.width : p.depth) * scale;
      if (cx >= px && cx <= px + pw && cy >= py && cy <= py + pd) return p;
    }
    return null;
  }, [effectiveTruck, placements]);

  // Mouse events
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top };
  };

  const handleMouseDown = (e) => {
    const { cx, cy } = getPos(e);
    const canvas = canvasRef.current;
    const scale = getScale(effectiveTruck, canvas.width, canvas.height);

    if (activeCab) {
      const counts = cabCounts.find(c => c.id === activeCab.id);
      if (counts && counts.remaining <= 0) return;
      const { x, z } = fromCanvas(cx, cy, scale);
      const px = Math.max(0, Math.min(effectiveTruck.width - activeCab.width, x - activeCab.width / 2));
      const pz = Math.max(0, Math.min(effectiveTruck.depth - activeCab.depth, z - activeCab.depth / 2));
      const newPlacement = {
        id: genId(),
        cabId: activeCab.id,
        name: activeCab.name,
        color: activeCab.color,
        x: px, z: pz,
        width: activeCab.width,
        height: activeCab.height,
        depth: activeCab.depth,
        rotation: 0,
      };
      setPlacements(prev => [...prev, newPlacement]);
      setSelectedId(newPlacement.id);
      return;
    }

    const hit = hitTest(cx, cy);
    if (hit) {
      setSelectedId(hit.id);
      const { cx: hx, cy: hy } = toCanvas(hit.x, hit.z, scale);
      dragRef.current = { id: hit.id, offX: cx - hx, offZ: cy - hy };
    } else {
      setSelectedId(null);
    }
  };

  const handleMouseMove = (e) => {
    const { cx, cy } = getPos(e);
    const canvas = canvasRef.current;
    const scale = getScale(effectiveTruck, canvas.width, canvas.height);

    if (activeCab) {
      dragRef.current = { ...dragRef.current, ghost: { cx, cy } };
      draw();
      return;
    }

    if (!dragRef.current?.id) return;
    const { id, offX, offZ } = dragRef.current;
    const p = placements.find(pl => pl.id === id);
    if (!p) return;
    const { x: rawX, z: rawZ } = fromCanvas(cx - offX, cy - offZ, scale);
    const pw = p.rotation === 90 ? p.depth : p.width;
    const pd = p.rotation === 90 ? p.width : p.depth;
    const nx = Math.max(0, Math.min(effectiveTruck.width - pw, rawX));
    const nz = Math.max(0, Math.min(effectiveTruck.depth - pd, rawZ));
    setPlacements(prev => prev.map(pl => pl.id === id ? { ...pl, x: nx, z: nz } : pl));
  };

  const handleMouseUp = () => {
    if (!activeCab) dragRef.current = null;
  };

  const handleMouseLeave = () => {
    if (activeCab) { dragRef.current = { ...dragRef.current, ghost: null }; draw(); }
    else dragRef.current = null;
  };

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setActiveCabId(null); setSelectedId(null); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !e.target.closest('input')) {
        setPlacements(prev => prev.filter(p => p.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === 'r' && selectedId) {
        setPlacements(prev => prev.map(p => p.id === selectedId ? { ...p, rotation: p.rotation === 0 ? 90 : 0 } : p));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, setPlacements]);

  const rotateSelected = () => {
    if (!selectedId) return;
    setPlacements(prev => prev.map(p => p.id === selectedId ? { ...p, rotation: p.rotation === 0 ? 90 : 0 } : p));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setPlacements(prev => prev.filter(p => p.id !== selectedId));
    setSelectedId(null);
  };

  const clearAll = () => {
    if (window.confirm(t('manual.clear.confirm'))) {
      setPlacements([]);
      setSelectedId(null);
    }
  };

  const resetAllPlacements = () => {
    if (window.confirm(t('manual.reset.confirm'))) {
      onPlacementsChange({});
      setSelectedId(null);
    }
  };

  const exportJSON = () => {
    const data = trucks.map(t => ({
      truckId: t.id,
      truckName: t.name,
      placements: (allPlacements[t.id] || []),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `placement-manuel-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const rows = [['Camion','Borne','X (m)','Z (m)','Largeur','Hauteur','Profondeur','Rotation']];
    for (const t of trucks) {
      for (const p of (allPlacements[t.id] || [])) {
        rows.push([t.name, p.name, p.x.toFixed(3), p.z.toFixed(3), p.width, p.height, p.depth, p.rotation]);
      }
    }
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `placement-manuel-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.editor}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sideSection}>
          <div className={styles.sideTitle}>{t('manual.section.truck')}</div>
          {trucks.map((tr, i) => (
            <div key={tr.id} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <button
                className={`${styles.truckBtn} ${truckIdx === i ? styles.truckBtnActive : ''}`}
                style={{ flex: 1 }}
                onClick={() => { setTruckIdx(i); setSelectedId(null); setActiveCabId(null); }}
              >
                🚛 {tr.name}
                <span className={styles.truckDim}>{tr.width}×{tr.depth} m</span>
              </button>
              <button
                title={orientations[tr.id] ? 'Vue paysage (cliquer pour portrait)' : 'Vue portrait (cliquer pour paysage)'}
                style={{
                  flexShrink: 0,
                  background: orientations[tr.id] ? 'rgba(255,170,0,0.15)' : 'transparent',
                  border: `1px solid ${orientations[tr.id] ? '#ffaa00' : 'var(--border)'}`,
                  borderRadius: '4px',
                  color: orientations[tr.id] ? '#ffaa00' : 'var(--text-dim)',
                  fontSize: '0.75rem',
                  padding: '0.35rem 0.45rem',
                  cursor: 'pointer',
                }}
                onClick={() => setOrientations(prev => ({ ...prev, [tr.id]: !prev[tr.id] }))}
              >
                🔄
              </button>
            </div>
          ))}
        </div>

        <PlacementManager
          allPlacements={allPlacements}
          onLoad={onPlacementsChange}
        />

        <div className={styles.sideSection}>
          <div className={styles.sideTitle}>
            {t('manual.section.cabs')}
            <span className={styles.sideTip}>{t('manual.section.cabs.tip')}</span>
          </div>
          {cabCounts.map(cab => (
            <button
              key={cab.id}
              className={`${styles.cabBtn} ${activeCabId === cab.id ? styles.cabBtnActive : ''} ${cab.remaining <= 0 ? styles.cabBtnExhausted : ''}`}
              style={{ '--cab-color': cab.color }}
              onClick={() => {
                setActiveCabId(activeCabId === cab.id ? null : cab.id);
                setSelectedId(null);
              }}
            >
              <span className={styles.cabDot} style={{ background: cab.color }} />
              <span className={styles.cabName}>{cab.name}</span>
              <span className={styles.cabCount}>{cab.placed}/{cab.quantity}</span>
            </button>
          ))}
        </div>

        <div className={styles.sideSection}>
          <div className={styles.sideTitle}>{t('manual.section.actions')}</div>
          <button className={styles.actionBtn} onClick={rotateSelected} disabled={!selectedId}>
            {t('manual.rotate')}
          </button>
          <button className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={deleteSelected} disabled={!selectedId}>
            {t('manual.delete')}
          </button>
          <button className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={clearAll}>
            {t('manual.clear')}
          </button>
        </div>

        <div className={styles.sideSection}>
          <div className={styles.sideTitle}>{t('manual.section.export')}</div>
          <button className={styles.actionBtn} onClick={exportJSON}>↓ JSON</button>
          <button className={styles.actionBtn} onClick={exportCSV}>↓ CSV</button>
        </div>

        <div className={styles.sideSection}>
          <div className={styles.sideTitle}>{t('manual.section.reset')}</div>
          <button className={`${styles.actionBtn} ${styles.actionDanger}`} onClick={resetAllPlacements}>
            {t('manual.reset.all')}
          </button>
        </div>

        <div className={styles.sideLegend}>
          <p>{t('manual.legend.click')}</p>
          <p>{t('manual.legend.drag')}</p>
          <p>{t('manual.legend.r')}</p>
          <p>{t('manual.legend.del')}</p>
        </div>
      </div>

      {/* Canvas area */}
      <div className={styles.canvasWrap}>
        {activeCab && (
          <div className={styles.modeBanner} style={{ borderColor: activeCab.color, color: activeCab.color }}>
            {t('manual.mode.banner', { name: activeCab.name })}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ cursor: activeCab ? 'crosshair' : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  );
}
