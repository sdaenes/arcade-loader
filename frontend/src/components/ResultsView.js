import React, { useState } from 'react';
import styles from './ResultsView.module.css';
import Viewer3D from './Viewer3D';
import { useLanguage } from '../i18n/LanguageContext';

function FillBar({ rate, label }) {
  const color = rate > 80 ? '#00ff88' : rate > 50 ? '#ffaa00' : '#ff3355';
  return (
    <div className={styles.fillBar}>
      {label && <span className={styles.fillBarUnit}>{label}</span>}
      <div className={styles.fillTrack}>
        <div
          className={styles.fillFill}
          style={{ width: `${Math.min(100, rate)}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
      <span className={styles.fillLabel} style={{ color }}>{rate}%</span>
    </div>
  );
}

export default function ResultsView({ results, trucks, loading, onBack, onOptimizeTighter }) {
  const [selectedTruck, setSelectedTruck] = useState(0);
  const { t } = useLanguage();
  const activeTruck = results.trucks[selectedTruck];

  const currentMargin = results.errorMargin;
  const suggestedMargin = Math.max(-15, currentMargin - 5);
  const canOptimize = results.unplacedCabinets > 0 && suggestedMargin < currentMargin;

  const exportData = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arcade-loader-plan-${Date.now()}.json`;
    a.click();
  };

  const exportCSV = () => {
    const rows = [[t('results.csv.truck'), t('results.csv.cabinet'), 'Instance', 'X (m)', 'Y (m)', 'Z (m)', t('results.csv.width'), t('results.csv.height'), t('results.csv.depth'), 'Rotation']];
    for (const truck of results.trucks) {
      for (const p of truck.placements) {
        rows.push([
          truck.truckName,
          p.cabinetName,
          p.unitIndex,
          p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3),
          p.width.toFixed(3), p.height.toFixed(3), p.depth.toFixed(3),
          p.rotation
        ]);
      }
    }
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arcade-loader-plan-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className={styles.results}>
      <div className={styles.summaryBar}>
        <div className={`${styles.statusBadge} ${results.success ? styles.statusSuccess : styles.statusWarning}`}>
          {results.success ? t('results.success') : t('results.partial')}
        </div>
        <div className={styles.summaryStats}>
          <div className={styles.stat}>
            <span className={styles.statVal}>{results.placedCabinets}</span>
            <span className={styles.statLabel}>{t('results.placed')}</span>
          </div>
          <div className={styles.statDivider}>/</div>
          <div className={styles.stat}>
            <span className={styles.statVal}>{results.totalCabinets}</span>
            <span className={styles.statLabel}>{t('results.total')}</span>
          </div>
          <div className={styles.statSep} />
          <div className={styles.stat}>
            <span className={styles.statVal}>{results.trucksUsed}</span>
            <span className={styles.statLabel}>{t('results.trucks.used', { n: results.trucksUsed })}</span>
          </div>
          <div className={styles.statSep} />
          <div className={styles.stat}>
            <span className={styles.statVal}>{results.errorMargin}%</span>
            <span className={styles.statLabel}>{t('results.margin')}</span>
          </div>
        </div>
        <div className={styles.actionBtns}>
          <button className={styles.exportBtn} onClick={exportCSV}>{t('results.export.csv')}</button>
          <button className={styles.exportBtn} onClick={exportData}>{t('results.export.json')}</button>
          <button className={styles.backBtn} onClick={onBack}>{t('results.back')}</button>
        </div>
      </div>

      {results.tips.length > 0 && (
        <div className={styles.tips}>
          {results.tips.map((tip, i) => <div key={i} className={styles.tip}>{tip}</div>)}
        </div>
      )}

      {canOptimize && (
        <div className={styles.optimizeHint}>
          <span>{t('results.optimize.hint', { n: results.unplacedCabinets })}</span>
          <button
            className={styles.optimizeHintBtn}
            onClick={() => onOptimizeTighter(suggestedMargin)}
            disabled={loading}
          >
            {t('results.optimize.btn', { m: suggestedMargin })}
          </button>
        </div>
      )}

      {results.unplacedCabinets > 0 && (
        <div className={styles.unplaced}>
          <strong>{t('results.unplaced')}</strong>{' '}
          {results.unplacedList.map((u, i) => (
            <span key={i} className={styles.unplacedItem}>{u.name} #{u.unitIndex}</span>
          ))}
        </div>
      )}

      <div className={styles.mainLayout}>
        <div className={styles.truckTabs}>
          {results.trucks.map((truck, i) => (
            <button
              key={truck.truckId}
              className={`${styles.truckTab} ${selectedTruck === i ? styles.truckTabActive : ''}`}
              onClick={() => setSelectedTruck(i)}
            >
              <div className={styles.truckTabName}>🚛 {truck.truckName}</div>
              <div className={styles.truckTabInfo}>
                <span className={styles.truckTabCount}>{t('results.cab.count', { n: truck.cabinetCount })}</span>
                <FillBar rate={truck.fillRate} label="m³" />
                <FillBar rate={truck.fillRateArea} label="m²" />
              </div>
            </button>
          ))}
        </div>

        <div className={styles.truckContent}>
          <div className={styles.truckHeader}>
            <h2 className={styles.truckTitle}>{activeTruck.truckName}</h2>
            <div className={styles.truckMeta}>
              <span>
                {activeTruck.dimensions.originalWidth}×{activeTruck.dimensions.originalHeight}×{activeTruck.dimensions.originalDepth} m
                ({t('results.useful')} {activeTruck.dimensions.width.toFixed(2)}×{activeTruck.dimensions.height.toFixed(2)}×{activeTruck.dimensions.depth.toFixed(2)} m)
              </span>
              <span className={styles.truckVolume}>
                {activeTruck.usedVolume} / {activeTruck.totalVolume} m³ — <strong>{activeTruck.fillRate}%</strong>
              </span>
              <span className={styles.truckArea}>
                {activeTruck.usedArea} / {activeTruck.totalArea} m² — <strong>{activeTruck.fillRateArea}%</strong>
              </span>
            </div>
          </div>

          <Viewer3D key={selectedTruck} truckData={activeTruck} />

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('results.table.cab')}</th>
                  <th>{t('results.table.inst')}</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Z</th>
                  <th>{t('results.table.dims')}</th>
                  <th>{t('results.table.rot')}</th>
                </tr>
              </thead>
              <tbody>
                {activeTruck.placements.map((p, i) => (
                  <tr key={i}>
                    <td className={styles.tdNum}>{i + 1}</td>
                    <td>
                      <span className={styles.colorDot} style={{ background: p.color }} />
                      {p.cabinetName}
                    </td>
                    <td className={styles.tdMono}>#{p.unitIndex}</td>
                    <td className={styles.tdMono}>{p.x.toFixed(2)}</td>
                    <td className={styles.tdMono}>{p.y.toFixed(2)}</td>
                    <td className={styles.tdMono}>{p.z.toFixed(2)}</td>
                    <td className={styles.tdMono}>
                      {p.width.toFixed(2)}×{p.height.toFixed(2)}×{p.depth.toFixed(2)}
                    </td>
                    <td className={styles.tdMono}>
                      {p.rotation === 0 ? t('results.rot.normal') : p.rotation === 90 ? '90°' : p.rotation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
