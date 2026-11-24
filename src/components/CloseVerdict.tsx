import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { breaksRule } from '../utils/discipline';
import { DisciplineGauge } from './DisciplineVisuals';

const VERDICT = {
  GOOD_PROCESS_WIN: { title: 'Good process win.', body: 'You followed the plan and it paid. That is the edge doing its job.', tone: 'aqua' as const },
  GOOD_PROCESS_LOSS: { title: 'Good process loss. The system held.', body: 'Every rule was followed. Losses like this are part of the edge, not a mistake.', tone: 'aqua' as const },
  BAD_PROCESS_WIN: { title: 'A win, but off-plan.', body: 'The result was good; the process was not. Note what you broke so it does not repeat.', tone: 'amber' as const },
  BAD_PROCESS_LOSS: { title: 'Off-plan loss.', body: 'Name the rule that slipped in your reflection. The next trade starts clean.', tone: 'rose' as const },
};

/** The moment after closing a trade: judged on process, not outcome. */
export const CloseVerdict: React.FC = () => {
  const { trades, setActiveTab } = useTrading();
  const [tradeId, setTradeId] = useState<string | null>(null);

  useEffect(() => {
    const on = (e: Event) => setTradeId((e as CustomEvent<string>).detail);
    window.addEventListener('tos-trade-closed', on);
    return () => window.removeEventListener('tos-trade-closed', on);
  }, []);
  useEffect(() => {
    if (!tradeId) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setTradeId(null); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [tradeId]);

  const trade = trades.find((t) => t.id === tradeId);
  if (!trade || trade.status !== 'CLOSED') return null;
  const cat = trade.processCategory ?? (breaksRule(trade) ? (trade.outcome === 'WIN' ? 'BAD_PROCESS_WIN' : 'BAD_PROCESS_LOSS') : trade.outcome === 'WIN' ? 'GOOD_PROCESS_WIN' : 'GOOD_PROCESS_LOSS');
  const v = VERDICT[cat];
  const score = trade.processScore?.score ?? 0;
  const r = trade.realizedR ?? 0;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-md" onClick={() => setTradeId(null)}>
      <div className="tos-card tos-pop relative w-full max-w-sm p-7 text-center" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Trade closed">
        <button onClick={() => setTradeId(null)} className="absolute right-4 top-4 text-ink-3 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
        <div className="mx-auto w-fit"><DisciplineGauge pct={(score / 5) * 100} tone={v.tone} label="Process" sub={`${score}/5`} size={132} /></div>
        <div className="tos-label mt-5">{trade.asset} {trade.direction.toLowerCase()} · {r > 0 ? '+' : ''}{Math.round(r * 100) / 100}R</div>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-ink">{v.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{v.body}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => setTradeId(null)} className="tos-cta rounded-xl px-4 py-2 text-sm font-semibold">Continue</button>
          <button onClick={() => { setTradeId(null); setActiveTab('discipline'); }} className="tos-glass rounded-xl px-4 py-2 text-sm text-ink-2 hover:text-ink">See streaks</button>
        </div>
      </div>
    </div>
  );
};
