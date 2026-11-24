import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FlaskConical, Layers } from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { useDecompositionData } from '../context/DecompositionDataContext';
import { useDecompositionDefinitions } from '../context/DecompositionDefinitionsContext';
import {
  CADENCE_LABEL, CADENCE_TIMEFRAME, accuracyRollup, backtestState, candleClosed, candleFor, dueNow, evaluatePeriodPlan, isStructureNewer, latestLayer, summarize, type Cadence, type DueItem,
} from '../decomposition';
import { weekdayInZone } from '../utils/traderTime';
import { matchDesk } from '../utils/weekly';
import type { AssetDeskData } from '../types';
import { PageTitle } from './PageTitle';
import { StructuralNotebook } from './decomposition/StructuralNotebook';
import { PlanFlow } from './decomposition/PlanFlow';
import { ReviewFlow } from './decomposition/ReviewFlow';
import { VerdictPill } from './decomposition/SummaryCard';
import { BacktestFlow, OutcomeFlow, RESULT_LABEL } from './decomposition/BacktestFlow';
import { LayerGuide } from './decomposition/LayerGuide';
import { PlanDetail } from './decomposition/DeskDecompositionStack';
import { formatTradingTime } from '../utils/timeDisplay';
import { queuePlanResearch } from '../utils/planResearchDraft';

type Route =
  | { screen: 'home' }
  | { screen: 'structure'; deskId: string; resume?: Cadence }
  | { screen: 'plan'; deskId: string; cadence: Cadence }
  | { screen: 'saved-plan'; planId: string }
  | { screen: 'review'; planId: string }
  | { screen: 'backtest'; deskId: string }
  | { screen: 'outcome'; recordId: string };

