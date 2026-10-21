import React, { useState } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';

/**
 * This view previously showed specific numbers (ETF flows, yields, DXY,
 * VIX, gold/EUR/oil prices) as if they were live institutional data.
 * They were entirely fabricated — there is no connected market-data feed
 * behind this page. The app's own stated doctrine ("no fabricated market
 * data or performance is permitted") rules that out, so rather than
 * labeling fake numbers as "example data" (which would still read as real
 * at a glance), they've been removed. This page is honest about having
 * no live source until one is actually wired up.
 */

const CATEGORIES = [
  { id: 'crypto' as const, label: 'Crypto Intelligence', description: 'ETF flows, open interest, funding, liquidations' },
  { id: 'macro' as const, label: 'Macro & Yields', description: '10Y yield, DXY, rate-cut odds, VIX' },
  { id: 'fx' as const, label: 'FX & Commodities', description: 'Gold, EUR/USD, WTI crude' },
];

export const MarketIntelligenceView: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'crypto' | 'macro' | 'fx'>('crypto');
  const active = CATEGORIES.find((c) => c.id === activeCategory)!;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            INSTITUTIONAL FLOW & MACRO CONTEXT FEED
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-1">MARKET INTELLIGENCE</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Normalized data architecture for ETF institutional flows, open interest, funding, yields, and macro catalysts —
            once a live data source is connected.
          </p>
        </div>

        {/* Category switcher */}
        <div className="flex items-center gap-1 bg-[#101722] p-1 border border-slate-800 rounded-lg text-xs font-mono">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-3 py-1.5 rounded transition ${
                activeCategory === c.id ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Warning Principle Banner */}
      <div className="p-3.5 bg-[#121927] border-l-4 border-amber-400 rounded-r text-xs font-sans text-slate-300">
        <strong className="text-amber-300 font-mono text-[11px] uppercase block mb-0.5">
          CONTEXTUAL INTELLIGENCE DOCTRINE:
        </strong>
        External market intelligence provides backdrop context for asset desks. It is <strong>NOT</strong> an automatic
        trading signal. A positive ETF net inflow or drop in DXY would not justify buying without technical setup
        confirmation — and this app never fabricates numbers to simulate that context.
      </div>

      {/* Honest "not connected" state */}
      <div className="bg-[#101722] border border-dashed border-slate-800 rounded-lg p-8 text-center space-y-3">
        <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
        <h3 className="font-mono text-sm font-bold text-slate-200 uppercase">No live data source connected</h3>
        <p className="text-xs text-slate-400 font-sans max-w-md mx-auto">
          {active.label} ({active.description}) has no market-data feed wired up yet, so nothing is shown here rather than
          invented figures. Check a source you trust directly (your broker/exchange, a terminal, or a market-data provider)
          for this context until a feed is connected.
        </p>
      </div>
    </div>
  );
};
