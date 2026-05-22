import React, { useState, useCallback } from 'react';
import styles from './App.module.css';
import CabinetPanel from './components/CabinetPanel';
import TruckPanel from './components/TruckPanel';
import ResultsView from './components/ResultsView';
import Header from './components/Header';

const API_BASE = process.env.REACT_APP_API_URL || '';

const DEFAULT_CABINETS = [
  { id: 'cab1', name: 'Borne Standard', width: 0.65, height: 1.75, depth: 0.75, quantity: 10, canTilt: false, color: '#00f5ff' },
  { id: 'cab2', name: 'Borne Cocktail', width: 0.70, height: 0.80, depth: 0.70, quantity: 5, canTilt: true, color: '#ff00aa' },
  { id: 'cab3', name: 'Borne Deluxe', width: 0.80, height: 1.85, depth: 0.90, quantity: 6, canTilt: false, color: '#aaff00' },
];

const DEFAULT_TRUCKS = [
  { id: 'truck1', name: 'Camion A', width: 2.4, height: 2.5, depth: 7.0 },
  { id: 'truck2', name: 'Camion B', width: 2.4, height: 2.5, depth: 7.0 },
  { id: 'truck3', name: 'Camion C', width: 2.4, height: 2.5, depth: 7.0 },
];

export default function App() {
  const [cabinets, setCabinets] = useState(DEFAULT_CABINETS);
  const [trucks, setTrucks] = useState(DEFAULT_TRUCKS);
  const [errorMargin, setErrorMargin] = useState(5);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('setup'); // 'setup' | 'results'

  const handleOptimize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cabinets, trucks, errorMargin }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur serveur');
      }
      const data = await response.json();
      setResults(data);
      setActiveTab('results');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [cabinets, trucks, errorMargin]);

  const totalCabinets = cabinets.reduce((s, c) => s + (c.quantity || 1), 0);
  const totalTruckVolume = trucks.reduce((s, t) => s + t.width * t.height * t.depth, 0);

  return (
    <div className={styles.app}>
      <Header />

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'setup' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          <span className={styles.tabIcon}>⚙</span> Configuration
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'results' ? styles.tabActive : ''} ${!results ? styles.tabDisabled : ''}`}
          onClick={() => results && setActiveTab('results')}
        >
          <span className={styles.tabIcon}>📦</span> Résultats
          {results && <span className={styles.tabBadge}>{results.placedCabinets}/{results.totalCabinets}</span>}
        </button>
      </div>

      {activeTab === 'setup' && (
        <div className={styles.setupLayout}>
          <div className={styles.column}>
            <CabinetPanel cabinets={cabinets} onChange={setCabinets} />
          </div>
          <div className={styles.column}>
            <TruckPanel trucks={trucks} onChange={setTrucks} />

            {/* Error margin + optimize */}
            <div className={styles.controlPanel}>
              <div className={styles.marginControl}>
                <div className={styles.marginHeader}>
                  <label className={styles.marginLabel}>Marge d'erreur</label>
                  <span className={styles.marginValue}>{errorMargin}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  step={1}
                  value={errorMargin}
                  onChange={(e) => setErrorMargin(Number(e.target.value))}
                  className={styles.slider}
                />
                <p className={styles.marginHint}>
                  Réduit l'espace utilisable de {errorMargin}% pour tenir compte des imprévus, sangles, protections...
                </p>
              </div>

              <div className={styles.summary}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Bornes totales</span>
                  <span className={styles.summaryValue}>{totalCabinets}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Camions</span>
                  <span className={styles.summaryValue}>{trucks.length}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Volume total</span>
                  <span className={styles.summaryValue}>{totalTruckVolume.toFixed(1)} m³</span>
                </div>
              </div>

              {error && <div className={styles.errorBanner}>⚠ {error}</div>}

              <button
                className={styles.optimizeBtn}
                onClick={handleOptimize}
                disabled={loading || cabinets.length === 0 || trucks.length === 0}
              >
                {loading ? (
                  <span className={styles.loadingDots}>Calcul en cours<span>.</span><span>.</span><span>.</span></span>
                ) : (
                  '🎮 OPTIMISER LE CHARGEMENT'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'results' && results && (
        <ResultsView results={results} trucks={trucks} onBack={() => setActiveTab('setup')} />
      )}
    </div>
  );
}
