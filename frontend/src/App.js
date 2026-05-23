import React, { useState, useCallback, useEffect } from 'react';
import styles from './App.module.css';
import CabinetPanel from './components/CabinetPanel';
import TruckPanel from './components/TruckPanel';
import ResultsView from './components/ResultsView';
import ManualEditor from './components/ManualEditor';
import CabinetDirectory from './components/CabinetDirectory';
import ContainerManager from './components/ContainerManager';
import Header from './components/Header';

const API_BASE = process.env.REACT_APP_API_URL || '';

const DEFAULT_CABINETS = [
  { id: 'cab1', name: 'Borne Standard', width: 0.65, height: 1.75, depth: 0.75, quantity: 1, canTilt: false, color: '#00f5ff' },
];

const DEFAULT_TRUCKS = [
  { id: 'truck1', name: 'Camion A', width: 2.4, height: 2.5, depth: 7.0 },
];

function loadSaved(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [cabinets, setCabinets] = useState(() => loadSaved('al_cabinets', DEFAULT_CABINETS));
  const [trucks, setTrucks] = useState(() => loadSaved('al_trucks', DEFAULT_TRUCKS));
  const [errorMargin, setErrorMargin] = useState(() => loadSaved('al_margin', 5));
  const [manualPlacements, setManualPlacements] = useState(() => loadSaved('al_manual', {}));
  const [directory, setDirectory] = useState(() => loadSaved('al_directory', []));
  const [containerTemplates, setContainerTemplates] = useState(() => loadSaved('al_containers', []));
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('setup'); // 'setup' | 'results' | 'manual' | 'directory' | 'containers'

  useEffect(() => { localStorage.setItem('al_cabinets', JSON.stringify(cabinets)); }, [cabinets]);
  useEffect(() => { localStorage.setItem('al_trucks', JSON.stringify(trucks)); }, [trucks]);
  useEffect(() => { localStorage.setItem('al_margin', JSON.stringify(errorMargin)); }, [errorMargin]);
  useEffect(() => { localStorage.setItem('al_manual', JSON.stringify(manualPlacements)); }, [manualPlacements]);
  useEffect(() => { localStorage.setItem('al_directory', JSON.stringify(directory)); }, [directory]);
  useEffect(() => { localStorage.setItem('al_containers', JSON.stringify(containerTemplates)); }, [containerTemplates]);

  const handleReset = () => {
    if (window.confirm('Réinitialiser toutes les valeurs aux valeurs par défaut ?')) {
      setCabinets(DEFAULT_CABINETS);
      setTrucks(DEFAULT_TRUCKS);
      setErrorMargin(5);
      setManualPlacements({});
    }
  };

  const handleAddFromDirectory = useCallback((cab) => {
    const COLORS = ['#00f5ff','#ff00aa','#aaff00','#ffaa00','#aa00ff','#ff5500','#00ffaa','#ff0055'];
    const colorIdx = cabinets.length % COLORS.length;
    setCabinets(prev => [...prev, {
      id: 'cab_' + Math.random().toString(36).slice(2, 7),
      name: cab.name || 'Borne',
      width: cab.width || 0.65,
      height: cab.height || 1.75,
      depth: cab.depth || 0.75,
      quantity: 1,
      canTilt: false,
      color: cab.color || COLORS[colorIdx],
    }]);
    setActiveTab('setup');
  }, [cabinets.length]);

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

  const totalCabinets = cabinets.reduce((s, c) => s + (c.quantity || 0), 0);
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
        <button
          className={`${styles.tab} ${activeTab === 'manual' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          <span className={styles.tabIcon}>✏</span> Placement manuel
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'directory' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          <span className={styles.tabIcon}>📋</span> Annuaire
          {directory.length > 0 && <span className={styles.tabBadge}>{directory.length}</span>}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'containers' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('containers')}
        >
          <span className={styles.tabIcon}>🚛</span> Contenants
          {containerTemplates.length > 0 && <span className={styles.tabBadge}>{containerTemplates.length}</span>}
        </button>
        <button className={styles.tabReset} onClick={handleReset} title="Réinitialiser aux valeurs par défaut">
          ↺ Reset Configuration
        </button>
      </div>

      {activeTab === 'setup' && (
        <div className={styles.setupLayout}>
          <div className={styles.column}>
            <CabinetPanel cabinets={cabinets} onChange={setCabinets} />
          </div>
          <div className={styles.column}>
            <TruckPanel trucks={trucks} onChange={setTrucks} containerTemplates={containerTemplates} />

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

      {activeTab === 'manual' && (
        <ManualEditor
          cabinets={cabinets}
          trucks={trucks}
          allPlacements={manualPlacements}
          onPlacementsChange={setManualPlacements}
        />
      )}

      {activeTab === 'directory' && (
        <CabinetDirectory
          directory={directory}
          onDirectoryChange={setDirectory}
          onAddToConfig={handleAddFromDirectory}
        />
      )}

      {activeTab === 'containers' && (
        <ContainerManager
          containerTemplates={containerTemplates}
          onContainerTemplatesChange={setContainerTemplates}
        />
      )}
    </div>
  );
}
