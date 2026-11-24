import React, { useEffect, useState } from 'react';
import { ChartImage } from './ChartImage';
import { useTrading } from '../context/TradingContext';
import {
  Layers,
  FileText,
  DollarSign,
  Compass,
  Plus,
  Trash2,
  ExternalLink,
  Edit3,
  Shield,
  Activity,
  Camera,
  Star,
  Archive,
  History,
} from 'lucide-react';
import { AssetCategory, BiasType, Scenario, LiquidityZone, AssetChartScreenshot, DeskChartPlacement } from '../types';
import { MultiImageDropzone, ImageThumbGrid } from './ImageUploadDropzone';
import { ImageViewerModal, LightboxImage } from './ImageViewerModal';
import { PendingSetupsPanel } from './PendingSetupsPanel';
import { MarketContextStrip } from './MarketContextStrip';
import { LevelsLadder } from './LevelsLadder';
import { DeskAnalysisLifecycle } from './DeskAnalysisLifecycle';
import { DeskAnalysisFinishDialog } from './DeskAnalysisFinishDialog';
import type { DeskAnalysisScope } from '../lib/deskAnalysisHistoryStore';
import { DeskDecompositionStack } from './decomposition/DeskDecompositionStack';
import { useDecompositionData } from '../context/DecompositionDataContext';
import { mapLevels, mapPois, resolvePoi } from '../decomposition';
import { fmtPrice } from './decomposition/ui';

const PLACEMENT_LABEL: Record<DeskChartPlacement, string> = {
  narrative: 'Narrative',
  monthly: 'Monthly',
  weekly: 'Weekly',
  daily: 'Daily',
  h4: '4H',
};

const inputClass = 'bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 outline-none focus:border-cyan-500 font-sans';

