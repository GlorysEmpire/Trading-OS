import React, { useState } from 'react';
import { useTrading } from '../context/TradingContext';
import {
  Radar,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Layers,
  Clock,
  Compass,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface ScannedSetupCandidate {
  id: string;
  asset: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT';
  model: string;
  gradePotential: string;
  minEstR: number;
  criteriaMatches: string[];
  narrativeContext: string;
  triggerStatus: 'PENDING_CONFIRMATION' | 'POI_RETEST' | 'STRUCTURE_SHIFTED';
}

const INITIAL_SCANNER_RESULTS: ScannedSetupCandidate[] = [
  {
    id: 'sc-01',
    asset: 'ETH',
    timeframe: '15M',
    direction: 'LONG',
    model: 'Wyckoff + ICT',
    gradePotential: 'A+',
    minEstR: 4.8,
    criteriaMatches: [
      'Sell-side liquidity swept below $3,040 Asian low',
      'Market Structure Shift (MSS) on 15M with displacement candle',
      'Fair Value Gap (FVG) resting between $3,055 – $3,068',
      'Wyckoff Phase C Spring / Test formation',
    ],
    narrativeContext:
      'Liquidity pool flushed during London session. Price now reacting aggressively back into internal value.',
    triggerStatus: 'POI_RETEST',
  },
  {
    id: 'sc-02',
    asset: 'NQ',
    timeframe: '5M',
    direction: 'SHORT',
    model: 'SLP (Session Liquidity Play)',
    gradePotential: 'B+',
    minEstR: 3.4,
    criteriaMatches: [
      'Pre-market high swept at 21,120',
      'Failure to accept above value area high',
      'Rapid displacement back below open price',
    ],
    narrativeContext:
      'Early New York session distribution trap attempting to trap breakout buyers prior to morning economic release.',
    triggerStatus: 'PENDING_CONFIRMATION',
  },
  {
    id: 'sc-03',
    asset: 'BTC',
    timeframe: '1H',
    direction: 'LONG',
    model: 'Range Delivery Model',
    gradePotential: 'A+',
    minEstR: 5.2,
    criteriaMatches: [
      'Equal lows swept at $93,800',
      'Institutional ETF inflows continuing positive trend',
      '4H Demand POI confluence',
    ],
    narrativeContext:
      'Consolidation base resting above daily 20 EMA. Potential continuation towards $99,000 psychological barrier.',
    triggerStatus: 'STRUCTURE_SHIFTED',
  },
];

export const ScannerView: React.FC = () => {
  const { setSelectedAssetId, setActiveTab, setQuickTradeModalOpen } = useTrading();
  const [candidates] = useState<ScannedSetupCandidate[]>(INITIAL_SCANNER_RESULTS);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <Radar className="w-4 h-4 animate-spin" />
            DISCRETIONARY FILTERING & CONFLUENCE RADAR
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-1">POTENTIAL SETUP SCANNER</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Surfacing structural confluence: HTF location + liquidity sweep + market structure shift + FVG displacement.
          </p>
        </div>

        <span className="text-xs font-mono px-3 py-1 rounded bg-[#101722] border border-slate-800 text-slate-300">
          3 Potential Setups Identified
        </span>
      </div>

      {/* MANDATORY PROMPT SECTION 16 RULE: NEVER "BUY NOW" */}
      <div className="p-4 bg-[#141b27] border-l-4 border-cyan-400 rounded-r shadow-sm space-y-1">
        <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs font-bold uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          GOVERNANCE DIRECTIVE: POTENTIAL SETUP — REQUIRES TRADER DECISION
        </div>
        <p className="text-xs text-slate-300 font-sans leading-relaxed">
          The scanner identifies conditions where the trader's edge may be forming. It <strong>NEVER</strong> generates
          autonomous signals ("BUY NOW" or "SELL NOW"). The trader retains complete sovereign discretionary judgment.
        </p>
      </div>

      {/* Candidates Grid */}
      <div className="space-y-4">
        {candidates.map((c) => (
          <div key={c.id} className="bg-[#101722] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-base font-bold text-slate-100">{c.asset}</span>
                <span
                  className={`font-mono text-xs px-2.5 py-0.5 rounded font-bold ${
                    c.direction === 'LONG'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}
                >
                  {c.direction} ({c.timeframe})
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {c.model}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-bold">
                  Grade {c.gradePotential} (Est. {c.minEstR}R)
                </span>
              </div>

              <span
                className={`text-xs font-mono px-2.5 py-1 rounded font-semibold ${
                  c.triggerStatus === 'POI_RETEST'
                    ? 'bg-amber-950/80 border border-amber-800 text-amber-300'
                    : c.triggerStatus === 'STRUCTURE_SHIFTED'
                    ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                STATUS: {c.triggerStatus.replace(/_/g, ' ')}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed bg-[#0c1119] p-3 rounded border border-slate-800">
              <strong className="text-slate-400 font-mono text-[11px] uppercase block mb-1">Narrative Context:</strong>
              {c.narrativeContext}
            </p>

            {/* Criteria Matches */}
            <div className="space-y-1.5 text-xs font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-bold">METHODOLOGY CONFLUENCE DETECTED:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {c.criteriaMatches.map((crit, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded bg-[#162130] border border-slate-800 text-slate-200 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{crit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs font-mono">
              <button
                onClick={() => {
                  setSelectedAssetId(`desk-${c.asset.toLowerCase()}`);
                  setActiveTab('asset-desks');
                }}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <span>Open {c.asset} Asset Desk</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setQuickTradeModalOpen(true)}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>OPEN EXECUTION DRAFT IN TRADE LOG</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
