import React, { useMemo, useState } from 'react';
import {
  STRUCTURAL_STEPS, dailyPoiChecks, depthExpectation, equilibrium, evaluateDaily, isIdentified, latestLayer, legTypeOf, locationOf, summarize, updateStructure, validRange,
  type DailyLayer, type DecompositionDefinitions, type DraftDaily, type DraftWeekly, type LayerData, type LayerTimeframe, type LegCriteria,
  type Poi, type Step, type StepStatus, type StructuralRecord, type Trend,
} from '../../decomposition';
import { useDecompositionData } from '../../context/DecompositionDataContext';
import { useDecompositionDefinitions } from '../../context/DecompositionDefinitionsContext';
import {
  Choice, Computed, GateNote, LevelList, PoiEditor, PoiList, PriceField, StatusChoice, StepFrame, blankPoi, fmtPrice, poiComplete,
} from './ui';
import { SummaryCard } from './SummaryCard';

/** Structural flow (backtesting block): Monthly → Weekly → Daily. 4H stays hidden until it is built. */
type TF = Extract<LayerTimeframe, 'MONTHLY' | 'WEEKLY' | 'DAILY'>;
const TFS: TF[] = ['MONTHLY', 'WEEKLY', 'DAILY'];
const TF_LABEL: Record<TF, string> = { MONTHLY: 'Monthly', WEEKLY: 'Weekly', DAILY: 'Daily' };
const STEPS = STRUCTURAL_STEPS.filter((s) => (TFS as string[]).includes(s.timeframe));

type Drafts = { MONTHLY: DraftWeekly; WEEKLY: DraftWeekly; DAILY: DraftDaily };
type AnyStep = Step<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const strip = ({ timeframe: _t, ...rest }: LayerData) => rest;

function initialDrafts(rec?: StructuralRecord): Drafts {
  return {
    MONTHLY: rec && latestLayer(rec, 'MONTHLY') ? strip(latestLayer(rec, 'MONTHLY')!.data) as DraftWeekly : {},
    WEEKLY: rec && latestLayer(rec, 'WEEKLY') ? strip(latestLayer(rec, 'WEEKLY')!.data) as DraftWeekly : {},
    DAILY: rec && latestLayer(rec, 'DAILY') ? strip(latestLayer(rec, 'DAILY')!.data) as DraftDaily : {},
  };
}

/** A step is ready when it has a status, and its values are complete if Identified. */
function stepReady(tf: TF, key: string, s?: AnyStep): boolean {
  if (!s) return false;
  if (s.status !== 'IDENTIFIED') return true;
  const v = s.value;
  if (v === undefined) return false;
  const n = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
  switch (key) {
    case 'trend': return !!v.trend && n(v.lastExternalBos);
    case 'dealingRange': return n(v.high) && n(v.low) && v.high > v.low && n(v.currentPrice);
    case 'draw': return n(v.above) || n(v.below);
    case 'pois': return tf === 'DAILY' ? poiComplete(v.primary) && (!v.backup || poiComplete(v.backup)) : Array.isArray(v) && v.length > 0 && v.every(poiComplete);
    case 'structure': return !!v.trend && n(v.lastBos) && !!v.bosKind;
    case 'phase': case 'depth': return typeof v === 'string';
    case 'leg': return true;
    case 'candles': return !!v.read && !!v.closeLocation;
    case 'liquidity': return Array.isArray(v.levels) && v.levels.length > 0;
    case 'targetInvalidation': return n(v.target) && n(v.invalidation);
    default: return true;
  }
}

/** Saved form: values only on Identified steps. */
function clean<T extends Record<string, AnyStep | undefined>>(draft: T): T {
  return Object.fromEntries(Object.entries(draft).filter(([, s]) => s).map(([k, s]) => [k, s!.status === 'IDENTIFIED' ? s : { status: s!.status, ...(s!.note ? { note: s!.note } : {}) }])) as T;
}

