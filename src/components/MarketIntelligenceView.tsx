import React, { useState } from 'react';
import {
  Activity,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Globe,
  Flame,
  Layers,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

export const MarketIntelligenceView: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'crypto' | 'macro' | 'fx'>('crypto');

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
            Normalized data architecture aggregating ETF institutional flows, open interest, funding, yields, and macro catalysts.
          </p>
        </div>

        {/* Category switcher */}
        <div className="flex items-center gap-1 bg-[#101722] p-1 border border-slate-800 rounded-lg text-xs font-mono">
          <button
            onClick={() => setActiveCategory('crypto')}
            className={`px-3 py-1.5 rounded transition ${
              activeCategory === 'crypto' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Crypto Intelligence
          </button>
          <button
            onClick={() => setActiveCategory('macro')}
            className={`px-3 py-1.5 rounded transition ${
              activeCategory === 'macro' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Macro & Yields
          </button>
          <button
            onClick={() => setActiveCategory('fx')}
            className={`px-3 py-1.5 rounded transition ${
              activeCategory === 'fx' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            FX & Commodities
          </button>
        </div>
      </div>

      {/* Warning Principle Banner */}
      <div className="p-3.5 bg-[#121927] border-l-4 border-amber-400 rounded-r text-xs font-sans text-slate-300">
        <strong className="text-amber-300 font-mono text-[11px] uppercase block mb-0.5">
          CONTEXTUAL INTELLIGENCE DOCTRINE:
        </strong>
        External market intelligence provides backdrop context for asset desks. It is <strong>NOT</strong> an automatic
        trading signal. A positive ETF net inflow or drop in DXY does not justify buying without technical setup confirmation.
      </div>

      {/* Category 1: Crypto Intelligence */}
      {activeCategory === 'crypto' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-lg bg-[#101722] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">SPOT BTC ETF NET INFLOW</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">+$428.5M</div>
              <span className="text-[10px] text-slate-500">Day 4 consecutive net inflows</span>
            </div>

            <div className="p-4 rounded-lg bg-[#101722] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">SPOT ETH ETF NET INFLOW</span>
              <div className="text-xl font-bold text-cyan-400 mt-1">+$62.4M</div>
              <span className="text-[10px] text-slate-500">BlackRock ETHA leading</span>
            </div>

            <div className="p-4 rounded-lg bg-[#101722] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">TOTAL AGGREGATE OPEN INTEREST</span>
              <div className="text-xl font-bold text-slate-100 mt-1">$47.1B</div>
              <span className="text-[10px] text-amber-400 font-medium">Near all-time record highs</span>
            </div>

            <div className="p-4 rounded-lg bg-[#101722] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">24H TOTAL LIQUIDATIONS</span>
              <div className="text-xl font-bold text-rose-400 mt-1">$142.8M</div>
              <span className="text-[10px] text-slate-500">$98M Short / $44M Long</span>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-3">
            <span className="font-mono text-xs font-bold text-slate-200 uppercase">
              US SPOT BITCOIN ETF BREAKDOWN (TOP ISSUERS)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded bg-[#162130] border border-slate-800">
                <span className="text-slate-400 text-[10px] block">BLACKROCK (IBIT):</span>
                <span className="text-emerald-400 font-bold text-sm">+$285.2M</span>
              </div>
              <div className="p-3 rounded bg-[#162130] border border-slate-800">
                <span className="text-slate-400 text-[10px] block">FIDELITY (FBTC):</span>
                <span className="text-emerald-400 font-bold text-sm">+$104.6M</span>
              </div>
              <div className="p-3 rounded bg-[#162130] border border-slate-800">
                <span className="text-slate-400 text-[10px] block">GRAYSCALE (GBTC):</span>
                <span className="text-rose-400 font-bold text-sm">-$12.1M</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category 2: Macro & Rates */}
      {activeCategory === 'macro' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-lg bg-[#101722] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">US 10-YEAR TREASURY YIELD</span>
              <div className="text-xl font-bold text-slate-100 mt-1">4.42%</div>
              <span className="text-[10px] text-rose-400">+3.4 bps on session</span>
            </div>

            <div className="p-4 rounded-lg bg-[#101722] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">US DOLLAR INDEX (DXY)</span>
              <div className="text-xl font-bold text-slate-100 mt-1">106.45</div>
              <span className="text-[10px] text-emerald-400">+0.22% testing resistance</span>
            </div>

            <div className="p-4 rounded-lg bg-[#101722] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">FED RATE CUT ODDS (DEC)</span>
              <div className="text-xl font-bold text-cyan-400 mt-1">58.4%</div>
              <span className="text-[10px] text-slate-500">25 bps reduction probability</span>
            </div>

            <div className="p-4 rounded-lg bg-[#101722] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">CBOE VIX VOLATILITY</span>
              <div className="text-xl font-bold text-emerald-400 mt-1">14.15</div>
              <span className="text-[10px] text-slate-500">Low equity volatility regime</span>
            </div>
          </div>
        </div>
      )}

      {/* Category 3: FX & Commodities */}
      {activeCategory === 'fx' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 rounded-lg bg-[#101722] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">GOLD (XAU/USD)</span>
              <div className="text-xl font-bold text-amber-300 mt-1">$2,642.50</div>
              <span className="text-[10px] text-slate-500">Consolidating above 50-day EMA</span>
            </div>

            <div className="p-4 rounded-lg bg-[#101722] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">EUR/USD RATE</span>
              <div className="text-xl font-bold text-slate-100 mt-1">1.0540</div>
              <span className="text-[10px] text-rose-400">ECB easing pressure</span>
            </div>

            <div className="p-4 rounded-lg bg-[#101722] border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 block uppercase">WTI CRUDE OIL</span>
              <div className="text-xl font-bold text-slate-100 mt-1">$69.20</div>
              <span className="text-[10px] text-slate-500">Geopolitical risk balance</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
