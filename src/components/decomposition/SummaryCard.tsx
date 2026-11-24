import React from 'react';
import type { DecompositionSummary, LayerVerdict, PoiCheck } from '../../decomposition';
import { fmtPrice } from './ui';

export const VERDICT_LABEL: Record<LayerVerdict, string> = {
  INCOMPLETE: 'Not finished',
  LEAVE_CHART: 'Leave the chart',
  OBSERVATION_ONLY: 'Observe only',
  WATCH_POI: 'Watch the POI',
  CONTEXT_READY: 'Context set',
};

export const VerdictPill: React.FC<{ verdict: LayerVerdict }> = ({ verdict }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
    verdict === 'WATCH_POI' ? 'bg-emerald-500/12 text-emerald-300 ring-emerald-400/30'
      : verdict === 'CONTEXT_READY' ? 'bg-accent/12 text-ink ring-accent/40'
        : 'bg-raised text-ink-2 ring-line-strong'}`}>{VERDICT_LABEL[verdict]}</span>
);

export const PoiLine: React.FC<{ c: PoiCheck }> = ({ c }) => (
  <li className="rounded-xl bg-raised px-3 py-2 ring-1 ring-inset ring-line">
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="font-semibold text-ink">{c.role === 'PRIMARY' ? 'POI A' : 'POI B'} · {c.poi.side === 'SELL' ? 'sell' : 'buy'} {fmtPrice(c.poi.low)}–{fmtPrice(c.poi.high)}</span>
      <span className={`tabular-nums ${c.valid ? 'text-emerald-300' : 'text-ink-3'}`}>{c.rToDraw !== undefined ? `${c.rToDraw}R` : '—'} · {c.location.toLowerCase()}</span>
    </div>
    {!c.valid && c.problems[0] && <div className="mt-0.5 text-xs text-ink-3">{c.problems[0]}</div>}
  </li>
);

/** Summary first: the sentence, the verdict, then the details. */
export const SummaryCard: React.FC<{ summary: DecompositionSummary }> = ({ summary: s }) => (
  <div className="space-y-3">
    <div className="rounded-2xl bg-raised p-4 ring-1 ring-inset ring-line-strong">
      <div className="mb-2"><VerdictPill verdict={s.verdict} /></div>
      <p className="text-base leading-relaxed text-ink">{s.sentence}</p>
      <p className="mt-1.5 text-sm text-ink-3">{s.reason}</p>
    </div>
    {s.daily && s.daily.pois.length > 0 && <ul className="space-y-2">{s.daily.pois.map((c) => <PoiLine key={c.role} c={c} />)}</ul>}
    {s.daily && (
      <div className="grid grid-cols-2 gap-2 text-sm">
        {s.daily.inducement && <Fact label="Inducement" value={fmtPrice(s.daily.inducement.price)} />}
        {s.daily.target !== undefined && <Fact label="Target" value={fmtPrice(s.daily.target)} />}
        {s.daily.invalidation !== undefined && <Fact label="Invalidation" value={fmtPrice(s.daily.invalidation)} />}
        {s.daily.legType && <Fact label="Leg" value={s.daily.legType.toLowerCase()} />}
        {s.daily.depth && <Fact label="Depth expected" value={s.daily.depth.toLowerCase()} />}
        {s.daily.equilibrium !== undefined && <Fact label="Equilibrium" value={fmtPrice(s.daily.equilibrium)} />}
      </div>
    )}
    {s.usesOlderDefinitions && <p className="text-xs text-ink-3">Read with older definitions; it is judged by the version it used.</p>}
  </div>
);

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-well px-3 py-2 ring-1 ring-inset ring-line"><div className="text-xs text-ink-3">{label}</div><div className="font-semibold tabular-nums text-ink">{value}</div></div>
);
