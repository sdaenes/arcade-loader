import React, { useState, useCallback, useEffect, useRef } from 'react';
import styles from './App.module.css';
import { useLanguage } from './i18n/LanguageContext';
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
  { id: 'setup',      icon: '⚙'  },
  { id: 'results',    icon: '📦' },
  { id: 'manual',     icon: '✏'  },
  { id: 'directory',  icon: '📋' },
  { id: 'categories', icon: '🏷' },
  { id: 'containers', icon: '🚛' },
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
  const { t } = useLanguage();
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
    if (window.confirm(t('app.reset.confirm'))) {
      setCabinets([]);
      setTrucks([]);
      setErrorMargin(5);
      setResults(null);
    }
  };

  const handleResetManual = () => {
    if (window.confirm(t('app.reset.manual.confirm'))) {
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

  const handleAddCabinetToDirectory = useCallback((cab) => {
    const COLORS = ['#00f5ff','#ff00aa','#aaff00','#ffaa00','#aa00ff','#ff5500','#00ffaa','#ff0055'];
    setDirectory(prev => {
      if (prev.some(d => d.name === cab.name)) {
        window.alert(t('cabinet.to.dir.exists', { name: cab.name }));
        return prev;
      }
      return [...prev, {
        id: 'dir_' + Math.random().toString(36).slice(2, 8),
        name: cab.name || '',
        width: cab.width || null,
        height: cab.height || null,
        depth: cab.depth || null,
        weight: null,
        category: null,
        notes: '',
        color: COLORS[prev.length % COLORS.length],
      }];
    });
  }, [t]);

  const handleAddCategory = useCallback((catName) => {
    setCategories(prev => {
      if (prev.some(c => c.name === catName)) return prev;
      return [...prev, { name: catName, color: CAT_COLORS[prev.length % CAT_COLORS.length] }];
    });
  }, []);

  const handleOptimize = useCallback(async (overrideTrucks, overrideMargin) => {
    const trucksToUse = Array.isArray(overrideTrucks) ? overrideTrucks : trucks;
    const marginToUse = typeof overrideMargin === 'number' ? overrideMargin : errorMargin;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cabinets, trucks: trucksToUse, errorMargin: marginToUse }),
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
          const def = TAB_DEFS.find(td => td.id === tabId);
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
              {t(`tab.${tabId}`)}
              {badge !== null && <span className={styles.tabBadge}>{badge}</span>}
            </button>
          );
        })}
        <button
          className={styles.tabReset}
          onClick={activeTab === 'manual' ? handleResetManual : handleReset}
          title={activeTab === 'manual' ? t('app.reset.manual.btn') : t('app.reset.btn')}
        >
          {activeTab === 'manual' ? t('app.reset.manual.btn') : t('app.reset.btn')}
        </button>
      </div>

      {activeTab === 'setup' && (
        <div className={styles.setupLayout}>
          <div className={styles.column}>
            <CabinetPanel cabinets={cabinets} onChange={setCabinets} onAddToDirectory={handleAddCabinetToDirectory} />
          </div>
          <div className={styles.column}>
            <TruckPanel trucks={trucks} onChange={setTrucks} containerTemplates={containerTemplates} />

            <div className={styles.controlPanel}>
              <div className={styles.marginControl}>
                <div className={styles.marginHeader}>
                  <label className={styles.marginLabel}>{t('app.margin.label')}</label>
                  <span className={styles.marginValue}>{errorMargin}%</span>
                </div>
                <input
                  type="range"
                  min={-10}
                  max={30}
                  step={1}
                  value={errorMargin}
                  onChange={(e) => setErrorMargin(Number(e.target.value))}
                  className={styles.slider}
                />
                <p className={styles.marginHint}>{t('app.margin.hint', { n: errorMargin })}</p>
              </div>

              <div className={styles.summary}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>{t('app.summary.cabinets')}</span>
                  <span className={styles.summaryValue}>{totalCabinets}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>{t('app.summary.trucks')}</span>
                  <span className={styles.summaryValue}>{trucks.length}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>{t('app.summary.volume')}</span>
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
                  <span className={styles.loadingDots}>{t('app.calculating')}<span>.</span><span>.</span><span>.</span></span>
                ) : (
                  t('app.optimize')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {results && (
        <div style={{ display: activeTab === 'results' ? undefined : 'none' }}>
          <ResultsView
            results={results}
            trucks={trucks}
            loading={loading}
            onBack={() => setActiveTab('setup')}
            onOptimizeTighter={(m) => { setErrorMargin(m); handleOptimize(undefined, m); }}
          />
        </div>
      )}

      <div style={{ display: activeTab === 'manual' ? undefined : 'none' }}>
        <ManualEditor
          cabinets={cabinets}
          trucks={trucks}
          allPlacements={manualPlacements}
          onPlacementsChange={setManualPlacements}
        />
      </div>

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
