import React from 'react';
import { useTrading } from '../context/TradingContext';
import { Radar, ShieldAlert, Search } from 'lucide-react';

/**
 * This view previously rendered three fabricated "scanned" setups — made-up
 * assets, prices, and confluence narratives — presented as if an automated
 * scanner had detected real structural confluence. There is no connected
 * market-data feed or scanning engine behind this page; those candidates
 * were invented. That directly violates the app's own governance doctrine
 * (no fabricated market data, no simulated signals), so rather than relabel
 * fake setups as "examples" — which would still read as real setups at a
 * glance — they've been removed. This page is honest about having nothing
 * to show until a real scanning engine is connected.
 */
export const ScannerView: React.FC = () => {
  const { assets } = useTrading();

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <Radar className="w-4 h-4" />
            DISCRETIONARY FILTERING & CONFLUENCE RADAR
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-1">POTENTIAL SETUP SCANNER</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Surfaces structural confluence — HTF location + liquidity sweep + market structure shift + FVG displacement —
            once an automated scan is connected to a live market-data feed.
          </p>
        </div>

        <span className="text-xs font-mono px-3 py-1 rounded bg-[#101722] border border-slate-800 text-slate-300">
          0 Potential Setups Identified
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
          autonomous signals ("BUY NOW" or "SELL NOW"), and it never fabricates a candidate setup to fill this page — a
          setup only appears here once a real scan actually detects one. The trader retains complete sovereign
          discretionary judgment.
        </p>
      </div>

      {/* Honest empty state — no fabricated candidates */}
      <div className="bg-[#101722] border border-dashed border-slate-800 rounded-lg p-8 text-center space-y-3">
        <Search className="w-6 h-6 text-slate-500 mx-auto" />
        <h3 className="font-mono text-sm font-bold text-slate-200 uppercase">No automated scan connected</h3>
        <p className="text-xs text-slate-400 font-sans max-w-md mx-auto">
          This page has no live market-data feed or scanning engine wired up yet, so it shows nothing rather than invented
          candidates. Continue reviewing {assets.length > 0 ? `your ${assets.length} configured instruments` : 'your configured instruments'} manually
          in Asset Desks until a real scan is connected.
        </p>
      </div>
    </div>
  );
};
