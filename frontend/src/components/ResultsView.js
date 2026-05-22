import React, { useState } from 'react';
import styles from './ResultsView.module.css';
import Viewer3D from './Viewer3D';

function FillBar({ rate }) {
  const color = rate > 80 ? '#00ff88' : rate > 50 ? '#ffaa00' : '#ff3355';
  return (
    <div className={styles.fillBar}>
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

export default function ResultsView({ results, trucks, onBack }) {
  const [selectedTruck, setSelectedTruck] = useState(0);
  const activeTruck = results.trucks[selectedTruck];

  const exportData = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arcade-loader-plan-${Date.now()}.json`;
    a.click();
  };

  const exportCSV = () => {
    const rows = [['Camion', 'Borne', 'Instance', 'X (m)', 'Y (m)', 'Z (m)', 'Largeur', 'Hauteur', 'Profondeur', 'Rotation']];
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
      {/* Summary bar */}
      <div className={styles.summaryBar}>
        <div className={`${styles.statusBadge} ${results.success ? styles.statusSuccess : styles.statusWarning}`}>
          {results.success ? '✓ CHARGEMENT OPTIMAL TROUVÉ' : '⚠ CHARGEMENT PARTIEL'}
        </div>
        <div className={styles.summaryStats}>
          <div className={styles.stat}>
            <span className={styles.statVal}>{results.placedCabinets}</span>
            <span className={styles.statLabel}>Bornes placées</span>
          </div>
          <div className={styles.statDivider}>/</div>
          <div className={styles.stat}>
            <span className={styles.statVal}>{results.totalCabinets}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
          <div className={styles.statSep} />
          <div className={styles.stat}>
            <span className={styles.statVal}>{results.trucksUsed}</span>
            <span className={styles.statLabel}>Camion{results.trucksUsed > 1 ? 's' : ''} utilisé{results.trucksUsed > 1 ? 's' : ''}</span>
          </div>
          <div className={styles.statSep} />
          <div className={styles.stat}>
            <span className={styles.statVal}>{results.errorMargin}%</span>
            <span className={styles.statLabel}>Marge</span>
          </div>
        </div>
        <div className={styles.actionBtns}>
          <button className={styles.exportBtn} onClick={exportCSV}>↓ CSV</button>
          <button className={styles.exportBtn} onClick={exportData}>↓ JSON</button>
          <button className={styles.backBtn} onClick={onBack}>← Modifier</button>
        </div>
      </div>

      {/* Tips */}
      {results.tips.length > 0 && (
        <div className={styles.tips}>
          {results.tips.map((tip, i) => <div key={i} className={styles.tip}>{tip}</div>)}
        </div>
      )}

      {/* Unplaced */}
      {results.unplacedCabinets > 0 && (
        <div className={styles.unplaced}>
          <strong>Bornes non placées :</strong>{' '}
          {results.unplacedList.map((u, i) => (
            <span key={i} className={styles.unplacedItem}>{u.name} #{u.unitIndex}</span>
          ))}
        </div>
      )}

      <div className={styles.mainLayout}>
        {/* Truck tabs */}
        <div className={styles.truckTabs}>
          {results.trucks.map((truck, i) => (
            <button
              key={truck.truckId}
              className={`${styles.truckTab} ${selectedTruck === i ? styles.truckTabActive : ''}`}
              onClick={() => setSelectedTruck(i)}
            >
              <div className={styles.truckTabName}>🚛 {truck.truckName}</div>
              <div className={styles.truckTabInfo}>
                <span className={styles.truckTabCount}>{truck.cabinetCount} bornes</span>
                <FillBar rate={truck.fillRate} />
              </div>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className={styles.truckContent}>
          <div className={styles.truckHeader}>
            <h2 className={styles.truckTitle}>{activeTruck.truckName}</h2>
            <div className={styles.truckMeta}>
              <span>
                {activeTruck.dimensions.originalWidth}×{activeTruck.dimensions.originalHeight}×{activeTruck.dimensions.originalDepth} m
                (utile: {activeTruck.dimensions.width.toFixed(2)}×{activeTruck.dimensions.height.toFixed(2)}×{activeTruck.dimensions.depth.toFixed(2)} m)
              </span>
              <span className={styles.truckVolume}>
                {activeTruck.usedVolume} / {activeTruck.totalVolume} m³ — <strong>{activeTruck.fillRate}%</strong>
              </span>
            </div>
          </div>

          <Viewer3D key={selectedTruck} truckData={activeTruck} />

          {/* Placement table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Borne</th>
                  <th>Instance</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Z</th>
                  <th>Dim. (L×H×P)</th>
                  <th>Rotation</th>
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
                      {p.rotation === 0 ? 'Normal' : p.rotation === 90 ? '90°' : p.rotation}
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
