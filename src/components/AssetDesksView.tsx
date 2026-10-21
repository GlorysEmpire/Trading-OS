import React, { useState } from 'react';
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
  ImagePlus,
  Star,
} from 'lucide-react';
import { AssetCategory, BiasType, Scenario, LiquidityZone, AssetChartScreenshot } from '../types';
import { ImageUploadDropzone } from './ImageUploadDropzone';
import { ImageViewerModal, LightboxImage } from './ImageViewerModal';

const inputClass = 'bg-[#162130] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 outline-none focus:border-cyan-500 font-sans';

export const AssetDesksView: React.FC = () => {
  const { assets, selectedAssetId, setSelectedAssetId, updateAssetDesk, createInstrument, updateInstrument, archiveInstrument, setQuickTradeModalOpen, desksLoading, desksError } = useTrading();

  const currentDesk = assets.find(a => a.id === selectedAssetId) || assets[0];

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'liquidity' | 'wyckoff' | 'external' | 'scenarios' | 'charts'>('overview');

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

  // External context edit
  const [editingExternal, setEditingExternal] = useState(false);
  const [externalDraft, setExternalDraft] = useState<Record<string, string>>({});

  // Liquidity zone add
  const [newLiqLevel, setNewLiqLevel] = useState('');
  const [newLiqType, setNewLiqType] = useState<LiquidityZone['type']>('BSL');
  const [newLiqNotes, setNewLiqNotes] = useState('');

  // Scenario add
  const [showAddScenario, setShowAddScenario] = useState(false);
  const [scenarioProbability, setScenarioProbability] = useState<Scenario['probability']>('PRIMARY');
  const [scenarioThesis, setScenarioThesis] = useState('');
  const [scenarioConfirm, setScenarioConfirm] = useState('');
  const [scenarioInvalidate, setScenarioInvalidate] = useState('');

  // Chart/screenshot attachments
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [newChartTitle, setNewChartTitle] = useState('');
  const [pendingChartUrl, setPendingChartUrl] = useState('');
  const [instrumentFormOpen, setInstrumentFormOpen] = useState(false);
  const [instrumentError, setInstrumentError] = useState<string | null>(null);
  const [instrumentDraft, setInstrumentDraft] = useState({ symbol: '', name: '', canonicalSymbol: '', category: 'CRYPTO' as AssetCategory, tradingViewSymbol: '' });

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

  const addChart = () => {
    if (!pendingChartUrl) return;
    const chart: AssetChartScreenshot = {
      id: `chart-${Date.now()}`,
      title: newChartTitle.trim() || `${currentDesk.symbol} Chart`,
      timeframe: '',
      url: pendingChartUrl,
      uploadedAt: new Date().toISOString(),
      category: 'GENERAL',
    };
    updateAssetDesk(currentDesk.id, { charts: [...(currentDesk.charts || []), chart] });
    setPendingChartUrl('');
    setNewChartTitle('');
  };
  const removeChart = (chartId: string) => {
    updateAssetDesk(currentDesk.id, { charts: (currentDesk.charts || []).filter(c => c.id !== chartId) });
  };

  const startEditExternal = () => {
    setExternalDraft({
      etfFlows: currentDesk.externalContext.etfFlows || '',
      openInterest: currentDesk.externalContext.openInterest || '',
      fundingRate: currentDesk.externalContext.fundingRate || '',
      liquidations: currentDesk.externalContext.liquidations || '',
      yields10Y: currentDesk.externalContext.yields10Y || '',
      dxy: currentDesk.externalContext.dxy || '',
      macroNews: currentDesk.externalContext.macroNews || '',
    });
    setEditingExternal(true);
  };
  const saveExternal = () => {
    updateAssetDesk(currentDesk.id, {
      externalContext: { ...externalDraft, updatedAt: new Date().toLocaleString() },
    });
    setEditingExternal(false);
  };

  const handleBiasChange = (bias: BiasType) => updateAssetDesk(currentDesk.id, { currentBias: bias });

  const handleAddLiquidityZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLiqLevel.trim()) return;
    const newZone: LiquidityZone = { id: `l-${Date.now().toString().slice(-4)}`, level: newLiqLevel.trim(), type: newLiqType, status: 'UNTOUCHED', notes: newLiqNotes.trim() || 'Key liquidity level' };
    updateAssetDesk(currentDesk.id, { liquidityZones: [...currentDesk.liquidityZones, newZone] });
    setNewLiqLevel('');
    setNewLiqNotes('');
  };
  const handleToggleLiqStatus = (zoneId: string) => {
    const updated = currentDesk.liquidityZones.map(z => {
      if (z.id !== zoneId) return z;
      const nextStatus: LiquidityZone['status'] = z.status === 'UNTOUCHED' ? 'SWEPT' : z.status === 'SWEPT' ? 'ENGINEERED' : 'UNTOUCHED';
      return { ...z, status: nextStatus };
    });
    updateAssetDesk(currentDesk.id, { liquidityZones: updated });
  };
  const handleDeleteLiqZone = (zoneId: string) => updateAssetDesk(currentDesk.id, { liquidityZones: currentDesk.liquidityZones.filter(z => z.id !== zoneId) });

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
    };
    updateAssetDesk(currentDesk.id, { scenarios: [...currentDesk.scenarios, newScenario] });
    setScenarioThesis('');
    setScenarioConfirm('');
    setScenarioInvalidate('');
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
                  isSelected ? 'bg-[#182335] text-cyan-300 border border-cyan-500/40 font-bold shadow-sm' : 'bg-[#101722] text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleWatchlist(asset.id, !asset.watchlisted); }}
                  title={asset.watchlisted ? 'Remove from Market Watch' : 'Add to Market Watch'}
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
        <div className="flex gap-2"><button onClick={() => setInstrumentFormOpen(v => !v)} className="bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-mono text-xs font-bold px-3 py-1.5 rounded">+ INSTRUMENT</button><button onClick={() => setQuickTradeModalOpen(true)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold px-3 py-1.5 rounded transition"><span>+ EXECUTE ON {currentDesk.symbol}</span></button></div>
      </div>
      {instrumentError && <p className="text-xs font-mono text-rose-400">{instrumentError}</p>}
      {instrumentFormOpen && <form onSubmit={saveInstrument} className="bg-[#101722] border border-slate-800 rounded-lg p-4 grid gap-3 md:grid-cols-2"><h3 className="md:col-span-2 text-sm font-mono font-bold text-slate-100">Add instrument / pair</h3>{([['Display symbol', 'symbol'], ['Name', 'name'], ['Canonical symbol', 'canonicalSymbol'], ['TradingView symbol (optional)', 'tradingViewSymbol']] as const).map(([title, field]) => <label key={field} className="text-[10px] font-mono text-slate-400">{title}<input required={field !== 'tradingViewSymbol'} value={instrumentDraft[field]} onChange={e => setInstrumentDraft({ ...instrumentDraft, [field]: e.target.value })} className={`${inputClass} w-full mt-1`} /></label>)}<label className="text-[10px] font-mono text-slate-400">Category<select value={instrumentDraft.category} onChange={e => setInstrumentDraft({ ...instrumentDraft, category: e.target.value as AssetCategory })} className={`${inputClass} w-full mt-1`}>{(['CRYPTO', 'INDICES', 'METALS', 'FX', 'EQUITIES', 'OTHER'] as AssetCategory[]).map(category => <option key={category}>{category}</option>)}</select></label><p className="md:col-span-2 text-xs text-slate-400">Use separate records for BTCUSD and BTCUSDT. Archive hides an instrument from new selectors without deleting desk/history.</p><button className="w-fit px-3 py-2 rounded bg-cyan-600 text-white font-mono text-xs font-bold">SAVE INSTRUMENT</button></form>}

      {/* Desk Subheader */}
      <div className="bg-[#101722] border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleWatchlist(currentDesk.id, !currentDesk.watchlisted)}
            className={`flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border ${
              currentDesk.watchlisted ? 'border-amber-700 text-amber-300 bg-amber-950/40' : 'border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star className="w-3 h-3" fill={currentDesk.watchlisted ? 'currentColor' : 'none'} />
            <span>{currentDesk.watchlisted ? 'ON MARKET WATCH' : 'ADD TO MARKET WATCH'}</span>
          </button>
          <button onClick={editCurrentInstrument} className="text-[10px] font-mono text-cyan-300">EDIT INSTRUMENT</button><button onClick={archiveCurrentInstrument} className="text-[10px] font-mono text-amber-300">ARCHIVE</button>
          <span className="text-[11px] font-mono text-slate-400 uppercase">CURRENT BIAS:</span>
          <select
            value={currentDesk.currentBias}
            onChange={e => handleBiasChange(e.target.value as BiasType)}
            className="bg-[#162130] border border-slate-700 rounded px-3 py-1.5 text-xs font-mono font-bold text-cyan-300 outline-none focus:border-cyan-500"
          >
            <option value="BULLISH">BULLISH (Expansion)</option>
            <option value="BEARISH">BEARISH (Markdown)</option>
            <option value="ACCUMULATION">ACCUMULATION (Phase A/B/C)</option>
            <option value="DISTRIBUTION">DISTRIBUTION (Phase A/B/C)</option>
            <option value="RE-ACCUMULATION">RE-ACCUMULATION</option>
            <option value="NEUTRAL">NEUTRAL (Range Bound)</option>
          </select>
        </div>
      </div>

      {/* Desk Internal Navigation Tabs */}
      <div className="flex items-center border-b border-slate-800 gap-2 overflow-x-auto text-xs font-mono">
        {[
          { id: 'overview', label: '1. Narrative & Structure' },
          { id: 'liquidity', label: '2. Liquidity & POIs' },
          { id: 'wyckoff', label: '3. Wyckoff Development' },
          { id: 'scenarios', label: '4. Scenarios' },
          { id: 'external', label: '5. External Context' },
          { id: 'charts', label: '6. Charts & Screenshots' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-3.5 py-2 border-b-2 font-medium transition whitespace-nowrap ${
              activeSubTab === tab.id ? 'border-cyan-400 text-cyan-300 font-bold bg-[#141d2a]' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. Overview */}
      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                CURRENT MARKET NARRATIVE
              </span>
              {editingNarrative ? (
                <button onClick={saveNarrative} className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-bold">Save Narrative</button>
              ) : (
                <button onClick={startEditNarrative} className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1">
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
            {editingNarrative ? (
              <textarea rows={4} value={narrativeDraft} onChange={e => setNarrativeDraft(e.target.value)} className="w-full bg-[#162130] border border-slate-700 rounded p-3 text-xs text-slate-100 font-sans focus:border-cyan-500 outline-none leading-relaxed" />
            ) : (
              <p className="text-xs text-slate-200 font-sans leading-relaxed bg-[#0d141f] p-3 rounded border border-slate-800 min-h-[2.5rem]">
                {currentDesk.currentNarrative || <span className="text-slate-500">Not filled in yet.</span>}
              </p>
            )}
          </div>

          <div className="bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                HIGH TIMEFRAME (HTF) MARKET STRUCTURE
              </span>
              {editingHTF ? (
                <button onClick={saveHTF} className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-bold">Save HTF Structure</button>
              ) : (
                <button onClick={startEditHTF} className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1">
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {(['monthly', 'weekly', 'daily', 'h4'] as const).map(tf => (
                <div key={tf} className="p-3 rounded bg-[#162130] border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">{tf === 'h4' ? '4-HOUR (H4)' : tf} TIMEFRAME:</span>
                  {editingHTF ? (
                    <textarea rows={2} value={htfDraft[tf]} onChange={e => setHtfDraft({ ...htfDraft, [tf]: e.target.value })} className="w-full bg-[#0d141f] border border-slate-700 rounded p-2 text-slate-100 font-sans text-xs outline-none focus:border-cyan-500" />
                  ) : (
                    <p className="text-slate-200 font-sans">{currentDesk.htfStructure[tf] || <span className="text-slate-500">Not filled in yet.</span>}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Liquidity & POIs */}
      {activeSubTab === 'liquidity' && (
        <div className="space-y-4">
          <div className="bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                ACTIVE LIQUIDITY POOLS & SWEEP MONITOR
              </span>
              <span className="text-[11px] font-mono text-slate-400">Click status pill to toggle Untouched → Swept → Engineered</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {currentDesk.liquidityZones.map(zone => (
                <div key={zone.id} className="p-3 rounded bg-[#162130] border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-slate-100">{zone.level}</span>
                    <button
                      onClick={() => handleToggleLiqStatus(zone.id)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition ${
                        zone.status === 'UNTOUCHED' ? 'bg-amber-950/60 border-amber-800 text-amber-300' : zone.status === 'SWEPT' ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 font-bold' : 'bg-purple-950/60 border-purple-800 text-purple-300'
                      }`}
                    >
                      {zone.status}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Type: {zone.type}</span>
                    <button onClick={() => handleDeleteLiqZone(zone.id)} className="text-slate-500 hover:text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 font-sans">{zone.notes}</p>
                </div>
              ))}
              {currentDesk.liquidityZones.length === 0 && <p className="text-xs font-mono text-slate-500 col-span-full">No liquidity levels recorded yet.</p>}
            </div>
            <form onSubmit={handleAddLiquidityZone} className="p-3 bg-[#0d141f] border border-slate-800 rounded flex flex-wrap items-center gap-2 text-xs">
              <input type="text" placeholder="Level (e.g. $94,800)" value={newLiqLevel} onChange={e => setNewLiqLevel(e.target.value)} className={`${inputClass} w-32`} />
              <select value={newLiqType} onChange={e => setNewLiqType(e.target.value as any)} className={inputClass}>
                <option value="BSL">BSL (Buy-Side)</option>
                <option value="SSL">SSL (Sell-Side)</option>
                <option value="EQH">EQH (Equal Highs)</option>
                <option value="EQL">EQL (Equal Lows)</option>
                <option value="RANGE_HIGH">RANGE HIGH</option>
                <option value="RANGE_LOW">RANGE LOW</option>
              </select>
              <input type="text" placeholder="Notes & thesis" value={newLiqNotes} onChange={e => setNewLiqNotes(e.target.value)} className={`${inputClass} flex-1 min-w-[150px]`} />
              <button type="submit" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs rounded border border-slate-700 transition">+ Add Level</button>
            </form>
          </div>

          <div className="bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-3">
            <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              ACTIVE POINTS OF INTEREST (POIs)
            </span>
            <p className="text-[11px] font-mono text-slate-500">POI editing is planned for a later pass — liquidity zones above are the editable structured data for now.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentDesk.activePOIs.map(poi => (
                <div key={poi.id} className="p-3 rounded bg-[#162130] border border-slate-800 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-100">{poi.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">{poi.timeframe}</span>
                  </div>
                  <div className="font-mono text-cyan-400 font-semibold">{poi.priceRange}</div>
                  <div className="text-slate-400 text-[11px]">Type: {poi.type}</div>
                </div>
              ))}
              {currentDesk.activePOIs.length === 0 && <p className="text-xs font-mono text-slate-500">None recorded yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* 3. Wyckoff Development */}
      {activeSubTab === 'wyckoff' && (
        <div className="bg-[#101722] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              WYCKOFF SCHEMATIC DEVELOPMENT & EVENT TRACKER
            </span>
            {editingWyckoff ? (
              <button onClick={saveWyckoff} className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-bold">Save</button>
            ) : (
              <button onClick={startEditWyckoff} className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1">
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            )}
          </div>

          {editingWyckoff ? (
            <input value={wyckoffPhaseDraft} onChange={e => setWyckoffPhaseDraft(e.target.value)} placeholder="Current phase (e.g. Phase B)" className={`${inputClass} w-full`} />
          ) : (
            <span className="text-xs font-mono text-emerald-400 font-semibold">Current Phase: {currentDesk.wyckoffDevelopment.phase || 'Not set'}</span>
          )}

          <div className="p-3 bg-[#131b26] border-l-4 border-cyan-500 rounded-r text-xs font-sans text-slate-300">
            <strong className="text-cyan-300 font-mono text-[11px] uppercase block mb-0.5">SEMANTIC RULE: AR = AUTOMATIC REACTION</strong>
            {editingWyckoff ? (
              <textarea rows={2} value={wyckoffNotesDraft} onChange={e => setWyckoffNotesDraft(e.target.value)} className="w-full bg-[#0d141f] border border-slate-700 rounded p-2 text-slate-100 mt-1 outline-none focus:border-cyan-500" />
            ) : (
              currentDesk.wyckoffDevelopment.notes
            )}
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono text-slate-400 uppercase">IDENTIFIED EVENTS IN STRUCTURE:</span>
            <div className="flex flex-wrap gap-2">
              {currentDesk.wyckoffDevelopment.eventsIdentified.map((ev, i) => (
                <span key={i} className="px-3 py-1 rounded bg-[#162130] border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5">
                  ✓ {ev}
                  <button onClick={() => removeWyckoffEvent(i)} className="text-slate-500 hover:text-rose-400">×</button>
                </span>
              ))}
              {currentDesk.wyckoffDevelopment.eventsIdentified.length === 0 && <span className="text-xs font-mono text-slate-500">None recorded yet.</span>}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input value={newEvent} onChange={e => setNewEvent(e.target.value)} placeholder="e.g. Selling Climax (SC) at …" className={`${inputClass} flex-1`} />
              <button onClick={addWyckoffEvent} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs rounded border border-slate-700 transition">+ Add</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Scenarios */}
      {activeSubTab === 'scenarios' && (
        <div className="space-y-4">
          <div className="bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-mono text-xs font-bold text-slate-200 uppercase">SCENARIO PLANNING (CONDITIONS & INVALIDATIONS)</span>
              <button onClick={() => setShowAddScenario(v => !v)} className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> {showAddScenario ? 'Cancel' : 'Add Scenario'}
              </button>
            </div>

            {showAddScenario && (
              <form onSubmit={addScenario} className="p-3 bg-[#0d141f] border border-slate-800 rounded space-y-2 text-xs">
                <select value={scenarioProbability} onChange={e => setScenarioProbability(e.target.value as Scenario['probability'])} className={inputClass}>
                  <option value="PRIMARY">PRIMARY</option>
                  <option value="SECONDARY">SECONDARY</option>
                  <option value="INVALIDATION">INVALIDATION</option>
                </select>
                <textarea rows={2} placeholder="Thesis" value={scenarioThesis} onChange={e => setScenarioThesis(e.target.value)} className={`${inputClass} w-full`} />
                <textarea rows={2} placeholder="Confirmation conditions (one per line)" value={scenarioConfirm} onChange={e => setScenarioConfirm(e.target.value)} className={`${inputClass} w-full`} />
                <textarea rows={2} placeholder="Invalidation conditions (one per line)" value={scenarioInvalidate} onChange={e => setScenarioInvalidate(e.target.value)} className={`${inputClass} w-full`} />
                <button type="submit" className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold rounded transition">Save Scenario</button>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentDesk.scenarios.map(sc => (
                <div key={sc.id} className="p-4 rounded bg-[#162130] border border-slate-800 space-y-3 text-xs">
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

      {/* 5. External Context */}
      {activeSubTab === 'external' && (
        <div className="bg-[#101722] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-cyan-400" />
              EXTERNAL CONTEXT & INSTITUTIONAL FLOWS
            </span>
            <div className="flex items-center gap-3">
              {currentDesk.externalContext.updatedAt && <span className="text-[11px] font-mono text-slate-400">Updated: {currentDesk.externalContext.updatedAt}</span>}
              {editingExternal ? (
                <button onClick={saveExternal} className="text-xs font-mono text-cyan-400 hover:text-cyan-300 font-bold">Save</button>
              ) : (
                <button onClick={startEditExternal} className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1">
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
          </div>

          <div className="p-3 bg-[#131b26] border-l-4 border-amber-400 rounded-r text-xs font-sans text-slate-300">
            <strong className="text-amber-300 font-mono text-[11px] uppercase block mb-0.5">CONTEXTUAL INTELLIGENCE PRINCIPLE:</strong>
            External context (ETF flows, OI, funding rates, liquidations, yields, DXY) is contextual intelligence.
            <strong> It must NOT automatically become a trade signal.</strong>
          </div>

          {editingExternal ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
              {([
                ['etfFlows', 'ETF NET FLOWS'],
                ['openInterest', 'OPEN INTEREST'],
                ['fundingRate', 'FUNDING RATE'],
                ['liquidations', 'LIQUIDATIONS (24H)'],
                ['yields10Y', 'US 10Y YIELDS'],
                ['dxy', 'DXY (US DOLLAR)'],
              ] as const).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-slate-400 mb-1">{label}</label>
                  <input value={externalDraft[field] || ''} onChange={e => setExternalDraft({ ...externalDraft, [field]: e.target.value })} className={`${inputClass} w-full`} />
                </div>
              ))}
              <div className="col-span-full">
                <label className="block text-slate-400 mb-1">MACRO NEWS</label>
                <textarea rows={2} value={externalDraft.macroNews || ''} onChange={e => setExternalDraft({ ...externalDraft, macroNews: e.target.value })} className={`${inputClass} w-full`} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              {currentDesk.externalContext.etfFlows && (
                <div className="p-3 rounded bg-[#162130] border border-slate-800"><span className="text-[10px] text-slate-400 block">ETF NET FLOWS:</span><span className="text-emerald-400 font-bold">{currentDesk.externalContext.etfFlows}</span></div>
              )}
              {currentDesk.externalContext.openInterest && (
                <div className="p-3 rounded bg-[#162130] border border-slate-800"><span className="text-[10px] text-slate-400 block">OPEN INTEREST:</span><span className="text-slate-200 font-bold">{currentDesk.externalContext.openInterest}</span></div>
              )}
              {currentDesk.externalContext.fundingRate && (
                <div className="p-3 rounded bg-[#162130] border border-slate-800"><span className="text-[10px] text-slate-400 block">FUNDING RATE:</span><span className="text-slate-200 font-bold">{currentDesk.externalContext.fundingRate}</span></div>
              )}
              {currentDesk.externalContext.liquidations && (
                <div className="p-3 rounded bg-[#162130] border border-slate-800"><span className="text-[10px] text-slate-400 block">LIQUIDATIONS (24H):</span><span className="text-amber-400 font-bold">{currentDesk.externalContext.liquidations}</span></div>
              )}
              {currentDesk.externalContext.yields10Y && (
                <div className="p-3 rounded bg-[#162130] border border-slate-800"><span className="text-[10px] text-slate-400 block">US 10Y YIELDS:</span><span className="text-slate-200 font-bold">{currentDesk.externalContext.yields10Y}</span></div>
              )}
              {currentDesk.externalContext.dxy && (
                <div className="p-3 rounded bg-[#162130] border border-slate-800"><span className="text-[10px] text-slate-400 block">DXY (US DOLLAR):</span><span className="text-slate-200 font-bold">{currentDesk.externalContext.dxy}</span></div>
              )}
              {!currentDesk.externalContext.etfFlows && !currentDesk.externalContext.openInterest && !currentDesk.externalContext.dxy && (
                <p className="text-xs font-mono text-slate-500 col-span-full">Nothing recorded yet.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. Charts & Screenshots */}
      {activeSubTab === 'charts' && (
        <div className="bg-[#101722] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              DESK CHARTS & SCREENSHOTS
            </span>
            <span className="text-[11px] font-mono text-slate-500">{(currentDesk.charts || []).length} attached</span>
          </div>

          <div className="p-3 bg-[#131b26] border border-slate-800 rounded-md space-y-2">
            <label className="text-[11px] font-mono font-bold text-slate-400 block">ADD CHART / SCREENSHOT</label>
            <input
              value={newChartTitle}
              onChange={e => setNewChartTitle(e.target.value)}
              placeholder={`Title (defaults to \"${currentDesk.symbol} Chart\")`}
              className={`${inputClass} w-full`}
            />
            <ImageUploadDropzone
              value={pendingChartUrl}
              onChange={url => setPendingChartUrl(url)}
              sublabel="Drag & drop, click to upload, or paste screenshot (Ctrl+V)"
            />
            {pendingChartUrl && (
              <button
                onClick={addChart}
                className="w-full flex items-center justify-center gap-2 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                Attach to {currentDesk.symbol} Desk
              </button>
            )}
          </div>

          {(currentDesk.charts || []).length === 0 ? (
            <p className="text-xs font-mono text-slate-500">No charts attached yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(currentDesk.charts || []).map((chart, idx) => (
                <div key={chart.id} className="relative group rounded-md border border-slate-800 overflow-hidden bg-[#162130]">
                  <img
                    src={chart.url}
                    alt={chart.title}
                    className="w-full h-32 object-cover cursor-pointer"
                    onClick={() => {
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                  />
                  <div className="p-2 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-300 truncate">{chart.title}</span>
                    <button onClick={() => removeChart(chart.id)} className="text-rose-400 hover:text-rose-300">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <ImageViewerModal
            images={(currentDesk.charts || []).map((c): LightboxImage => ({ url: c.url, title: c.title, timeframe: c.timeframe }))}
            currentIndex={lightboxIndex}
            isOpen={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
            onNavigate={setLightboxIndex}
          />
        </div>
      )}
    </div>
  );
};