export const StructuralFlow: React.FC<{ deskId: string; symbol: string; onClose: () => void }> = ({ deskId, symbol, onClose }) => {
  const { mapFor, saveStructure, notice } = useDecompositionData();
  const { current: defs, definitionsFor } = useDecompositionDefinitions();
  const existing = mapFor(deskId);
  const [drafts, setDrafts] = useState<Drafts>(() => initialDrafts(existing));
  const [skipMonthly, setSkipMonthly] = useState(false);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'steps' | 'gate' | 'summary'>('steps');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  const steps = useMemo(() => STEPS.filter((s) => !(skipMonthly && s.timeframe === 'MONTHLY')), [skipMonthly]);
  const def = steps[Math.min(i, steps.length - 1)];
  const tf = def.timeframe as TF;
  const step = (drafts[tf] as Record<string, AnyStep | undefined>)[def.key];
  const setStep = (s: AnyStep) => setDrafts((d) => ({ ...d, [tf]: { ...d[tf], [def.key]: s } }));
  const setStatus = (status: StepStatus) => setStep({ ...(step ?? {}), status });
  const setValue = (value: unknown) => setStep({ status: 'IDENTIFIED', ...(step ?? {}), value } as AnyStep);

  const next = () => {
    if (tf === 'DAILY' && def.key === 'dealingRange' && evaluateDaily(drafts.DAILY, defs).verdict === 'LEAVE_CHART') { setPhase('gate'); return; }
    if (i + 1 >= steps.length) setPhase('summary'); else setI(i + 1);
  };

  // ---- Preview of what would be saved ---------------------------------------
  const layersToSave = (): Array<{ asOf: string; data: LayerData }> => {
    const now = new Date().toISOString();
    const out: Array<{ asOf: string; data: LayerData }> = [];
    for (const t of TFS) {
      if (t === 'MONTHLY' && skipMonthly) continue;
      const d = drafts[t];
      if (!Object.keys(d).length) continue;
      out.push({ asOf: now, data: { timeframe: t, ...clean(d as Record<string, AnyStep>) } as LayerData });
    }
    return out;
  };
  const preview = useMemo(() => {
    if (phase !== 'summary' && phase !== 'gate') return undefined;
    const base: StructuralRecord = existing ?? { id: 'preview', deskId, symbol, mode: 'LIVE', createdAt: new Date().toISOString(), layers: [] };
    try {
      const rec = updateStructure(base, layersToSave().map((l, k) => ({ id: `preview-${k}`, ...l })), { createdAt: new Date().toISOString(), definitionsVersion: defs.version });
      return { rec, changed: true };
    } catch {
      return { rec: base, changed: false };
    }
  }, [phase, drafts, skipMonthly]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true); setMessage(undefined);
    try {
      await saveStructure({ deskId, symbol, layers: layersToSave(), definitionsVersion: defs.version });
      onClose();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const title = `${symbol} · Structural map`;

  if (phase === 'gate') {
    return (
      <StepFrame title={title} stepLabel="Daily · stopped" progress={1} question="Leave the chart." why="The daily structure is inconclusive and there is no dealing range."
        onClose={onClose} onBack={() => setPhase('steps')} onNext={() => setPhase('summary')} nextLabel="Save this read">
        <GateNote title="Nothing to plan on this chart today.">Saving keeps an honest record that the structure was unreadable. Plans and POIs need a readable daily structure or range.</GateNote>
      </StepFrame>
    );
  }

  if (phase === 'summary' && preview) {
    const s = summarize(preview.rec, definitionsFor, defs);
    return (
      <StepFrame title={title} stepLabel="Summary" progress={1} question={preview.changed ? 'Save the structural map?' : 'Nothing changed.'}
        why={preview.changed ? 'Only the timeframes you changed become new versions; older versions are kept.' : 'The existing map stays in use. No new version is saved.'}
        onClose={onClose} onBack={() => { setPhase('steps'); setI(steps.length - 1); }}
        onNext={preview.changed ? save : onClose} nextLabel={preview.changed ? (saving ? 'Saving…' : 'Save new version') : 'Done'} nextDisabled={saving || !!notice && preview.changed}>
        <SummaryCard summary={s} />
        {notice && preview.changed && <GateNote title="Can't save yet">{notice}</GateNote>}
        {message && <GateNote title="Not saved">{message}</GateNote>}
      </StepFrame>
    );
  }

  // ---- One question ---------------------------------------------------------
  const tfIndex = steps.filter((s) => s.timeframe === tf).findIndex((s) => s.key === def.key);
  const tfCount = steps.filter((s) => s.timeframe === tf).length;
  return (
    <StepFrame title={title} stepLabel={`${TF_LABEL[tf]} · ${tfIndex + 1} of ${tfCount}`} progress={(i + 1) / (steps.length + 1)}
      question={def.question} why={def.help} more={`If not identified: ${def.ifNotIdentified}`}
      onClose={onClose} onBack={i > 0 ? () => setI(i - 1) : undefined} onNext={next} nextDisabled={!stepReady(tf, def.key, step)}>
      {i === 0 && tf === 'MONTHLY' && (
        <button onClick={() => { setSkipMonthly(true); setI(0); }} className="text-sm text-ink-3 underline-offset-2 hover:text-ink hover:underline">Skip Monthly for now</button>
      )}
      <StatusChoice value={step?.status} onChange={setStatus} />
      {step?.status === 'IDENTIFIED' && (
        <Editor tf={tf} stepKey={def.key} value={step.value} setValue={setValue} drafts={drafts} defs={defs} />
      )}
    </StepFrame>
  );
};

// ---- Per-step editors ----------------------------------------------------------

const Editor: React.FC<{ tf: TF; stepKey: string; value: any; setValue: (v: any) => void; drafts: Drafts; defs: DecompositionDefinitions }> = ({ tf, stepKey, value, setValue, drafts, defs }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const v = value ?? {};
  switch (stepKey) {
    case 'trend':
    case 'structure': {
      const bosKey = stepKey === 'trend' ? 'lastExternalBos' : 'lastBos';
      return (
        <div className="space-y-3">
          <Choice<Trend> value={v.trend} onChange={(trend) => setValue({ ...v, trend })} options={[['BULLISH', 'Bullish'], ['BEARISH', 'Bearish']]} />
          <PriceField label={stepKey === 'trend' ? 'Price of the last external BOS' : 'Price of the last BOS'} value={v[bosKey]} onChange={(p) => setValue({ ...v, [bosKey]: p })} />
          {stepKey === 'structure' && <Choice size="sm" value={v.bosKind} onChange={(bosKind) => setValue({ ...v, bosKind })} options={[['EXTERNAL', 'External BOS'], ['INTERNAL', 'Internal BOS']]} />}
        </div>
      );
    }
    case 'dealingRange': {
      const cp: number | undefined = v.currentPrice;
      const ok = validRange(v) && Number.isFinite(cp);
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <PriceField label="Range high" value={v.high} onChange={(high) => setValue({ ...v, high })} />
            <PriceField label="Range low" value={v.low} onChange={(low) => setValue({ ...v, low })} />
          </div>
          <PriceField label="Current price" value={v.currentPrice} onChange={(currentPrice) => setValue({ ...v, currentPrice })} />
          {ok && <>
            <Computed label="Equilibrium (50%)" value={fmtPrice(equilibrium(v))} />
            <Computed label="Price is in" value={locationOf(cp!, v, defs.equilibriumBandPct).toLowerCase()} />
          </>}
          {!validRange(v) && Number.isFinite(v.high) && Number.isFinite(v.low) && <p className="text-sm text-amber-300">The range high must be above the low.</p>}
        </div>
      );
    }
    case 'draw':
      return (
        <div className="grid grid-cols-2 gap-2">
          <PriceField label="Draw above" value={v.above} onChange={(above) => setValue({ ...v, above })} />
          <PriceField label="Draw below" value={v.below} onChange={(below) => setValue({ ...v, below })} />
        </div>
      );
    case 'pois':
      if (tf !== 'DAILY') return <PoiList pois={Array.isArray(value) ? value : []} onChange={setValue} defaultSide={trendSide(drafts.WEEKLY.trend)} />;
      return <DailyPois value={v} setValue={setValue} drafts={drafts} defs={defs} />;
    case 'phase':
      return <Choice value={value} onChange={setValue} options={[['EXPANSION', 'Expanding'], ['RETRACEMENT', 'Retracing'], ['RANGE', 'Ranging']]} />;
    case 'leg': {
      const c: LegCriteria = { rangeVsAtr: false, closesInOuterPart: false, lowBodyOverlap: false, unmitigatedFvg: false, ...v };
      const rows: Array<[keyof LegCriteria, string]> = [
        ['rangeVsAtr', `Leg range at least ${defs.strongLeg.atrMultiple}× ATR(20)`],
        ['closesInOuterPart', `Most candles close in the outer ${defs.strongLeg.outerClosePct}% of their range`],
        ['lowBodyOverlap', `Body overlap below ${defs.strongLeg.maxBodyOverlapPct}%`],
        ['unmitigatedFvg', 'At least one unmitigated FVG'],
      ];
      const type = legTypeOf(c, defs);
      return (
        <div className="space-y-2">
          {rows.map(([k, label]) => (
            <label key={k} className="flex items-center gap-3 rounded-xl bg-raised px-3 py-2.5 text-sm text-ink-2 ring-1 ring-inset ring-line">
              <input type="checkbox" className="h-4 w-4 accent-teal-500" checked={c[k]} onChange={(e) => setValue({ ...c, [k]: e.target.checked })} /> {label}
            </label>
          ))}
          <Computed label="Leg type" value={type.toLowerCase()} tone={type === 'STRONG' ? 'ok' : type === 'WEAK' ? 'warn' : undefined} />
        </div>
      );
    }
    case 'candles':
      return (
        <div className="space-y-3">
          <Choice value={v.read} onChange={(read) => setValue({ ...v, read })} options={[['EXPANSION', 'Expansion'], ['REJECTION', 'Rejection'], ['INDECISION', 'Indecision']]} />
          <div><div className="mb-1.5 text-xs text-ink-3">Closed in its range</div><Choice size="sm" value={v.closeLocation} onChange={(closeLocation) => setValue({ ...v, closeLocation })} options={[['HIGH', 'High'], ['MID', 'Middle'], ['LOW', 'Low']]} /></div>
          <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" className="h-4 w-4 accent-teal-500" checked={!!v.liquidityEvent} onChange={(e) => setValue({ ...v, liquidityEvent: e.target.checked })} /> Took liquidity (a sweep)</label>
        </div>
      );
    case 'liquidity':
      return <LevelList levels={v.levels ?? []} inducementId={v.inducementId} onChange={(levels, inducementId) => setValue({ levels, inducementId })} />;
    case 'depth': {
      const legType = isIdentified(drafts.DAILY.leg) ? legTypeOf(drafts.DAILY.leg.value, defs) : undefined;
      const s = depthExpectation(legType, undefined, [], undefined);
      return (
        <div className="space-y-3">
          {s.depth && <Computed label="Suggested from the leg" value={s.depth.toLowerCase()} />}
          <Choice value={value} onChange={setValue} options={[['SHALLOW', 'Shallow'], ['DEEP', 'Deep']]} />
        </div>
      );
    }
    case 'targetInvalidation':
      return <TargetStep value={v} setValue={setValue} drafts={drafts} defs={defs} />;
    default:
      return null;
  }
};

