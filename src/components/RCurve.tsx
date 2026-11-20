import React, { useMemo } from 'react';
import type { Trade } from '../types';
import { breaksRule } from '../utils/discipline';

/** Cumulative R over closed trades, with each trade's bar coloured by process
 * (teal = plan followed, rose = a rule broken), so results and discipline read together. */
export const RCurve: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  const data = useMemo(() => {
    const closed = trades.filter((t) => t.status === 'CLOSED' && !t.voided && typeof t.realizedR === 'number')
      .sort((a, b) => (a.closedAt ?? a.timestamp) - (b.closedAt ?? b.timestamp)).slice(-60);
    let cum = 0;
    return closed.map((t) => ({ id: t.id, r: t.realizedR!, cum: (cum += t.realizedR!), good: !breaksRule(t), label: `${t.date} ${t.asset} ${t.realizedR! > 0 ? '+' : ''}${t.realizedR}R` }));
  }, [trades]);
  if (data.length < 2) return null;
  const W = 720, H = 150, pad = 8;
  const maxAbsBar = Math.max(1, ...data.map((d) => Math.abs(d.r)));
  const cums = data.map((d) => d.cum);
  const lo = Math.min(0, ...cums), hi = Math.max(0, ...cums);
  const y = (v: number) => pad + (H - 2 * pad) * (1 - (v - lo) / Math.max(1e-6, hi - lo));
  const step = (W - 2 * pad) / data.length;
  const x = (i: number) => pad + step * (i + 0.5);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.cum).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)} ${y(lo)} L${x(0).toFixed(1)} ${y(lo)} Z`;
  const total = data[data.length - 1].cum;
  const followed = data.filter((d) => d.good).length;
  const barH = 34;
  return (
    <section className="tos-card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">R curve <span className="font-normal text-ink-3">· last {data.length} closed trades</span></h2>
        <p className="text-xs text-ink-3"><span className={`tos-figure text-sm ${total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{total > 0 ? '+' : ''}{Math.round(total * 100) / 100}R</span> · plan followed on {followed} of {data.length}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H + barH + 6}`} className="w-full h-48" preserveAspectRatio="none" role="img" aria-label="Cumulative R with process per trade">
        <defs>
          <linearGradient id="rcFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity=".28" /><stop offset="1" stopColor="#2dd4bf" stopOpacity="0" /></linearGradient>
        </defs>
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="var(--tos-line-strong)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        <path d={area} fill="url(#rcFill)" />
        <path d={line} fill="none" stroke="#2dd4bf" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        <g transform={`translate(0 ${H + 6})`}>
          <line x1={pad} x2={W - pad} y1={barH / 2} y2={barH / 2} stroke="var(--tos-line)" />
          {data.map((d, i) => {
            const h = Math.max(2, (Math.abs(d.r) / maxAbsBar) * (barH / 2 - 1));
            return <rect key={d.id} x={x(i) - Math.max(1, step * 0.32)} width={Math.max(2, step * 0.64)} y={d.r >= 0 ? barH / 2 - h : barH / 2} height={h} rx="1.5"
              fill={d.good ? '#2dd4bf' : '#fb7185'} opacity={d.good ? 0.85 : 0.9}><title>{`${d.label} · ${d.good ? 'plan followed' : 'rule broken'}`}</title></rect>;
          })}
        </g>
      </svg>
      <div className="mt-2 flex gap-4 text-[10px] text-ink-3">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-teal-400" />Plan followed</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose-400" />Rule broken</span>
      </div>
    </section>
  );
};
