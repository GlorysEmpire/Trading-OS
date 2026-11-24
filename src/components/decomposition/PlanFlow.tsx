import React, { useMemo, useState } from 'react';
import {
  CADENCE_LABEL, FEED_PRESETS, candleFor, candleLabel, dailyPoiChecks, depthExpectation, evaluatePeriodPlan, isIdentified, latestLayer,
  legTypeOf, morningGate, parentCadence, parentNotice, periodAsDaily, periodStepsFor, rToDraw, startPeriodPlan,
  type Cadence, type DailyLayer, type DayExtras, type FeedProfile, type PeriodPlan, type PeriodRead, type PeriodStepKey, type Poi,
  type StepStatus, type StructuralChangeReason, type WeeklyLayer,
} from '../../decomposition';
import { useDecompositionData } from '../../context/DecompositionDataContext';
import { useDecompositionDefinitions } from '../../context/DecompositionDefinitionsContext';
import { useTrading } from '../../context/TradingContext';
import { newPlanId } from '../../lib/decompositionStore';
import type { AssetCategory } from '../../types';
import { formatTradingTime } from '../../utils/timeDisplay';
import { Choice, Computed, GateNote, LevelList, PickList, PriceField, StatusChoice, StepFrame, fmtPrice, levelKindLabel, poiComplete } from './ui';
import { PoiLine, VerdictPill } from './SummaryCard';

type Read = Partial<PeriodRead & DayExtras>;
type Screen = 'gate' | 'candle' | PeriodStepKey | 'summary';

const REASONS: Array<[StructuralChangeReason, string]> = [
  ['DAILY_BOS', 'Daily BOS'], ['DAILY_CHOCH', 'Daily CHoCH'], ['H4_BOS', '4H BOS'], ['H4_CHOCH', '4H CHoCH'], ['POI_MITIGATED', 'POI mitigated'], ['POI_INVALIDATED', 'POI invalidated'],
];

