import React, { useState, useCallback, useEffect, useRef } from 'react';
import styles from './App.module.css';
import CabinetPanel from './components/CabinetPanel';
import TruckPanel from './components/TruckPanel';
import ResultsView from './components/ResultsView';
import ManualEditor from './components/ManualEditor';
import CabinetDirectory from './components/CabinetDirectory';
import ContainerManager from './components/ContainerManager';
import CategoryManager from './components/CategoryManager';
import Header from './components/Header';

const API_BASE = process.env.REACT_APP_API_URL || '';

const DEFAULT_CATEGORIES = [
  { name: 'Candy',    color: '#00f5ff' },
  { name: 'Gun Cab',  color: '#ff00aa' },
  { name: 'Race Cab', color: '#aaff00' },
  { name: 'Upright',  color: '#ffaa00' },
  { name: 'Cocktail', color: '#aa00ff' },
  { name: 'Sit-Down', color: '#ff5500' },
  { name: 'HD',       color: '#00ffaa' },
  { name: 'Deluxe',   color: '#ff0055' },
];
const CAT_COLORS = ['#00f5ff','#ff00aa','#aaff00','#ffaa00','#aa00ff','#ff5500','#00ffaa','#ff0055'];

const TAB_DEFS = [
  { id: 'setup',      icon: '⚙',  label: 'Configuration' },
  { id: 'results',    icon: '📦', label: 'Résultats' },
  { id: 'manual',     icon: '✏',  label: 'Placement manuel' },
  { id: 'directory',  icon: '📋', label: 'Annuaire' },
  { id: 'categories', icon: '🏷', label: 'Catégories' },
  { id: 'containers', icon: '🚛', label: 'Contenants' },
];
const DEFAULT_TAB_ORDER = TAB_DEFS.map(t => t.id);

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
  const [categories, setCategories] = useState(() => {
    const saved = loadSaved('al_categories', DEFAULT_CATEGORIES);
    // Migrate old string-array format to object-array format
    if (saved.length > 0 && typeof saved[0] === 'string') {
      return saved.map((name, i) => ({ name, color: CAT_COLORS[i % CAT_COLORS.length] }));
    }
    return saved;
  });
  const [tabOrder, setTabOrder] = useState(() => {
    const saved = loadSaved('al_taborder', null);
    if (!saved) return DEFAULT_TAB_ORDER;
    const knownIds = TAB_DEFS.map(t => t.id);
    const filtered = saved.filter(id => knownIds.includes(id));
    const missing = knownIds.filter(id => !filtered.includes(id));
    return [...filtered, ...missing];
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('setup');
  const tabDragIdx = useRef(null);

  useEffect(() => { localStorage.setItem('al_cabinets', JSON.stringify(cabinets)); }, [cabinets]);
  useEffect(() => { localStorage.setItem('al_trucks', JSON.stringify(trucks)); }, [trucks]);
  useEffect(() => { localStorage.setItem('al_margin', JSON.stringify(errorMargin)); }, [errorMargin]);
  useEffect(() => { localStorage.setItem('al_manual', JSON.stringify(manualPlacements)); }, [manualPlacements]);
  useEffect(() => { localStorage.setItem('al_directory', JSON.stringify(directory)); }, [directory]);
  useEffect(() => { localStorage.setItem('al_containers', JSON.stringify(containerTemplates)); }, [containerTemplates]);
  useEffect(() => { localStorage.setItem('al_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('al_taborder', JSON.stringify(tabOrder)); }, [tabOrder]);

  const handleReset = () => {
    if (window.confirm(
      'Réinitialiser la configuration ?\n\n' +
      'Les bornes et camions de l\'onglet Configuration seront effacés.\n' +
      'L\'annuaire, les catégories, les contenants et les placements manuels sont conservés.'
    )) {
      setCabinets([]);
      setTrucks([]);
      setErrorMargin(5);
      setResults(null);
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

  const handleAddCategory = useCallback((catName) => {
    setCategories(prev => {
      if (prev.some(c => c.name === catName)) return prev;
      return [...prev, { name: catName, color: CAT_COLORS[prev.length % CAT_COLORS.length] }];
    });
  }, []);

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
        {tabOrder.map((tabId, i) => {
          const def = TAB_DEFS.find(t => t.id === tabId);
          if (!def) return null;
          const isDisabled = tabId === 'results' && !results;
          let badge = null;
          if (tabId === 'results' && results) badge = `${results.placedCabinets}/${results.totalCabinets}`;
          if (tabId === 'directory' && directory.length > 0) badge = directory.length;
          if (tabId === 'containers' && containerTemplates.length > 0) badge = containerTemplates.length;
          return (
            <button
              key={tabId}
              className={`${styles.tab} ${activeTab === tabId ? styles.tabActive : ''} ${isDisabled ? styles.tabDisabled : ''}`}
              onClick={() => !isDisabled && setActiveTab(tabId)}
              draggable
              onDragStart={() => { tabDragIdx.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = tabDragIdx.current;
                if (from === null || from === i) return;
                const next = [...tabOrder];
                const [item] = next.splice(from, 1);
                next.splice(i, 0, item);
                setTabOrder(next);
              }}
            >
              <span className={styles.tabIcon}>{def.icon}</span>
              {def.label}
              {badge !== null && <span className={styles.tabBadge}>{badge}</span>}
            </button>
          );
        })}
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
          categories={categories}
          onAddCategory={handleAddCategory}
        />
      )}

      {activeTab === 'categories' && (
        <CategoryManager
          categories={categories}
          onCategoriesChange={setCategories}
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