const trendSide = (s?: Step<{ trend: Trend }>): Poi['side'] => (isIdentified(s) && s.value.trend === 'BULLISH' ? 'BUY' : 'SELL');

/** POI A / B: pick from the weekly map with one tap, or add a new zone. */
const DailyPois: React.FC<{ value: { primary?: Poi; backup?: Poi }; setValue: (v: unknown) => void; drafts: Drafts; defs: DecompositionDefinitions }> = ({ value, setValue, drafts, defs }) => {
  const side = trendSide(drafts.DAILY.structure as Step<{ trend: Trend }> | undefined);
  const htf = [...(isIdentified(drafts.WEEKLY.pois) ? drafts.WEEKLY.pois.value : []), ...(isIdentified(drafts.MONTHLY.pois) ? drafts.MONTHLY.pois.value : [])].filter(poiComplete);
  const range = isIdentified(drafts.DAILY.dealingRange) && validRange(drafts.DAILY.dealingRange.value) ? drafts.DAILY.dealingRange.value : undefined;
  const slot = (key: 'primary' | 'backup', label: string) => {
    const p = value[key];
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between"><span className="text-sm font-semibold text-ink">{label}</span>
          {p && key === 'backup' && <button onClick={() => setValue({ ...value, backup: undefined })} className="text-xs text-ink-3 hover:text-ink">Remove</button>}</div>
        {p ? <>
          <PoiEditor poi={p} onChange={(np) => setValue({ ...value, [key]: np })} />
          {range && poiComplete(p) && <Computed label="Sits in" value={locationOf((p.high + p.low) / 2, range, defs.equilibriumBandPct).toLowerCase()} />}
        </> : (
          <div className="flex flex-wrap gap-2">
            {htf.map((h) => <button key={h.id} onClick={() => setValue({ ...value, [key]: { ...h, label } })} className="rounded-xl bg-raised px-3 py-2 text-sm text-ink-2 ring-1 ring-inset ring-line hover:text-ink hover:ring-accent/50">{h.label} {fmtPrice(h.low)}–{fmtPrice(h.high)}</button>)}
            <button onClick={() => setValue({ ...value, [key]: blankPoi(side, label) })} className="rounded-xl px-3 py-2 text-sm font-medium text-accent hover:bg-raised">+ New zone</button>
          </div>
        )}
      </div>
    );
  };
  return <div className="space-y-5">{slot('primary', 'POI A')}{slot('backup', 'POI B (backup)')}</div>;
};