/** One plan (Monthly / Weekly / Daily): gate → candle → P1–P7 (+ Day extras) → summary. */
export const PlanFlow: React.FC<{ deskId: string; symbol: string; category?: AssetCategory; cadence: Cadence; onClose: () => void; onOpenStructure: () => void }> = ({ deskId, symbol, category, cadence, onClose, onOpenStructure }) => {
  const { mapFor, plans, savePlan, profileFor, setProfile, notice } = useDecompositionData();
  const { current: defs } = useDecompositionDefinitions();
  const { tradingHQ, timeView } = useTrading();
  const map = mapFor(deskId);
  const base = map ? latestLayer(map, 'DAILY')?.data as DailyLayer | undefined : undefined;
  const htfPois = useMemo(() => {
    const out: Poi[] = [];
    if (base && isIdentified(base.pois)) { if (base.pois.value.primary) out.push(base.pois.value.primary); if (base.pois.value.backup) out.push(base.pois.value.backup); }
    for (const tf of ['WEEKLY', 'MONTHLY'] as const) {
      const l = map ? latestLayer(map, tf)?.data as WeeklyLayer | undefined : undefined;
      if (l && isIdentified(l.pois)) { const name = tf === 'WEEKLY' ? 'Weekly' : 'Monthly'; out.push(...l.pois.value.map((p) => ({ ...p, label: p.label.startsWith(name) ? p.label : `${name} ${p.label}` }))); }
    }
    return out.filter(poiComplete);
  }, [map, base]);

  const [profile, setProfileState] = useState<FeedProfile>(() => profileFor(deskId, category));
  const candle = useMemo(() => candleFor(cadence, new Date().toISOString(), profile, symbol), [cadence, profile, symbol]);
  const existing = plans.find((p) => p.deskId === deskId && p.cadence === cadence && p.mode === 'LIVE' && p.candle.feed === candle.feed && Date.parse(p.candle.openTime) === Date.parse(candle.openTime));
  const up = parentCadence(cadence);
  const parent = up ? plans.filter((p) => p.deskId === deskId && p.cadence === up && p.mode === 'LIVE' && Date.parse(p.candle.openTime) <= Date.parse(candle.openTime))
    .sort((a, b) => b.candle.openTime.localeCompare(a.candle.openTime))[0] : undefined;

  const [changed, setChanged] = useState<boolean>();
  const [reasons, setReasons] = useState<StructuralChangeReason[]>([]);
  const [answeredAt, setAnsweredAt] = useState<string>();
  const [stands, setStands] = useState<boolean>();
  const [read, setRead] = useState<Read>(() => prefill(base));
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  const stepKeys = periodStepsFor(cadence);
  const screens: Screen[] = ['gate', 'candle', ...stepKeys.map((s) => s.key), 'summary'];
  const screen = screens[idx];
  const title = `${symbol} · ${CADENCE_LABEL[cadence][0].toUpperCase()}${CADENCE_LABEL[cadence].slice(1)} plan`;
  const progress = (idx + 1) / screens.length;
  const back = idx > 0 ? () => setIdx(idx - 1) : undefined;
  const next = () => setIdx(Math.min(idx + 1, screens.length - 1));

  if (!map || !base) {
    return (
      <StepFrame title={title} stepLabel="Before you plan" progress={0} question="Build the structural map first." why="Every plan is read inside the structural story (at least its Daily layer)." onClose={onClose} onNext={onOpenStructure} nextLabel="Build the map">
        <GateNote title="No structural map yet">Map the Monthly, Weekly and Daily structure in your backtesting block, then come back to plan.</GateNote>
      </StepFrame>
    );
  }

  const gateCheck = changed === undefined || !answeredAt ? undefined : { answeredAt, structureChanged: changed, reasons: changed ? reasons : [], ...(parent ? { higherPlanStands: stands } : {}) };
  const structural = morningGate(map, gateCheck);

  // ---- P0 gate -----------------------------------------------------------------
  if (screen === 'gate') {
    return (
      <StepFrame title={title} stepLabel="P0 · Gate" progress={progress} question="Has structure changed since the last plan?"
        why="A body-close BOS or CHoCH on the Daily or 4H, or a POI mitigated or invalidated, means the map needs updating first."
        onClose={onClose} onNext={next} nextDisabled={structural.next !== 'START_DAILY' || (!!parent && stands === undefined)}>
        <Choice value={changed === undefined ? undefined : changed ? 'yes' : 'no'} onChange={(v) => { setChanged(v === 'yes'); setAnsweredAt(new Date().toISOString()); }} options={[['no', 'No, the map stands'], ['yes', 'Yes, it changed']]} />
        {changed && (
          <div className="space-y-2">
            <div className="text-xs text-ink-3">What changed? (tap all that apply)</div>
            <div className="flex flex-wrap gap-2">{REASONS.map(([r, label]) => (
              <button key={r} onClick={() => setReasons((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]))} aria-pressed={reasons.includes(r)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${reasons.includes(r) ? 'bg-accent/15 text-ink ring-accent/60' : 'bg-raised text-ink-2 ring-line'}`}>{label}</button>
            ))}</div>
          </div>
        )}
        {structural.next === 'UPDATE_STRUCTURE' && (
          <GateNote title="Update the structural map first.">
            Then come back here; the plan continues on the new version.
            <div className="mt-3"><button onClick={onOpenStructure} className="tos-cta rounded-xl px-4 py-2 text-sm font-semibold">Update the map</button></div>
          </GateNote>
        )}
        {up && (parent ? (
          <div className="space-y-2 pt-1">
            <div className="text-sm font-medium text-ink">Does the {CADENCE_LABEL[up]} plan still stand?</div>
            <p className="text-sm text-ink-3">{parent.read.narrative?.value || 'No narrative written.'}</p>
            <Choice value={stands === undefined ? undefined : stands ? 'yes' : 'no'} onChange={(v) => setStands(v === 'yes')} options={[['yes', 'Yes'], ['no', 'No, it no longer stands']]} />
          </div>
        ) : <p className="text-sm text-ink-3">No {CADENCE_LABEL[up]} plan yet. This plan is read on the structural map alone.</p>)}
      </StepFrame>
    );
  }

  // ---- Candle ------------------------------------------------------------------
  if (screen === 'candle') {
    return (
      <StepFrame title={title} stepLabel="Which candle" progress={progress} question={`Is this the ${CADENCE_LABEL[cadence]} candle on your chart?`}
        why="A plan belongs to the candle your chart prints for this symbol and feed." more="Session windows still use New York time; this only decides which candle the plan is about."
        onClose={onClose} onBack={back} onNext={() => { setProfile(deskId, profile); next(); }} nextDisabled={!!existing || !profile.feed.trim()} nextLabel="Yes, this candle">
        <div className="flex flex-wrap gap-2">{FEED_PRESETS.map((p) => (
          <button key={p.label} onClick={() => setProfileState({ feed: p.feed, zone: p.zone, time: p.time })} aria-pressed={profile.zone === p.zone && profile.time === p.time}
            className={`rounded-xl px-3 py-2 text-sm ring-1 ring-inset ${profile.zone === p.zone && profile.time === p.time ? 'bg-accent/15 text-ink ring-accent/60' : 'bg-raised text-ink-2 ring-line'}`}>{p.label}</button>
        ))}</div>
        <label className="block"><span className="text-sm text-ink-2">Data feed / exchange</span>
          <input value={profile.feed} onChange={(e) => setProfileState({ ...profile, feed: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl bg-raised px-3 py-2.5 text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-accent/60" />
        </label>
        <Computed label="Candle" value={candleLabel(cadence, candle, profile)} />
        <Computed label="Opens" value={formatTradingTime(candle.openTime, { view: timeView })} />
        <Computed label="Closes (review due)" value={formatTradingTime(candle.closeTime!, { view: timeView })} />
        {existing && <GateNote title={`There is already a ${CADENCE_LABEL[cadence]} plan for this candle.`}>One plan per candle; it is listed on the Decomposition page.</GateNote>}
      </StepFrame>
    );
  }

  // ---- Summary -------------------------------------------------------------------
  if (screen === 'summary') {
    let plan: PeriodPlan | undefined;
    let error: string | undefined;
    try {
      plan = { ...startPeriodPlan({ id: newPlanId(), cadence, candle, createdAt: new Date().toISOString(), structural: map, gate: gateCheck, parent, definitionsVersion: defs.version }), read };
    } catch (e) { error = e instanceof Error ? e.message : String(e); }
    const gate = plan ? evaluatePeriodPlan(map, plan, defs) : undefined;
    const checks = plan && cadence === 'DAY' ? dailyPoiChecks(periodAsDaily(map, plan), defs) : [];
    const note = plan ? parentNotice(plan, parent) : undefined;
    const save = async () => {
      if (!plan) return;
      setSaving(true); setMessage(undefined);
      try { await savePlan(plan); onClose(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save.'); } finally { setSaving(false); }
    };
    return (
      <StepFrame title={title} stepLabel="Summary" progress={1} question="Save this plan?" why="The plan is fixed once its candle is reviewed." onClose={onClose} onBack={back}
        onNext={save} nextLabel={saving ? 'Saving…' : 'Save plan'} nextDisabled={!plan || saving || !!notice}>
        {gate && (
          <div className="rounded-2xl bg-raised p-4 ring-1 ring-inset ring-line-strong">
            <div className="mb-2"><VerdictPill verdict={gate.verdict} /></div>
            <p className="text-base leading-relaxed text-ink">{read.narrative?.value || '—'}</p>
            <p className="mt-1.5 text-sm text-ink-3">{gate.reason}</p>
          </div>
        )}
        {checks.length > 0 && <ul className="space-y-2">{checks.map((c) => <PoiLine key={c.role} c={c} />)}</ul>}
        {note && <p className="text-sm text-ink-3">{note}</p>}
        {cadence !== 'DAY' && <p className="text-sm text-ink-3">{CADENCE_LABEL[cadence][0].toUpperCase() + CADENCE_LABEL[cadence].slice(1)} plans set context. Only a Daily plan with a valid POI allows setups.</p>}
        {error && <GateNote title="Can't start the plan">{error}</GateNote>}
        {notice && <GateNote title="Can't save yet">{notice}</GateNote>}
        {message && <GateNote title="Not saved">{message}</GateNote>}
      </StepFrame>
    );
  }

  // ---- One question (P1–P7, Day extras) -------------------------------------------------
  const def = stepKeys.find((s) => s.key === screen)!;
  const step = read[def.key] as { status: StepStatus; value?: any } | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  const set = (s: { status: StepStatus; value?: unknown }) => setRead((r) => ({ ...r, [def.key]: s }));
  const setValue = (value: unknown) => set({ status: 'IDENTIFIED', value });
  const ready = !!step && (step.status !== 'IDENTIFIED' || readyValue(def.key, step.value));
  const stepNo = stepKeys.findIndex((s) => s.key === def.key) + 1;
  return (
    <StepFrame title={title} stepLabel={`${def.code} · ${stepNo} of ${stepKeys.length}`} progress={progress} question={def.question} why={def.why}
      onClose={onClose} onBack={back} onNext={next} nextDisabled={!ready}>
      <StatusChoice value={step?.status} onChange={(status) => set({ ...(step ?? {}), status })} />
      {step?.status === 'IDENTIFIED' && (
        <StepEditor stepKey={def.key} value={step.value} setValue={setValue} read={read} base={base} htfPois={htfPois} defs={defs}
          sessions={tradingHQ.sessions.map((s) => s.name)} models={tradingHQ.executionModels.map((m) => ({ id: m.id, name: m.name }))} />
      )}
    </StepFrame>
  );
};

/** Prefill from the structural map: liquidity levels, POI A/B and invalidation (pick, don't type). */
function prefill(base?: DailyLayer): Read {
  if (!base) return {};
  const r: Read = {};
  if (isIdentified(base.liquidity)) r.liquidity = { status: 'IDENTIFIED', value: { levels: base.liquidity.value.levels, inducementId: base.liquidity.value.inducementId } };
  if (isIdentified(base.pois)) r.formation = { status: 'IDENTIFIED', value: { primary: base.pois.value.primary, backup: base.pois.value.backup, ...(isIdentified(base.depth) ? { depth: base.depth.value } : {}) } };
  if (isIdentified(base.targetInvalidation)) {
    r.invalidation = { status: 'IDENTIFIED', value: { price: base.targetInvalidation.value.invalidation, rule: `Body close beyond ${fmtPrice(base.targetInvalidation.value.invalidation)}` } };
    r.draw = { status: 'IDENTIFIED', value: { target: base.targetInvalidation.value.target, kind: 'EXTERNAL' } };
  }
  return r;
}

function readyValue(key: PeriodStepKey, v: any): boolean { // eslint-disable-line @typescript-eslint/no-explicit-any
  const n = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  if (v === undefined) return false;
  switch (key) {
    case 'previousCandle': return !!v.read && !!v.closeLocation && !!v.took;
    case 'liquidity': return Array.isArray(v.levels);
    case 'asiaRange': return n(v.high) && n(v.low) && v.high > v.low;
    case 'periodType': return typeof v === 'string';
    case 'draw': return n(v.target) && !!v.kind;
    case 'formation': return poiComplete(v.primary);
    case 'invalidation': return n(v.price) && !!String(v.rule ?? '').trim();
    case 'timing': return !!v.window;
    case 'entryModels': return Array.isArray(v) && v.length > 0;
    case 'narrative': return typeof v === 'string' && v.trim().length > 0;
    default: return true;
  }
}

const StepEditor: React.FC<{
  stepKey: PeriodStepKey; value: any; setValue: (v: unknown) => void; read: Read; base: DailyLayer; htfPois: Poi[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  defs: ReturnType<typeof useDecompositionDefinitions>['current']; sessions: string[]; models: Array<{ id: string; name: string }>;
}> = ({ stepKey, value, setValue, read, base, htfPois, defs, sessions, models }) => {
  const v = value ?? {};
  switch (stepKey) {
    case 'previousCandle':
      return (
        <div className="space-y-3">
          <Choice value={v.read} onChange={(r) => setValue({ ...v, read: r })} options={[['EXPANSION', 'Expansion'], ['REJECTION', 'Rejection'], ['INDECISION', 'Indecision'], ['INSIDE', 'Inside']]} />
          <div><div className="mb-1.5 text-xs text-ink-3">Closed in its range</div><Choice size="sm" value={v.closeLocation} onChange={(closeLocation) => setValue({ ...v, closeLocation })} options={[['HIGH', 'High'], ['MID', 'Middle'], ['LOW', 'Low']]} /></div>
          <div><div className="mb-1.5 text-xs text-ink-3">Took the previous period's</div><Choice size="sm" value={v.took} onChange={(took) => setValue({ ...v, took })} options={[['HIGH', 'High'], ['LOW', 'Low'], ['BOTH', 'Both'], ['NONE', 'Neither']]} /></div>
          {v.took && v.took !== 'NONE' && <Choice size="sm" value={v.closedBeyond === undefined ? undefined : v.closedBeyond ? 'beyond' : 'inside'} onChange={(x) => setValue({ ...v, closedBeyond: x === 'beyond' })} options={[['beyond', 'Closed beyond it'], ['inside', 'Closed back inside']]} />}
        </div>
      );
    case 'liquidity':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <PriceField label="Previous period high" value={v.previousHigh} onChange={(previousHigh) => setValue({ ...v, levels: v.levels ?? [], previousHigh })} />
            <PriceField label="Previous period low" value={v.previousLow} onChange={(previousLow) => setValue({ ...v, levels: v.levels ?? [], previousLow })} />
          </div>
          <div className="text-xs text-ink-3">Levels from your map. Tap to mark swept or the inducement.</div>
          <LevelList levels={v.levels ?? []} inducementId={v.inducementId} onChange={(levels, inducementId) => setValue({ ...v, levels, inducementId })} />
        </div>
      );
    case 'asiaRange':
      return <div className="grid grid-cols-2 gap-2"><PriceField label="Asia high" value={v.high} onChange={(high) => setValue({ ...v, high })} /><PriceField label="Asia low" value={v.low} onChange={(low) => setValue({ ...v, low })} /></div>;
    case 'periodType':
      return <Choice value={value} onChange={setValue} options={[['EXPANSION', 'Expand toward the draw'], ['RETRACEMENT', 'Retrace to a POI first']]} />;
    case 'draw': {
      const levels = (isIdentified(read.liquidity) ? read.liquidity.value.levels : []).filter((l) => !l.swept).map((l) => ({ ...l }));
      return (
        <div className="space-y-3">
          <PickList items={levels} selectedId={levels.find((l) => l.price === v.target)?.id} empty="No unswept levels on the map; type the draw below."
            onPick={(l) => setValue({ target: l.price, kind: l.kind.startsWith('EXTERNAL') ? 'EXTERNAL' : 'INTERNAL' })}
            render={(l) => <span className="flex justify-between gap-2"><span>{l.label || levelKindLabel(l.kind)}</span><span className="tabular-nums">{fmtPrice(l.price)}</span></span>} />
          <PriceField label="Or type the draw" value={v.target} onChange={(target) => setValue({ ...v, target })} />
          <Choice size="sm" value={v.kind} onChange={(kind) => setValue({ ...v, kind })} options={[['INTERNAL', 'Internal'], ['EXTERNAL', 'External']]} />
        </div>
      );
    }
    case 'formation': {
      const target = isIdentified(read.draw) ? read.draw.value.target : undefined;
      const inv = isIdentified(read.invalidation) ? read.invalidation.value.price : undefined;
      const legType = isIdentified(base.leg) ? legTypeOf(base.leg.value, defs) : undefined;
      const levels = isIdentified(read.liquidity) ? read.liquidity.value.levels : [];
      const suggestion = depthExpectation(legType, v.primary?.side, levels, v.primary);
      const rLabel = (p: Poi) => { const r = target === undefined ? undefined : rToDraw(p, target, inv, defs); return r === undefined ? '' : ` · ${r}R`; };
      return (
        <div className="space-y-4">
          <div><div className="mb-1.5 text-sm font-semibold text-ink">POI A — where the period's {v.primary?.side === 'BUY' ? 'low' : 'high'} should form</div>
            <PickList items={htfPois} selectedId={v.primary?.id} empty="No POIs on the map yet. Add them in the structural map." onPick={(p) => setValue({ ...v, primary: p })}
              render={(p) => <span className="flex justify-between gap-2"><span>{p.label} · {p.side === 'SELL' ? 'sell' : 'buy'}</span><span className="tabular-nums">{fmtPrice(p.low)}–{fmtPrice(p.high)}{rLabel(p)}</span></span>} /></div>
          <div><div className="mb-1.5 text-sm font-semibold text-ink">POI B (backup, optional)</div>
            <PickList items={htfPois.filter((p) => p.id !== v.primary?.id)} selectedId={v.backup?.id} empty="No other POIs on the map." onPick={(p) => setValue({ ...v, backup: v.backup?.id === p.id ? undefined : p })}
              render={(p) => <span className="flex justify-between gap-2"><span>{p.label}</span><span className="tabular-nums">{fmtPrice(p.low)}–{fmtPrice(p.high)}{rLabel(p)}</span></span>} /></div>
          <div className="space-y-2"><div className="text-sm font-semibold text-ink">Shallow or deep?</div>
            {suggestion.depth && <p className="text-xs text-ink-3">{suggestion.reason}</p>}
            <Choice value={v.depth} onChange={(depth) => setValue({ ...v, depth })} options={[['SHALLOW', 'Shallow'], ['DEEP', 'Deep']]} /></div>
        </div>
      );
    }
    case 'invalidation':
      return (
        <div className="space-y-3">
          <PriceField label="Invalidation price" value={v.price} onChange={(price) => setValue({ ...v, price })} />
          <label className="block"><span className="text-sm text-ink-2">What proves it wrong</span>
            <input value={v.rule ?? ''} onChange={(e) => setValue({ ...v, rule: e.target.value })} className="mt-1 w-full rounded-xl bg-raised px-3 py-2.5 text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-accent/60" /></label>
        </div>
      );
    case 'timing':
      return <Choice value={v.window} onChange={(window) => setValue({ window })} options={sessions.map((s) => [s, s] as [string, string])} />;
    case 'entryModels': {
      const f = isIdentified(read.formation) ? read.formation.value : undefined;
      const pois = [f?.primary, f?.backup].filter(Boolean) as Poi[];
      const list: Array<{ poiId: string; modelId: string }> = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-4">{pois.map((p) => (
          <div key={p.id}><div className="mb-1.5 text-sm font-semibold text-ink">{p.label}</div>
            <Choice size="sm" value={list.find((x) => x.poiId === p.id)?.modelId} onChange={(modelId) => setValue([...list.filter((x) => x.poiId !== p.id), { poiId: p.id, modelId }])} options={models.map((m) => [m.id, m.name] as [string, string])} />
          </div>
        ))}{!pois.length && <p className="text-sm text-ink-3">Choose POI A first.</p>}</div>
      );
    }
    case 'narrative': {
      const f = isIdentified(read.formation) ? read.formation.value : undefined;
      const d = isIdentified(read.draw) ? read.draw.value : undefined;
      const inv = isIdentified(read.invalidation) ? read.invalidation.value : undefined;
      const suggested = f?.primary && d ? `${isIdentified(read.periodType) && read.periodType.value === 'RETRACEMENT' ? 'Retrace into' : 'Expand from'} ${f.primary.label} (${fmtPrice(f.primary.low)}–${fmtPrice(f.primary.high)}), then deliver to ${fmtPrice(d.target)}${inv ? `; wrong on ${inv.rule.charAt(0).toLowerCase()}${inv.rule.slice(1)}` : ''}.` : '';
      return (
        <div className="space-y-2">
          <textarea rows={3} value={typeof value === 'string' ? value : ''} onChange={(e) => setValue(e.target.value)} placeholder="One sentence."
            className="w-full resize-none rounded-xl bg-raised px-3 py-2.5 text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-accent/60" />
          {suggested && value !== suggested && <button onClick={() => setValue(suggested)} className="text-left text-sm text-accent hover:underline">Use: “{suggested}”</button>}
        </div>
      );
    }
    default:
      return null;
  }
};