export const AssetDesksView: React.FC = () => {
  const { assets, selectedAssetId, setSelectedAssetId, updateAssetDesk, createInstrument, updateInstrument, archiveInstrument, desksLoading, desksError, pendingSetups, deskTabRequest, setDeskTabRequest, calendarEvents, setActiveTab } = useTrading();
  const { mapFor, requestDecompose } = useDecompositionData();

  const currentDesk = assets.find(a => a.id === selectedAssetId) || assets[0];
  const pendingCount = currentDesk ? pendingSetups.filter((p) => p.deskId === currentDesk.id && p.status === 'PENDING').length : 0;

  type DeskTab = 'overview' | 'levels' | 'wyckoff' | 'scenarios' | 'charts' | 'setups' | 'history';
  const [activeSubTab, setActiveSubTab] = useState<DeskTab>('overview');
  // Open a specific sub-tab when another screen asks (e.g. the Dashboard's pending setups).
  useEffect(() => {
    if (deskTabRequest) { setActiveSubTab((deskTabRequest === 'external' ? 'overview' : deskTabRequest === 'liquidity' ? 'levels' : deskTabRequest) as DeskTab); setDeskTabRequest(null); }
  }, [deskTabRequest, setDeskTabRequest]);

  // Narrative edit
  const [editingNarrative, setEditingNarrative] = useState(false);
  const [narrativeDraft, setNarrativeDraft] = useState('');

  // HTF structure edit
  const [editingHTF, setEditingHTF] = useState(false);
  const [htfDraft, setHtfDraft] = useState({ monthly: '', weekly: '', daily: '', h4: '' });

  // Wyckoff edit
  const [editingWyckoff, setEditingWyckoff] = useState(false);
  const [wyckoffPhaseDraft, setWyckoffPhaseDraft] = useState('');
  const [wyckoffNotesDraft, setWyckoffNotesDraft] = useState('');
  const [newEvent, setNewEvent] = useState('');

  // Scenario add
  const [showAddScenario, setShowAddScenario] = useState(false);
  const [scenarioProbability, setScenarioProbability] = useState<Scenario['probability']>('PRIMARY');
  const [scenarioThesis, setScenarioThesis] = useState('');
  const [scenarioConfirm, setScenarioConfirm] = useState('');
  const [scenarioInvalidate, setScenarioInvalidate] = useState('');
  const [scenarioPoiIds, setScenarioPoiIds] = useState<string[]>([]);

  // Chart/screenshot attachments
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const openLightbox = (charts: AssetChartScreenshot[], index: number) => {
    setLightboxImages(charts.map((c): LightboxImage => ({ url: c.url, title: c.title, timeframe: c.timeframe })));
    setLightboxIndex(index);
    setLightboxOpen(true);
  };
  const [newChartTitle, setNewChartTitle] = useState('');
  const [instrumentFormOpen, setInstrumentFormOpen] = useState(false);
  const [instrumentError, setInstrumentError] = useState<string | null>(null);
  const [instrumentDraft, setInstrumentDraft] = useState({ symbol: '', name: '', canonicalSymbol: '', category: 'CRYPTO' as AssetCategory, tradingViewSymbol: '' });
  const [finishScope, setFinishScope] = useState<DeskAnalysisScope | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  useEffect(() => { setFinishScope(null); setAnalysisNotice(null); }, [currentDesk?.id]);

  if (desksLoading) {
    return (
      <div className="p-6">
        <p className="text-xs font-mono text-slate-500">Loading Asset Desks…</p>
      </div>
    );
  }
  if (desksError) {
    return (
      <div className="p-6">
        <p className="text-sm font-mono text-rose-400">{desksError}</p>
      </div>
    );
  }
  if (!currentDesk) {
    return (
      <div className="p-6">
        <p className="text-xs font-mono text-slate-500">No asset desks yet.</p>
      </div>
    );
  }

  const startEditNarrative = () => {
    setNarrativeDraft(currentDesk.currentNarrative);
    setEditingNarrative(true);
  };
  const saveNarrative = () => {
    updateAssetDesk(currentDesk.id, { currentNarrative: narrativeDraft });
    setEditingNarrative(false);
  };

  const startEditHTF = () => {
    setHtfDraft(currentDesk.htfStructure);
    setEditingHTF(true);
  };
  const saveHTF = () => {
    updateAssetDesk(currentDesk.id, { htfStructure: htfDraft });
    setEditingHTF(false);
  };

  const startEditWyckoff = () => {
    setWyckoffPhaseDraft(currentDesk.wyckoffDevelopment.phase);
    setWyckoffNotesDraft(currentDesk.wyckoffDevelopment.notes);
    setEditingWyckoff(true);
  };
  const saveWyckoff = () => {
    updateAssetDesk(currentDesk.id, {
      wyckoffDevelopment: { ...currentDesk.wyckoffDevelopment, phase: wyckoffPhaseDraft, notes: wyckoffNotesDraft },
    });
    setEditingWyckoff(false);
  };
  const addWyckoffEvent = () => {
    if (!newEvent.trim()) return;
    updateAssetDesk(currentDesk.id, {
      wyckoffDevelopment: { ...currentDesk.wyckoffDevelopment, eventsIdentified: [...currentDesk.wyckoffDevelopment.eventsIdentified, newEvent.trim()] },
    });
    setNewEvent('');
  };
  const removeWyckoffEvent = (idx: number) => {
    updateAssetDesk(currentDesk.id, {
      wyckoffDevelopment: { ...currentDesk.wyckoffDevelopment, eventsIdentified: currentDesk.wyckoffDevelopment.eventsIdentified.filter((_, i) => i !== idx) },
    });
  };

  const addCharts = (urls: string[], placement?: DeskChartPlacement) => {
    if (!urls.length) return;
    const base = placement
      ? `${currentDesk.symbol} ${PLACEMENT_LABEL[placement]}`
      : newChartTitle.trim() || `${currentDesk.symbol} Chart`;
    const now = Date.now();
    const charts: AssetChartScreenshot[] = urls.map((url, i) => ({
      id: `chart-${now}-${i}`,
      title: urls.length > 1 ? `${base} (${i + 1})` : base,
      timeframe: placement && placement !== 'narrative' ? PLACEMENT_LABEL[placement] : '',
      url,
      uploadedAt: new Date().toISOString(),
      category: placement === 'narrative' ? 'BIAS' : 'GENERAL',
      ...(placement ? { placement } : {}),
    }));
    updateAssetDesk(currentDesk.id, { charts: [...(currentDesk.charts || []), ...charts] });
    if (!placement) setNewChartTitle('');
  };
  const chartsAt = (placement: DeskChartPlacement) => (currentDesk.charts || []).filter((c) => c.placement === placement);
  const setChartPlacement = (chartId: string, placement: DeskChartPlacement | '') => {
    updateAssetDesk(currentDesk.id, {
      charts: (currentDesk.charts || []).map((c) => {
        if (c.id !== chartId) return c;
        const { placement: _old, ...rest } = c;
        return placement
          ? { ...rest, placement, timeframe: placement !== 'narrative' ? PLACEMENT_LABEL[placement] : rest.timeframe }
          : rest;
      }),
    });
  };
  /** Charts shown next to a block of text, with their own upload area. */
  const renderPlacedCharts = (placement: DeskChartPlacement, readOnly = false) => {
    const list = chartsAt(placement);
    if (readOnly) return list.length ? <div className="pt-1"><ImageThumbGrid images={list.map((c) => c.url)} onView={(i) => openLightbox(list, i)} /></div> : null;
    return (
      <div className="space-y-1.5 pt-1">
        <ImageThumbGrid
          images={list.map((c) => c.url)}
          onView={(i) => openLightbox(list, i)}
          onRemove={(i) => removeChart(list[i].id)}
        />
        <MultiImageDropzone compact onAdd={(urls) => addCharts(urls, placement)} sublabel="" />
      </div>
    );
  };
  const removeChart = (chartId: string) => {
    updateAssetDesk(currentDesk.id, { charts: (currentDesk.charts || []).filter(c => c.id !== chartId) });
  };

  const handleBiasChange = (bias: BiasType) => updateAssetDesk(currentDesk.id, { currentBias: bias });

  const addScenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioThesis.trim()) return;
    const usedLabels = currentDesk.scenarios.map(s => s.label);
    const label = (['Scenario A', 'Scenario B', 'Scenario C'] as const).find(l => !usedLabels.includes(l)) ?? 'Scenario C';
    const newScenario: Scenario = {
      id: `sc-${Date.now().toString().slice(-4)}`,
      label,
      probability: scenarioProbability,
      thesis: scenarioThesis.trim(),
      confirmationConditions: scenarioConfirm.split('\n').map(s => s.trim()).filter(Boolean),
      invalidationConditions: scenarioInvalidate.split('\n').map(s => s.trim()).filter(Boolean),
      ...(scenarioPoiIds.length ? { poiIds: scenarioPoiIds } : {}),
    };
    updateAssetDesk(currentDesk.id, { scenarios: [...currentDesk.scenarios, newScenario] });
    setScenarioThesis('');
    setScenarioConfirm('');
    setScenarioInvalidate('');
    setScenarioPoiIds([]);
    setShowAddScenario(false);
  };
  const deleteScenario = (id: string) => updateAssetDesk(currentDesk.id, { scenarios: currentDesk.scenarios.filter(s => s.id !== id) });
  const saveInstrument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!instrumentDraft.symbol.trim() || !instrumentDraft.name.trim() || !instrumentDraft.canonicalSymbol.trim()) { setInstrumentError('Display symbol, name, and canonical symbol are required.'); return; }
    try { setInstrumentError(null); await createInstrument(instrumentDraft); setInstrumentFormOpen(false); setInstrumentDraft({ symbol: '', name: '', canonicalSymbol: '', category: 'CRYPTO', tradingViewSymbol: '' }); }
    catch (error) { setInstrumentError(error instanceof Error ? error.message : 'Could not save instrument. Symbols must be unique.'); }
  };
  const editCurrentInstrument = async () => {
    const symbol = window.prompt('Display symbol', currentDesk.symbol); if (symbol === null) return;
    const name = window.prompt('Instrument name', currentDesk.name); if (name === null) return;
    const canonicalSymbol = window.prompt('Canonical symbol (for example BTCUSDT)', currentDesk.symbol); if (canonicalSymbol === null) return;
    const category = window.prompt('Category: CRYPTO, INDICES, METALS, FX, EQUITIES, or OTHER', currentDesk.category); if (category === null) return;
    const tradingViewSymbol = window.prompt('TradingView symbol (optional)', currentDesk.tradingViewSymbol) ?? '';
    try { await updateInstrument(currentDesk.id, { symbol, name, canonicalSymbol, category: category.toUpperCase() as AssetCategory, tradingViewSymbol }); } catch (error) { setInstrumentError(error instanceof Error ? error.message : 'Could not update instrument.'); }
  };
  const archiveCurrentInstrument = async () => { if (!window.confirm(`Archive ${currentDesk.symbol}? Its desk notes and historical data are retained.`)) return; try { await archiveInstrument(currentDesk.id); } catch (error) { setInstrumentError(error instanceof Error ? error.message : 'Could not archive instrument.'); } };
  const toggleWatchlist = (assetId: string, next: boolean) => { updateAssetDesk(assetId, { watchlisted: next }); };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Asset Desk Selector Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {assets.map(asset => {
            const isSelected = asset.id === currentDesk.id;
            return (
              <div
                key={asset.id}
                className={`flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-lg font-mono text-xs transition ${
                  isSelected ? 'bg-raised text-cyan-300 border border-cyan-500/40 font-bold shadow-sm' : 'bg-panel text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleWatchlist(asset.id, !asset.watchlisted); }}
                  title={asset.watchlisted ? 'Unstar: remove from Today' : 'Star: pin this analysis on Today'}
                  className={`p-1 rounded hover:bg-slate-700/60 transition ${asset.watchlisted ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  <Star className="w-3 h-3" fill={asset.watchlisted ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => setSelectedAssetId(asset.id)}
                  className="flex items-center gap-2"
                >
                  <span>{asset.symbol}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-sans ${
                      asset.currentBias.includes('BULL') || asset.currentBias.includes('ACC')
                        ? 'bg-emerald-950 text-emerald-300'
                        : asset.currentBias.includes('BEAR') || asset.currentBias.includes('DIST')
                        ? 'bg-rose-950 text-rose-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {asset.currentBias}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <button onClick={() => setInstrumentFormOpen(v => !v)} className="bg-panel hover:bg-raised text-ink-2 border border-line text-sm font-medium px-3 py-1.5 rounded-lg">+ Add market</button>
      </div>
      {instrumentError && <p className="text-xs font-mono text-rose-400">{instrumentError}</p>}
      {instrumentFormOpen && <form onSubmit={saveInstrument} className="bg-panel border border-slate-800 rounded-xl p-4 grid gap-3 md:grid-cols-2"><h3 className="md:col-span-2 text-sm font-mono font-bold text-slate-100">Add instrument / pair</h3>{([['Display symbol', 'symbol'], ['Name', 'name'], ['Canonical symbol', 'canonicalSymbol'], ['TradingView symbol (optional)', 'tradingViewSymbol']] as const).map(([title, field]) => <label key={field} className="text-[10px] font-mono text-slate-400">{title}<input required={field !== 'tradingViewSymbol'} value={instrumentDraft[field]} onChange={e => setInstrumentDraft({ ...instrumentDraft, [field]: e.target.value })} className={`${inputClass} w-full mt-1`} /></label>)}<label className="text-[10px] font-mono text-slate-400">Category<select value={instrumentDraft.category} onChange={e => setInstrumentDraft({ ...instrumentDraft, category: e.target.value as AssetCategory })} className={`${inputClass} w-full mt-1`}>{(['CRYPTO', 'INDICES', 'METALS', 'FX', 'EQUITIES', 'OTHER'] as AssetCategory[]).map(category => <option key={category}>{category}</option>)}</select></label><p className="md:col-span-2 text-xs text-slate-400">Use separate records for BTCUSD and BTCUSDT. Archive hides an instrument from new selectors without deleting desk/history.</p><button className="w-fit px-3 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold">Save instrument</button></form>}

      {/* Desk Subheader */}
      <div className="bg-panel border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-xl font-bold text-slate-100">{currentDesk.symbol}</h2>
            <span className="text-xs text-slate-400 font-mono">({currentDesk.name})</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">{currentDesk.category}</span>
          </div>
          {currentDesk.tradingViewSymbol && (
            <a
              href={`https://www.tradingview.com/chart/?symbol=${currentDesk.tradingViewSymbol}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 w-fit"
            >
              <span>View on TradingView</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Current bias:</span>
          <select
            value={currentDesk.currentBias}
            onChange={e => handleBiasChange(e.target.value as BiasType)}
            className="max-w-full bg-raised border border-slate-700 rounded px-3 py-1.5 text-xs font-mono font-bold text-cyan-300 outline-none focus:border-cyan-500"
          >
            <option value="BULLISH">BULLISH (Expansion)</option>
            <option value="BEARISH">BEARISH (Markdown)</option>
            <option value="ACCUMULATION">ACCUMULATION (Phase A/B/C)</option>
            <option value="DISTRIBUTION">DISTRIBUTION (Phase A/B/C)</option>
            <option value="RE-ACCUMULATION">Re-accumulation</option>
            <option value="NEUTRAL">NEUTRAL (Range Bound)</option>
          </select>
          <button onClick={() => { requestDecompose(currentDesk.id); setActiveTab('decomposition'); }} className="tos-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"><Layers className="w-3.5 h-3.5" /> Decompose</button>
          <details className="relative">
            <summary className="list-none cursor-pointer rounded-lg border border-line px-3 py-1.5 text-xs text-ink-3 hover:bg-raised hover:text-ink">Market options</summary>
            <div className="absolute right-0 top-full mt-2 z-20 w-44 rounded-xl border border-line bg-panel p-1.5 shadow-xl">
              <button onClick={() => toggleWatchlist(currentDesk.id, !currentDesk.watchlisted)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-ink-2 hover:bg-raised">{currentDesk.watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}</button>
              <button onClick={editCurrentInstrument} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-ink-2 hover:bg-raised">Edit instrument</button>
              <button onClick={archiveCurrentInstrument} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-amber-400 hover:bg-raised">Archive market</button>
            </div>
          </details>
        </div>
      </div>

      {/* Desk Internal Navigation Tabs */}
      <div className="flex flex-wrap items-center border-b border-line gap-1 text-sm">
        {([
          { id: 'overview', label: 'Analysis' },
          { id: 'setups', label: `Setups${pendingCount ? ` (${pendingCount})` : ''}` },
          { id: 'levels', label: 'Levels' },
          { id: 'charts', label: 'Charts' },
          { id: 'history', label: 'History' },
        ] as { id: DeskTab; label: string }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3.5 py-2.5 border-b-2 font-medium transition whitespace-nowrap ${
              activeSubTab === tab.id ? 'border-cyan-400 text-cyan-300 font-semibold' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <select aria-label="More analysis details"
          value={(['wyckoff', 'scenarios'] as DeskTab[]).includes(activeSubTab) ? activeSubTab : ''}
          onChange={event => setActiveSubTab(event.target.value as DeskTab)}
          className={`ml-auto rounded-lg border border-line bg-panel px-3 py-2 text-xs outline-none ${(['wyckoff', 'scenarios'] as DeskTab[]).includes(activeSubTab) ? 'text-cyan-300' : 'text-ink-3'}`}>
          <option value="" disabled>More analysis</option>
          {(currentDesk.wyckoffDevelopment.phase || currentDesk.wyckoffDevelopment.eventsIdentified.length > 0) && <option value="wyckoff">Legacy Wyckoff notes</option>}
          <option value="scenarios">Scenarios</option>
        </select>
      </div>

      {/* 1. Overview */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          <DeskDecompositionStack desk={currentDesk} />
          <MarketContextStrip
            desk={currentDesk}
            calendarEvents={calendarEvents}
            onSave={(externalContext) => updateAssetDesk(currentDesk.id, { externalContext })}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-semibold">Current analysis</p>
              <h3 className="text-lg font-semibold text-ink">Narrative & structure</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setActiveSubTab('history')} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel hover:bg-raised px-3 py-2 text-xs text-ink-2"><History className="w-3.5 h-3.5" /> History</button>
              <button onClick={() => setFinishScope('all')} disabled={editingNarrative || editingHTF} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel hover:border-cyan-700 px-3 py-2 text-xs font-medium text-ink disabled:opacity-40"><Archive className="w-3.5 h-3.5" /> Finish analysis</button>
            </div>
          </div>
          {analysisNotice && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-200"><span>{analysisNotice} You can write the next analysis in the cleared space below.</span><button onClick={() => setActiveSubTab('history')} className="font-semibold underline underline-offset-2">View history</button></div>}
          <div className="bg-panel border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Current market narrative
              </span>
              <div className="flex items-center gap-3">
                {!editingNarrative && <button onClick={() => setFinishScope('narrative')} className="text-xs text-ink-3 hover:text-cyan-300">Finish</button>}
                {editingNarrative ? (
                  <button onClick={saveNarrative} className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-bold">Save Narrative</button>
                ) : (
                  <button onClick={startEditNarrative} className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1"><Edit3 className="w-3 h-3" /> Edit</button>
                )}
              </div>
            </div>
            {editingNarrative ? (
              <textarea rows={4} value={narrativeDraft} onChange={e => setNarrativeDraft(e.target.value)} className="w-full bg-raised border border-slate-700 rounded p-3 text-xs text-slate-100 font-sans focus:border-cyan-500 outline-none leading-relaxed" />
            ) : (
              <p className="text-xs text-slate-200 font-sans leading-relaxed bg-well p-3 rounded border border-slate-800 min-h-[2.5rem]">
                {currentDesk.currentNarrative || <span className="text-slate-500">Not filled in yet.</span>}
              </p>
            )}
            {renderPlacedCharts('narrative')}
          </div>

          {((['monthly', 'weekly', 'daily', 'h4'] as const).some(tf => currentDesk.htfStructure[tf]?.trim() || (currentDesk.charts || []).some(c => c.placement === tf))) && (
            <details className="bg-panel border border-slate-800 rounded-xl p-4">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink-2">Legacy structure notes <span className="text-xs font-normal text-ink-3">· read-only, kept from before decomposition</span></span>
                <span className="text-xs text-ink-3">Show</span>
              </summary>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {(['monthly', 'weekly', 'daily', 'h4'] as const).filter(tf => currentDesk.htfStructure[tf]?.trim() || (currentDesk.charts || []).some(c => c.placement === tf)).map(tf => (
                  <div key={tf} className="p-3 rounded bg-raised border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">{tf === 'h4' ? '4-hour (H4)' : tf}</span>
                    <p className="text-slate-200 font-sans whitespace-pre-line">{currentDesk.htfStructure[tf] || <span className="text-slate-500">No text.</span>}</p>
                    {renderPlacedCharts(tf, true)}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {activeSubTab === 'history' && <div className="space-y-4"><button onClick={() => setActiveSubTab('overview')} className="text-xs text-cyan-400 hover:text-cyan-300">← Back to current analysis</button><DeskAnalysisLifecycle desk={currentDesk} /></div>}

      {/* 2. Levels ladder (liquidity, POIs and outside levels) */}
      {activeSubTab === 'levels' && (
        <LevelsLadder desk={currentDesk} allDesks={assets} onUpdate={(patch) => updateAssetDesk(currentDesk.id, patch)} mapLevels={mapLevels(mapFor(currentDesk.id))} legacyReadOnly />
      )}

      {/* 3. Wyckoff Development — legacy, read-only (Wyckoff will come from the 4H layer once it is built) */}
      {activeSubTab === 'wyckoff' && (
        <div className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-sm font-semibold text-ink-2 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" /> Legacy Wyckoff notes</span>
            <span className="text-xs text-ink-3">Read-only, kept from before decomposition</span>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-semibold">Phase: {currentDesk.wyckoffDevelopment.phase || 'Not set'}</span>
          <p className="p-3 bg-raised border-l-4 border-cyan-500 rounded-r text-xs font-sans text-slate-300 whitespace-pre-line">{currentDesk.wyckoffDevelopment.notes}</p>
          <div className="flex flex-wrap gap-2">
            {currentDesk.wyckoffDevelopment.eventsIdentified.map((ev, i) => (
              <span key={i} className="px-3 py-1 rounded bg-raised border border-slate-700 text-slate-200 text-xs font-mono">✓ {ev}</span>
            ))}
            {currentDesk.wyckoffDevelopment.eventsIdentified.length === 0 && <span className="text-xs font-mono text-slate-500">No events recorded.</span>}
          </div>
        </div>
      )}

      {/* 4. Scenarios */}
      {activeSubTab === 'scenarios' && (
        <div className="space-y-4">
          <div className="bg-panel border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-mono text-xs font-bold text-slate-200 uppercase">Scenario planning (conditions & invalidations)</span>
              <button onClick={() => setShowAddScenario(v => !v)} className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> {showAddScenario ? 'Cancel' : 'Add Scenario'}
              </button>
            </div>

            {showAddScenario && (
              <form onSubmit={addScenario} className="p-3 bg-well border border-slate-800 rounded space-y-2 text-xs">
                <select value={scenarioProbability} onChange={e => setScenarioProbability(e.target.value as Scenario['probability'])} className={inputClass}>
                  <option value="PRIMARY">Primary</option>
                  <option value="SECONDARY">Secondary</option>
                  <option value="INVALIDATION">Invalidation</option>
                </select>
                <textarea rows={2} placeholder="Thesis" value={scenarioThesis} onChange={e => setScenarioThesis(e.target.value)} className={`${inputClass} w-full`} />
                <textarea rows={2} placeholder="Confirmation conditions (one per line)" value={scenarioConfirm} onChange={e => setScenarioConfirm(e.target.value)} className={`${inputClass} w-full`} />
                <textarea rows={2} placeholder="Invalidation conditions (one per line)" value={scenarioInvalidate} onChange={e => setScenarioInvalidate(e.target.value)} className={`${inputClass} w-full`} />
                {mapPois(mapFor(currentDesk.id)).length > 0 && (
                  <div className="space-y-1.5">
                    <span className="block text-ink-3">Trades from (tap POIs on your map)</span>
                    <div className="flex flex-wrap gap-2">
                      {mapPois(mapFor(currentDesk.id)).map(({ id, label, poi }) => (
                        <button key={id} type="button" onClick={() => setScenarioPoiIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])} aria-pressed={scenarioPoiIds.includes(id)}
                          className={`rounded-lg px-2.5 py-1.5 ring-1 ring-inset ${scenarioPoiIds.includes(id) ? 'bg-accent/15 text-ink ring-accent/60' : 'bg-raised text-ink-2 ring-line'}`}>{label} {fmtPrice(poi.low)}–{fmtPrice(poi.high)}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button type="submit" className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition">Save Scenario</button>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentDesk.scenarios.map(sc => (
                <div key={sc.id} className="p-4 rounded bg-raised border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-100 text-sm">{sc.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${sc.probability === 'PRIMARY' ? 'bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold' : sc.probability === 'SECONDARY' ? 'bg-cyan-950 border border-cyan-800 text-cyan-300' : 'bg-rose-950 border border-rose-800 text-rose-300'}`}>
                        {sc.probability}
                      </span>
                      <button onClick={() => deleteScenario(sc.id)} className="text-slate-500 hover:text-rose-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-200 font-sans font-medium">{sc.thesis}</p>
                  {(sc.poiIds ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(sc.poiIds ?? []).map(id => {
                        const hit = resolvePoi(mapFor(currentDesk.id), id);
                        return <span key={id} className="rounded-md bg-well px-2 py-0.5 text-[11px] text-ink-2 ring-1 ring-inset ring-line" title={hit && !hit.current ? 'From an earlier version of the map' : undefined}>{hit ? `${hit.poi.side === 'SELL' ? 'Sell' : 'Buy'} ${fmtPrice(hit.poi.low)}–${fmtPrice(hit.poi.high)}${hit.current ? '' : ' (earlier map)'}` : 'POI no longer on the map'}</span>;
                      })}
                    </div>
                  )}
                  <div className="space-y-1 pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">Confirmation Conditions:</span>
                    <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-0.5">
                      {sc.confirmationConditions.map((c, i) => (<li key={i}>{c}</li>))}
                    </ul>
                  </div>
                  <div className="space-y-1 pt-1 border-t border-slate-800/80">
                    <span className="text-[10px] font-mono text-rose-400 uppercase font-bold">Invalidation Conditions:</span>
                    <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-0.5">
                      {sc.invalidationConditions.map((c, i) => (<li key={i}>{c}</li>))}
                    </ul>
                  </div>
                </div>
              ))}
              {currentDesk.scenarios.length === 0 && <p className="text-xs font-mono text-slate-500 col-span-full">No scenarios recorded yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* 6. Charts & Screenshots */}
      {activeSubTab === 'charts' && (
        <div className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              Desk charts & screenshots
            </span>
            <span className="text-[11px] font-mono text-slate-500">{(currentDesk.charts || []).length} attached</span>
          </div>

          <div className="p-3 bg-raised border border-slate-800 rounded-md space-y-2">
            <label className="text-[11px] font-mono font-bold text-slate-400 block">Add charts / screenshots</label>
            <input
              value={newChartTitle}
              onChange={e => setNewChartTitle(e.target.value)}
              placeholder={`Title (defaults to \"${currentDesk.symbol} Chart\")`}
              className={`${inputClass} w-full`}
            />
            <MultiImageDropzone
              onAdd={addCharts}
              sublabel={`Select or drag several charts at once, or paste (Ctrl+V). They attach to the ${currentDesk.symbol} desk straight away.`}
            />
          </div>

          {(currentDesk.charts || []).length === 0 ? (
            <p className="text-xs font-mono text-slate-500">No charts attached yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(currentDesk.charts || []).map((chart, idx) => (
                <div key={chart.id} className="relative group rounded-md border border-slate-800 overflow-hidden bg-raised">
                  <ChartImage
                    src={chart.url}
                    alt={chart.title}
                    className="w-full h-32 object-cover cursor-pointer"
                    onClick={() => openLightbox(currentDesk.charts || [], idx)}
                  />
                  <div className="p-2 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-300 truncate">{chart.title}</span>
                    <button onClick={() => removeChart(chart.id)} className="text-rose-400 hover:text-rose-300">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="px-2 pb-2">
                    <select
                      value={chart.placement ?? ''}
                      onChange={(e) => setChartPlacement(chart.id, e.target.value as DeskChartPlacement | '')}
                      className="w-full bg-well border border-slate-700 rounded px-1.5 py-1 text-[10px] font-mono text-slate-300 outline-none"
                      title="Show this chart next to the narrative or an HTF timeframe on the Overview"
                    >
                      <option value="">Show under: Charts only</option>
                      {(Object.keys(PLACEMENT_LABEL) as DeskChartPlacement[]).map((p) => (
                        <option key={p} value={p}>Show under: {p === 'narrative' ? 'Narrative' : `HTF ${PLACEMENT_LABEL[p]}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
      {activeSubTab === 'setups' && <PendingSetupsPanel desk={currentDesk} />}

      {finishScope && <DeskAnalysisFinishDialog
        key={`${currentDesk.id}-${finishScope}`}
        desk={currentDesk}
        scope={finishScope}
        onClose={() => setFinishScope(null)}
        onSaved={entry => {
          setFinishScope(null);
          setAnalysisNotice(entry.outcome === 'INVALIDATED' ? 'Analysis marked invalidated and saved.' : 'Analysis saved to History.');
        }}
      />}

      <ImageViewerModal
        images={lightboxImages}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
};