/** Target: pick an external level with one tap; invalidation typed once. R is computed. */
const TargetStep: React.FC<{ value: { target?: number; invalidation?: number }; setValue: (v: unknown) => void; drafts: Drafts; defs: DecompositionDefinitions }> = ({ value, setValue, drafts, defs }) => {
  const levels = isIdentified(drafts.DAILY.liquidity) ? drafts.DAILY.liquidity.value.levels.filter((l) => l.kind.startsWith('EXTERNAL') && !l.swept) : [];
  const preview = { ...drafts.DAILY, targetInvalidation: Number.isFinite(value.target) && Number.isFinite(value.invalidation) ? { status: 'IDENTIFIED' as const, value: value as { target: number; invalidation: number } } : undefined };
  const gate = Number.isFinite(value.target) && Number.isFinite(value.invalidation) ? evaluateDaily(preview as DraftDaily, defs) : undefined;
  return (
    <div className="space-y-3">
      {levels.length > 0 && <div className="flex flex-wrap gap-2">{levels.map((l) => (
        <button key={l.id} onClick={() => setValue({ ...value, target: l.price })} aria-pressed={value.target === l.price}
          className={`rounded-xl px-3 py-2 text-sm ring-1 ring-inset ${value.target === l.price ? 'bg-accent/15 text-ink ring-accent/60' : 'bg-raised text-ink-2 ring-line hover:text-ink'}`}>{l.label || 'External'} {fmtPrice(l.price)}</button>
      ))}</div>}
      <PriceField label="Target (next external liquidity)" value={value.target} onChange={(target) => setValue({ ...value, target })} />
      <PriceField label="Invalidation (close beyond the swing that made the BOS)" value={value.invalidation} onChange={(invalidation) => setValue({ ...value, invalidation })} />
      {gate && <>
        {dailyPoiChecks(preview as DraftDaily, defs).map((c) => <Computed key={c.role} label={`R to the draw from ${c.role === 'PRIMARY' ? 'POI A' : 'POI B'}`} value={c.rToDraw === undefined ? '—' : `${c.rToDraw}R`} tone={c.valid ? 'ok' : 'warn'} />)}
        <p className="text-sm text-ink-2">{gate.reason}</p>
      </>}
    </div>
  );
};

export type { DailyLayer };