/** Market Decomposition: what's due, then each asset's map and plans. */
export const MarketDecompositionView: React.FC = () => {
  const { assets, tradingHQ, researchQuestions, backtestSamples, timeView, setActiveTab, setSelectedAssetId, setDeskTabRequest } = useTrading();
  const { structural, plans, loading, notice, mapFor, profileFor, pendingDeskId, pendingCadence, requestDecompose, pendingReviewId, requestReview, pendingPlanId, requestPlanView, backtests } = useDecompositionData();
  const { current: defs, definitionsFor } = useDecompositionDefinitions();
  const [route, setRoute] = useState<Route>({ screen: 'home' });
  const [showAll, setShowAll] = useState(false);
  const [researchError, setResearchError] = useState(false);

  const now = new Date().toISOString();
  const today = weekdayInZone(new Date());
  const focus = tradingHQ.focusRotation.find((d) => d.day === today);
  const focusDesks = useMemo(() => (focus?.assets ?? []).map((a) => matchDesk(assets, a)).filter((d): d is AssetDeskData => !!d), [focus, assets]);
  const profile = (deskId: string) => profileFor(deskId, assets.find((a) => a.id === deskId)?.category);
  const due = useMemo(() => dueNow({ now, focusDesks: focusDesks.map((d) => ({ id: d.id, symbol: d.symbol })), structural, plans, profileFor: profile }),
    [focusDesks, structural, plans]); // eslint-disable-line react-hooks/exhaustive-deps
  const accuracy = useMemo(() => accuracyRollup(plans.filter((p) => p.mode === 'LIVE')), [plans]);

  const desk = (id: string) => assets.find((a) => a.id === id);
  const close = () => setRoute({ screen: 'home' });

  useEffect(() => {
    if (!pendingPlanId || loading) return;
    setRoute({ screen: 'saved-plan', planId: pendingPlanId });
    requestPlanView(undefined);
  }, [pendingPlanId, loading, requestPlanView]);

  // Today → Review: open that plan's review.
  useEffect(() => {
    if (!pendingReviewId || loading) return;
    const id = pendingReviewId;
    requestReview(undefined);
    const plan = plans.find((p) => p.id === id);
    if (plan) setRoute({ screen: plan.review ? 'saved-plan' : 'review', planId: id });
  }, [pendingReviewId, loading, plans, requestReview]);

  // Asset Desk → "Decompose": open the next step for that desk (map first, then the first plan missing for the current candles).
  useEffect(() => {
    if (!pendingDeskId || loading) return;
    const d = desk(pendingDeskId);
    requestDecompose(undefined);
    if (!d) return;
    const map = mapFor(d.id);
    if (!map || !latestLayer(map, pendingCadence ? CADENCE_TIMEFRAME[pendingCadence] : 'DAILY') && !latestLayer(map, 'DAILY')) {
      setRoute({ screen: 'structure', deskId: d.id, resume: pendingCadence });
      return;
    }
    if (pendingCadence) {
      const candle = candleFor(pendingCadence, new Date().toISOString(), profile(d.id), d.symbol);
      const plan = plans.find((x) => x.deskId === d.id && x.cadence === pendingCadence && x.mode === 'LIVE'
        && x.candle.feed === candle.feed && Date.parse(x.candle.openTime) === Date.parse(candle.openTime));
      setRoute(plan ? { screen: 'saved-plan', planId: plan.id } : { screen: 'plan', deskId: d.id, cadence: pendingCadence });
      return;
    }
    const missing = (['MONTH', 'WEEK', 'DAY'] as Cadence[]).find((c) => {
      const candle = candleFor(c, new Date().toISOString(), profile(d.id), d.symbol);
      return !plans.some((x) => x.deskId === d.id && x.cadence === c && x.mode === 'LIVE' && x.candle.feed === candle.feed && Date.parse(x.candle.openTime) === Date.parse(candle.openTime));
    });
    setRoute(missing ? { screen: 'plan', deskId: d.id, cadence: missing } : { screen: 'structure', deskId: d.id });
  }, [pendingDeskId, pendingCadence, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (route.screen === 'structure') {
    const d = desk(route.deskId);
    const resume = route.resume;
    return d ? <StructuralNotebook key={d.id} deskId={d.id} symbol={d.symbol} initialTimeframe={resume && CADENCE_TIMEFRAME[resume]} onClose={resume ? () => setRoute({ screen: 'plan', deskId: d.id, cadence: resume }) : close} /> : null;
  }
  if (route.screen === 'plan') {
    const d = desk(route.deskId);
    const cadence = route.cadence;
    return d ? <PlanFlow deskId={d.id} symbol={d.symbol} category={d.category} cadence={cadence} onClose={close}
      onSaved={(planId) => setRoute({ screen: 'saved-plan', planId })}
      onOpenStructure={() => setRoute({ screen: 'structure', deskId: d.id, resume: cadence })} /> : null;
  }
  if (route.screen === 'saved-plan') {
    const plan = plans.find((entry) => entry.id === route.planId);
    const asset = plan && desk(plan.deskId);
    if (!plan) return <div className="p-6"><p role="status">This plan is unavailable.</p><button className="tos-secondary mt-3" onClick={close}>Back to Decomposition</button></div>;
    const closed = candleClosed(plan.candle, now);
    const map = structural.find((record) => record.id === plan.structuralVersionRef.structuralRecordId);
    const definitions = definitionsFor(plan.definitionsVersion) ?? defs;
    let gate: ReturnType<typeof evaluatePeriodPlan> | undefined;
    if (map) {
      try { gate = evaluatePeriodPlan(map, plan, definitions); }
      catch { /* A historical plan remains readable if its structural versions are unavailable. */ }
    }
    const currentCandle = asset && candleFor(plan.cadence, now, profile(asset.id), asset.symbol);
    const currentMap = mapFor(plan.deskId);
    const canMonitor = !closed && gate?.verdict === 'WATCH_POI' && currentCandle?.feed === plan.candle.feed
      && Date.parse(currentCandle.openTime) === Date.parse(plan.candle.openTime)
      && currentMap?.id === map?.id && !!currentMap && !isStructureNewer(currentMap, plan.structuralVersionRef);
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
        <button className="tos-secondary" onClick={close}>Back to Decomposition</button>
        <PageTitle icon={Layers} title={`${plan.candle.symbol} · ${CADENCE_LABEL[plan.cadence]} plan`} description={plan.candle.feed} />
        <section className="tos-card space-y-4 p-4 sm:p-5" aria-label="Saved plan">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><dt className="tos-label">Opens</dt><dd>{formatTradingTime(plan.candle.openTime, { view: timeView })}</dd></div>
            {plan.candle.closeTime && <div><dt className="tos-label">Closes</dt><dd>{formatTradingTime(plan.candle.closeTime, { view: timeView })}</dd></div>}
          </dl>
          {gate && <div className="space-y-1"><VerdictPill verdict={gate.verdict} /><p className="text-sm text-ink-2">{gate.reason}</p></div>}
          {!gate && <p className="text-sm text-ink-2">The saved plan is available. Its structural verdict cannot be reconstructed.</p>}
          <PlanDetail planId={plan.id} />
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {closed && !plan.review && <button className="tos-cta rounded-lg px-3 py-2 text-sm" onClick={() => setRoute({ screen: 'review', planId: plan.id })}>Review closed candle</button>}
            {asset && <button className="tos-secondary" onClick={() => {
              setSelectedAssetId(asset.id);
              setDeskTabRequest(canMonitor ? 'setups' : 'overview');
              setActiveTab('asset-desks');
            }}>{canMonitor ? 'Open setup workspace' : 'Open asset desk'}</button>}
            {plan.review && plan.review.prediction !== 'CORRECT' && <button className="tos-secondary" onClick={() => {
              const ok = queuePlanResearch({ planId: plan.id, asset: plan.candle.symbol, title: `Investigate ${plan.candle.symbol} ${CADENCE_LABEL[plan.cadence]} delivery`, observation: plan.review!.lesson });
              if (ok) setActiveTab('research');
              else setResearchError(true);
            }}>Investigate missed expectation</button>}
          </div>
          {researchError && <p role="alert" className="text-sm text-rose-300">Could not pass the observation to Research. The review is still saved here.</p>}
        </section>
      </div>
    );
  }
  if (route.screen === 'backtest') {
    const d = desk(route.deskId);
    return d ? <BacktestFlow deskId={d.id} symbol={d.symbol} onClose={close} onSaved={(rec) => setRoute({ screen: 'outcome', recordId: rec.id })} /> : null;
  }
  if (route.screen === 'outcome') {
    const rec = backtests.find((r) => r.id === route.recordId);
    return rec ? <OutcomeFlow record={rec} onClose={close} /> : null;
  }
  if (route.screen === 'review') {
    const p = plans.find((x) => x.id === route.planId);
    return p ? <ReviewFlow plan={p} onClose={() => setRoute({ screen: 'saved-plan', planId: p.id })} /> : null;
  }

  const open = (item: DueItem) => {
    if (item.kind === 'REVIEW' && item.planId) setRoute({ screen: 'review', planId: item.planId });
    else if (item.kind === 'BUILD_STRUCTURE') setRoute({ screen: 'structure', deskId: item.deskId });
    else if (item.cadence) setRoute({ screen: 'plan', deskId: item.deskId, cadence: item.cadence });
  };

  const others = assets.filter((a) => !focusDesks.some((f) => f.id === a.id));

  return (
    <div className="tos-workspace p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageTitle icon={Layers} title="Decomposition" description="Understand the market, then plan the month, week and day inside that story." />
      {notice && <div className="rounded-2xl bg-raised px-4 py-3 text-sm text-ink-2 ring-1 ring-inset ring-line-strong">{notice}</div>}

      <section className="tos-card tos-rise p-5">
        <h2 className="tos-label mb-3">Due now{focus ? ` · ${today}: ${focus.assets.join(' / ')}` : ''}</h2>
        {loading ? <p className="text-sm text-ink-3">Loading…</p> : due.length === 0 ? (
          <p className="text-sm text-ink-2">Nothing due right now.</p>
        ) : (
          <ul className="space-y-2.5">
            {due.map((g) => (
              <li key={g.key} className="rounded-2xl bg-raised p-3 ring-1 ring-inset ring-line">
                <div className="text-sm font-semibold text-ink">{g.title}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.items.map((it) => (
                    <button key={`${it.deskId}-${it.planId ?? it.cadence ?? 'map'}`} onClick={() => open(it)} className="tos-cta inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold">
                      {it.kind === 'REVIEW' ? 'Review' : it.kind === 'BUILD_STRUCTURE' ? 'Map' : 'Plan'} {it.symbol} <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LayerGuide />

      <section className="space-y-3">
        <h2 className="tos-label">{focusDesks.length ? "Today's focus" : 'Assets'}</h2>
        {(focusDesks.length ? focusDesks : assets).map(renderAsset)}
        {focusDesks.length > 0 && others.length > 0 && (
          <>
            <button onClick={() => setShowAll((v) => !v)} className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
              Other assets ({others.length}) <ChevronDown className={`h-4 w-4 transition ${showAll ? 'rotate-180' : ''}`} />
            </button>
            {showAll && others.map(renderAsset)}
          </>
        )}
      </section>

      {plans.some((plan) => plan.mode === 'LIVE') && (
        <section className="tos-card p-5">
          <h2 className="tos-label mb-3">Plan history</h2>
          <ul className="divide-y divide-line">
            {plans.filter((plan) => plan.mode === 'LIVE').sort((a, b) => Date.parse(b.candle.openTime) - Date.parse(a.candle.openTime)).slice(0, 12).map((plan) => (
              <li key={plan.id}>
                <button className="flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left text-sm hover:text-accent" onClick={() => setRoute({ screen: 'saved-plan', planId: plan.id })}>
                  <span>{plan.candle.symbol} · {CADENCE_LABEL[plan.cadence]} · {formatTradingTime(plan.candle.openTime, { view: timeView })}</span>
                  <span className="text-xs text-ink-2">{plan.review ? 'Reviewed' : candleClosed(plan.candle, now) ? 'Review due' : 'Current candle'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {backtests.length > 0 && (
        <section className="tos-card p-5">
          <h2 className="tos-label mb-3 inline-flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> Backtests</h2>
          {(() => {
            const awaiting = backtests.filter((b) => backtestState(b) !== 'DONE');
            const done = backtests.filter((b) => backtestState(b) === 'DONE');
            const unsampled = done.filter((b) => !backtestSamples.some((s) => s.decompositionRecordId === b.id));
            const byRq = new Map<string, number>();
            done.forEach((b) => byRq.set(b.researchQuestionId ?? '', (byRq.get(b.researchQuestionId ?? '') ?? 0) + 1));
            return <div className="space-y-3">
              {[...awaiting, ...unsampled].length > 0 && <ul className="space-y-2">
                {[...awaiting, ...unsampled].map((b) => {
                  const d = latestLayer(b, 'DAILY');
                  return <li key={b.id}><button onClick={() => setRoute({ screen: 'outcome', recordId: b.id })} className="flex w-full items-center justify-between gap-2 rounded-xl bg-raised px-3 py-2 text-left text-sm ring-1 ring-inset ring-line hover:ring-accent/50">
                    <span className="text-ink">{b.symbol}{d ? ` · read ${d.asOf.slice(0, 10)}` : ''}</span>
                    <span className="text-xs font-semibold text-ink-2">{backtestState(b) === 'NEEDS_READ' ? 'Read missing' : backtestState(b) === 'DONE' ? 'Create sample' : 'Record outcome'} <ChevronRight className="inline h-3.5 w-3.5" /></span>
                  </button></li>;
                })}
              </ul>}
              {done.length > 0 && <div className="flex flex-wrap gap-2 text-xs text-ink-2">
                {[...byRq].map(([id, count]) => {
                  const q = researchQuestions.find((r) => r.id === id);
                  return <span key={id || 'none'} className="rounded-full bg-well px-2.5 py-1 ring-1 ring-inset ring-line">{q ? q.code : 'No question'} · {count} closed</span>;
                })}
                <span className="rounded-full bg-well px-2.5 py-1 ring-1 ring-inset ring-line">Last: {RESULT_LABEL[done[0].outcome!.result].toLowerCase()}</span>
              </div>}
            </div>;
          })()}
        </section>
      )}

      {(accuracy.byCadence.DAY || accuracy.byCadence.WEEK || accuracy.byCadence.MONTH) && (
        <section className="tos-card p-5">
          <h2 className="tos-label mb-3">Measured accuracy</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['MONTH', 'WEEK', 'DAY'] as Cadence[]).map((c) => {
              const s = accuracy.byCadence[c];
              return (
                <div key={c} className="rounded-2xl bg-raised p-3 ring-1 ring-inset ring-line">
                  <div className="text-xs text-ink-3">{CADENCE_LABEL[c][0].toUpperCase() + CADENCE_LABEL[c].slice(1)} plans</div>
                  {s ? <>
                    <div className="mt-1 text-sm text-ink">Prediction <b className="tos-figure">{s.prediction.pct}%</b> · Process <b className="tos-figure">{s.process.pct}%</b></div>
                    <div className="text-xs text-ink-3">{s.reviewed} reviewed</div>
                  </> : <div className="mt-1 text-sm text-ink-3">None reviewed yet</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );

  function renderAsset(a: AssetDeskData) {
    const map = mapFor(a.id);
    const s = map && latestLayer(map, 'DAILY') ? summarize(map, definitionsFor, defs) : undefined;
    const p = profile(a.id);
    const planFor = (c: Cadence) => {
      const candle = candleFor(c, now, p, a.symbol);
      return plans.find((x) => x.deskId === a.id && x.cadence === c && x.mode === 'LIVE' && x.candle.feed === candle.feed && Date.parse(x.candle.openTime) === Date.parse(candle.openTime));
    };
    return (
      <div className="tos-card p-4" key={a.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="text-base font-semibold text-ink">{a.symbol}</span>{s && <VerdictPill verdict={s.verdict} />}</div>
            <p className="mt-1 text-sm text-ink-2">{s ? s.sentence : map ? 'Map started; add the Daily layer.' : 'No structural map yet.'}</p>
            {map && <p className="mt-0.5 text-xs text-ink-3">Map revision {map.layers.length}{latestLayer(map, 'DAILY') ? ` · Daily read ${new Date(latestLayer(map, 'DAILY')!.asOf).toLocaleDateString()}` : ''}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRoute({ screen: 'backtest', deskId: a.id })} className="rounded-xl bg-raised px-3 py-1.5 text-xs font-medium text-ink-3 ring-1 ring-inset ring-line hover:text-ink">Backtest</button>
            <button onClick={() => setRoute({ screen: 'structure', deskId: a.id })} className="rounded-xl bg-raised px-3 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line hover:text-ink">{map ? 'Update map' : 'Build map'}</button>
          </div>
        </div>
        {map && map.layers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(['MONTH', 'WEEK', 'DAY'] as Cadence[]).map((c) => {
              const plan = planFor(c);
              return (
                <button key={c} onClick={() => setRoute(plan ? { screen: 'saved-plan', planId: plan.id } : { screen: 'plan', deskId: a.id, cadence: c })}
                  className={`rounded-xl px-3 py-1.5 text-xs ring-1 ring-inset ${plan ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/25' : 'bg-raised text-ink-2 ring-line hover:text-ink hover:ring-accent/50'}`}>
                  {plan ? 'View' : 'Build'} {CADENCE_LABEL[c]} plan
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
};
