import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { useDecompositionData } from '../../context/DecompositionDataContext';
import { useDecompositionDefinitions } from '../../context/DecompositionDefinitionsContext';
import { deskStack, latestLayer, periodStepsFor, summarize, type StackLine } from '../../decomposition';
import type { AssetDeskData } from '../../types';
import { formatTradingTime } from '../../utils/timeDisplay';
import { SummaryCard, VerdictPill } from './SummaryCard';
import { fmtPrice } from './ui';
import { AnalysisSummary } from './AnalysisSummary';
import { CandlestickNarrative, CandlestickSection } from './CandlestickSection';

/** Asset Desk: structure → month → week → today, one line each; tap a line for the full record (UX rule 7). */
export const DeskDecompositionStack: React.FC<{ desk: AssetDeskData }> = ({ desk }) => {
  const { setActiveTab, timeView } = useTrading();
  const { mapFor, plans, profileFor, requestDecompose, notice } = useDecompositionData();
  const { current, definitionsFor } = useDecompositionDefinitions();
  const [open, setOpen] = useState<string>();
  const map = mapFor(desk.id);
  const now = new Date().toISOString();
  const lines = deskStack({ deskId: desk.id, symbol: desk.symbol, map, plans, now, profile: profileFor(desk.id, desk.category), definitionsFor, current });
  const decompose = (key: StackLine['key']) => {
    requestDecompose(desk.id, key === 'STRUCTURE' ? undefined : key);
    setActiveTab('decomposition');
  };

  return (
    <section className="tos-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-2">
        <div>
          <p className="tos-label">From your decomposition</p>
          <h3 className="text-base font-semibold text-ink">Structure and plans</h3>
        </div>
      </div>
      {notice && <p className="px-4 pb-2 text-xs text-ink-3">{notice}</p>}
      <ul className="divide-y divide-line">
        {lines.map((l) => {
          const key = l.planId ?? l.key;
          const expanded = open === key && !l.missing;
          return (
            <li key={key}>
              <button onClick={() => (l.missing ? decompose(l.key) : setOpen(expanded ? undefined : key))} aria-expanded={l.missing ? undefined : expanded}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-raised">
                <span className="w-28 shrink-0">
                  <span className="block text-sm font-semibold text-ink">{l.title}</span>
                  {l.when && <span className="block text-[11px] text-ink-3">{l.when}</span>}
                </span>
                <span className="min-w-0 flex-1 text-sm">{l.missing ? <span className="text-ink-3">{l.missing} · <span className="text-accent">Decompose</span></span> : <LineSummary l={l} />}</span>
                {!l.missing && <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-ink-3 transition ${expanded ? 'rotate-180' : ''}`} />}
              </button>
              {expanded && (
                <div className="px-4 pb-4">
                  {l.key === 'STRUCTURE' && map ? (
                    <div className="space-y-3">
                      <SummaryCard summary={summarize(map, definitionsFor, current)} />
                      {(['MONTHLY', 'WEEKLY', 'DAILY'] as const).map((tf) => {
                        const analysis = latestLayer(map, tf)?.data.analysis;
                        return analysis ? <details className="rounded-lg border border-line p-3" key={tf}>
                          <summary className="cursor-pointer text-sm font-medium capitalize">{tf.toLowerCase()} observations</summary>
                          <div className="mt-2"><AnalysisSummary analysis={analysis} timeframe={tf} /></div>
                        </details> : null;
                      })}
                      {l.asOf && <p className="text-xs text-ink-3">Read: {(['MONTHLY', 'WEEKLY', 'DAILY'] as const).filter((tf) => l.asOf?.[tf]).map((tf) => `${tf.toLowerCase()} ${formatTradingTime(l.asOf![tf]!, { view: timeView })}`).join(' · ')}</p>}
                    </div>
                  ) : <PlanDetail planId={l.planId!} showCandlestick={false} />}
                </div>
              )}
              {l.key !== 'STRUCTURE' && <CandlestickSection desk={desk} cadence={l.key} now={now} />}
            </li>
          );
        })}
      </ul>
      {map && latestLayer(map, 'DAILY') === undefined && <p className="px-4 pb-3 text-xs text-ink-3">The map has no Daily layer yet.</p>}
    </section>
  );
};

export const LineSummary: React.FC<{ l: StackLine }> = ({ l }) => {
  const bits: string[] = [];
  if (l.draw !== undefined) bits.push(`draw ${fmtPrice(l.draw)}`);
  if (l.poiA) bits.push(`A ${fmtPrice(l.poiA.low)}–${fmtPrice(l.poiA.high)}`);
  if (l.poiB) bits.push(`B ${fmtPrice(l.poiB.low)}–${fmtPrice(l.poiB.high)}`);
  if (l.invalidation !== undefined) bits.push(`invalid ${fmtPrice(l.invalidation)}`);
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {l.bias && <span className={`font-semibold ${l.bias === 'BEARISH' ? 'text-rose-300' : l.bias === 'BULLISH' ? 'text-emerald-300' : 'text-ink-2'}`}>{l.bias.toLowerCase()}</span>}
      <span className="text-ink-2 tabular-nums">{bits.join(' · ') || 'No levels yet'}</span>
      {l.verdict && <VerdictPill verdict={l.verdict} />}
    </span>
  );
};

/** The full plan, answers in process order (read-only here). */
export const PlanDetail: React.FC<{ planId: string; showCandlestick?: boolean }> = ({ planId, showCandlestick = true }) => {
  const { plans } = useDecompositionData();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return null;
  const r = plan.read as Record<string, { status: string; value?: unknown } | undefined>;
  const show = (key: string, v: unknown): string => {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v;
    if (key === 'formation') { const f = v as { primary?: { low: number; high: number }; backup?: { low: number; high: number }; depth?: string }; return [f.primary && `A ${fmtPrice(f.primary.low)}–${fmtPrice(f.primary.high)}`, f.backup && `B ${fmtPrice(f.backup.low)}–${fmtPrice(f.backup.high)}`, f.depth?.toLowerCase()].filter(Boolean).join(' · '); }
    if (key === 'draw') { const d = v as { target: number; kind: string }; return `${fmtPrice(d.target)} (${d.kind.toLowerCase()})`; }
    if (key === 'invalidation') return (v as { rule: string }).rule;
    if (key === 'liquidity') { const l = v as { levels: Array<{ price: number; swept: boolean }> }; return `${l.levels.length} levels, ${l.levels.filter((x) => x.swept).length} swept`; }
    if (key === 'entryModels') return `${(v as unknown[]).length} model${(v as unknown[]).length === 1 ? '' : 's'}`;
    if (typeof v === 'object') return Object.values(v as Record<string, unknown>).filter((x) => typeof x === 'string' || typeof x === 'number').map((x) => String(x).toLowerCase()).join(' · ');
    return String(v);
  };
  return <>
    {showCandlestick && plan.read.candlestickDecomposition && <CandlestickNarrative read={plan.read.candlestickDecomposition} />}
    <dl className="space-y-1.5 text-sm">
      {plan.read.completedCandle && <div className="rounded-lg border border-line bg-raised p-3">
        <dt className="font-semibold">Previous completed candle · {plan.read.completedCandle.candle.feed}</dt>
        <dd className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-ink-2 sm:grid-cols-4">
          {Object.entries(plan.read.completedCandle.prices).map(([label, price]) => <span key={label}>{label.toUpperCase()} {fmtPrice(price)}</span>)}
        </dd>
        <dd className="mt-2 text-ink-2">Body {fmtPrice(plan.read.completedCandle.metrics.body)} · upper wick {fmtPrice(plan.read.completedCandle.metrics.upperWick)} · lower wick {fmtPrice(plan.read.completedCandle.metrics.lowerWick)} · {plan.read.completedCandle.metrics.closeLocation.toLowerCase()} close</dd>
        {plan.read.comparison && <dd className="mt-2 text-ink-2">{plan.read.comparison.formation} · close change {fmtPrice(plan.read.comparison.closeChange)}{plan.read.comparison.rejectedHigh || plan.read.comparison.rejectedLow ? ' · rejected prior extreme' : ''}</dd>}
      </div>}
      {plan.read.alternativeScenario && <div className="grid gap-1 sm:grid-cols-[2fr_3fr]"><dt className="text-ink-3">Alternative scenario</dt><dd>{plan.read.alternativeScenario}</dd></div>}
      {plan.read.retracementHypothesis && <div className="grid gap-1 sm:grid-cols-[2fr_3fr]"><dt className="text-ink-3">Retracement hypothesis</dt><dd className="capitalize">{plan.read.retracementHypothesis.toLowerCase()}</dd></div>}
      {periodStepsFor(plan.cadence).map((s) => {
        const step = r[s.key];
        return (
          <div key={s.key} className="flex gap-3">
            <dt className="w-2/5 shrink-0 text-sm text-ink-3">{s.question}</dt>
            <dd className="min-w-0 break-words text-ink-2">{!step ? <span className="text-ink-3">—</span> : step.status !== 'IDENTIFIED' ? <span className="text-ink-3">{step.status.toLowerCase().replace('_', ' ')}</span> : show(s.key, step.value)}</dd>
          </div>
        );
      })}
      {plan.review && <div className="mt-2 rounded-xl bg-raised p-2.5 text-xs text-ink-2 ring-1 ring-inset ring-line">Reviewed: prediction {plan.review.prediction.toLowerCase()}, process {plan.review.process.toLowerCase()} · {plan.review.lesson}</div>}
    </dl>
  </>;
};
