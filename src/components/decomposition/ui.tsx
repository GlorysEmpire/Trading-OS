import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, X } from 'lucide-react';
import type { LiquidityKind, LiquidityLevel, Poi, PoiKind, StepStatus } from '../../decomposition';

/** Shared building blocks for the decomposition screens: one question per screen. */

export const newLocalId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function fmtPrice(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return Math.abs(n) >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(Math.round(n * 100000) / 100000);
}

/** Full-height card with title, progress, the question, a one-line why, and Back / Next. */
export const StepFrame: React.FC<{
  title: string;
  stepLabel: string;
  progress: number; // 0–1
  question: string;
  why: string;
  more?: string;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, stepLabel, progress, question, why, more, onBack, onNext, nextLabel = 'Next', nextDisabled, onClose, children }) => {
  const heading = useRef<HTMLHeadingElement>(null);
  const previousQuestion = useRef(question);
  useEffect(() => {
    if (previousQuestion.current === question) return;
    previousQuestion.current = question;
    heading.current?.focus();
  }, [question]);
  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="tos-card tos-rise overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <div className="tos-label">{title}</div>
            <div className="text-xs text-ink-3 mt-0.5">{stepLabel}</div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-raised hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="mx-5 mt-3">
          <progress aria-label="Workflow progress" className="tos-progress w-full" max={100} value={Math.round(progress * 100)} />
        </div>
        <div className="px-5 pt-5 pb-2">
          <h1 ref={heading} tabIndex={-1} className="scroll-mt-24 text-lg font-semibold tracking-tight text-ink sm:text-xl">{question}</h1>
          <p className="mt-1.5 text-sm text-ink-2">{why}</p>
          {more && <details key={question} className="mt-2 text-sm text-ink-3">
            <summary className="cursor-pointer hover:text-ink">If the read is inconclusive</summary>
            <p className="mt-2 rounded-lg bg-raised px-3 py-2 text-sm text-ink-2">{more}</p>
          </details>}
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
          {onBack ? <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-ink-2 hover:bg-raised hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back</button> : <span />}
          {onNext && <button onClick={onNext} disabled={nextDisabled} className="tos-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40">{nextLabel} <ArrowRight className="h-4 w-4" /></button>}
        </div>
      </div>
    </div>
  );
};

/** A row of one-tap choices. */
export function Choice<T extends string>({ value, options, onChange, size = 'md' }: { value?: T; options: Array<[T, string]>; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
          className={`rounded-xl ${size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} font-medium ring-1 ring-inset transition ${value === v ? 'bg-accent/15 text-ink ring-accent/60 shadow-[0_0_0_3px_rgba(45,212,191,.12)]' : 'bg-raised text-ink-2 ring-line hover:text-ink hover:ring-line-strong'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Identified / Inconclusive / Not applicable. */
export const StatusChoice: React.FC<{ value?: StepStatus; onChange: (s: StepStatus) => void; allowNA?: boolean }> = ({ value, onChange, allowNA = true }) => (
  <Choice<StepStatus> value={value} onChange={onChange} size="sm"
    options={[['IDENTIFIED', 'Identified'], ['INCONCLUSIVE', 'Inconclusive'], ...(allowNA ? [['NOT_APPLICABLE', 'Not applicable'] as [StepStatus, string]] : [])]} />
);

/** A labelled number field. Empty = undefined. */
export const PriceField: React.FC<{ label: string; value?: number; onChange: (v: number | undefined) => void; hint?: string }> = ({ label, value, onChange, hint }) => (
  <label className="block">
    <span className="text-sm text-ink-2">{label}</span>
    <input type="number" inputMode="decimal" step="any" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      className="mt-1 w-full rounded-xl bg-raised px-3 py-2.5 text-base tabular-nums text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-accent/60" />
    {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
  </label>
);

/** A computed value, shown, never asked for. */
export const Computed: React.FC<{ label: string; value: React.ReactNode; tone?: 'ok' | 'warn' | 'bad' }> = ({ label, value, tone }) => (
  <div className="flex items-center justify-between rounded-xl bg-well px-3 py-2 text-sm ring-1 ring-inset ring-line">
    <span className="text-ink-3">{label}</span>
    <span className={`font-semibold tabular-nums ${tone === 'ok' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-rose-300' : 'text-ink'}`}>{value}</span>
  </div>
);

/** A plain-language gate (never error-styled). */
export const GateNote: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl bg-raised p-4 ring-1 ring-inset ring-line-strong">
    <div className="text-base font-semibold text-ink">{title}</div>
    {children && <div className="mt-1 text-sm text-ink-2">{children}</div>}
  </div>
);

const POI_KINDS: Array<[PoiKind, string]> = [['FVG', 'FVG'], ['ORDER_BLOCK', 'Order block'], ['BREAKER', 'Breaker'], ['SUPPLY_DEMAND', 'Supply/demand'], ['OTHER', 'Other']];

export const blankPoi = (side: Poi['side'], label: string): Poi => ({ id: newLocalId(), label, kind: 'FVG', side, high: NaN, low: NaN, mitigated: false, beyondInducement: true });
export const poiComplete = (p?: Poi) => !!p && Number.isFinite(p.high) && Number.isFinite(p.low) && p.high > p.low;

/** Edit one POI: kind, side, zone, mitigated, beyond the inducement. */
export const PoiEditor: React.FC<{ poi: Poi; onChange: (p: Poi) => void; onRemove?: () => void }> = ({ poi, onChange, onRemove }) => (
  <div className="space-y-3 rounded-2xl bg-raised p-3.5 ring-1 ring-inset ring-line">
    <div className="flex items-center justify-between gap-2">
      <input value={poi.label} onChange={(e) => onChange({ ...poi, label: e.target.value })} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink focus:outline-none" />
      {onRemove && <button onClick={onRemove} className="text-ink-3 hover:text-rose-300" aria-label="Remove POI"><Trash2 className="h-4 w-4" /></button>}
    </div>
    <Choice<Poi['side']> size="sm" value={poi.side} onChange={(side) => onChange({ ...poi, side })} options={[['SELL', 'Sell zone'], ['BUY', 'Buy zone']]} />
    <Choice<PoiKind> size="sm" value={poi.kind} onChange={(kind) => onChange({ ...poi, kind })} options={POI_KINDS} />
    <div className="grid grid-cols-2 gap-2">
      <PriceField label="Zone high" value={Number.isFinite(poi.high) ? poi.high : undefined} onChange={(v) => onChange({ ...poi, high: v ?? NaN })} />
      <PriceField label="Zone low" value={Number.isFinite(poi.low) ? poi.low : undefined} onChange={(v) => onChange({ ...poi, low: v ?? NaN })} />
    </div>
    <div className="flex flex-wrap gap-4 text-sm text-ink-2">
      <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-teal-500" checked={poi.mitigated} onChange={(e) => onChange({ ...poi, mitigated: e.target.checked })} /> Already mitigated</label>
      <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-teal-500" checked={poi.beyondInducement} onChange={(e) => onChange({ ...poi, beyondInducement: e.target.checked })} /> Beyond the inducement</label>
    </div>
  </div>
);

/** A list of POIs with add/remove. */
export const PoiList: React.FC<{ pois: Poi[]; onChange: (p: Poi[]) => void; defaultSide: Poi['side'] }> = ({ pois, onChange, defaultSide }) => (
  <div className="space-y-3">
    {pois.map((p, i) => <PoiEditor key={p.id} poi={p} onChange={(np) => onChange(pois.map((x, j) => (j === i ? np : x)))} onRemove={() => onChange(pois.filter((_, j) => j !== i))} />)}
    <button onClick={() => onChange([...pois, blankPoi(defaultSide, `POI ${pois.length + 1}`)])} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-accent hover:bg-raised"><Plus className="h-4 w-4" /> Add a POI</button>
  </div>
);

const LEVEL_KINDS: Array<[LiquidityKind, string]> = [
  ['EXTERNAL_HIGH', 'External high'], ['EXTERNAL_LOW', 'External low'], ['INTERNAL_HIGH', 'Internal high'],
  ['INTERNAL_LOW', 'Internal low'], ['EQUAL_HIGHS', 'Equal highs'], ['EQUAL_LOWS', 'Equal lows'],
];
export const levelKindLabel = (k: LiquidityKind) => LEVEL_KINDS.find(([v]) => v === k)?.[1] ?? k;

/** Liquidity levels: type, price, swept; tap one as the inducement. */
export const LevelList: React.FC<{ levels: LiquidityLevel[]; inducementId?: string; onChange: (levels: LiquidityLevel[], inducementId?: string) => void }> = ({ levels, inducementId, onChange }) => {
  const [adding, setAdding] = useState<LiquidityKind>('INTERNAL_HIGH');
  const [price, setPrice] = useState<number>();
  const [showAdd, setShowAdd] = useState(levels.length === 0);
  return (
    <div className="space-y-3">
      {levels.length > 0 && (
        <ul className="space-y-2">
          {[...levels].sort((a, b) => b.price - a.price).map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-raised px-3 py-2 ring-1 ring-inset ring-line">
              <span className="w-24 text-sm font-semibold tabular-nums text-ink">{fmtPrice(l.price)}</span>
              <span className="flex-1 text-sm text-ink-2">{l.label || levelKindLabel(l.kind)}</span>
              <button onClick={() => onChange(levels.map((x) => (x.id === l.id ? { ...x, swept: !x.swept } : x)), inducementId)}
                className={`rounded-lg px-2 py-1 text-xs ring-1 ring-inset ${l.swept ? 'bg-amber-500/12 text-amber-300 ring-amber-400/25' : 'bg-well text-ink-3 ring-line'}`}>{l.swept ? 'Swept' : 'Unswept'}</button>
              <button onClick={() => onChange(levels, inducementId === l.id ? undefined : l.id)}
                className={`rounded-lg px-2 py-1 text-xs ring-1 ring-inset ${inducementId === l.id ? 'bg-accent/15 text-ink ring-accent/60' : 'bg-well text-ink-3 ring-line hover:text-ink'}`}>{inducementId === l.id ? <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" /> Inducement</span> : 'Inducement?'}</button>
              <button onClick={() => onChange(levels.filter((x) => x.id !== l.id), inducementId === l.id ? undefined : inducementId)} className="text-ink-3 hover:text-rose-300" aria-label="Remove level"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {!showAdd ? <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-accent hover:bg-raised"><Plus className="h-4 w-4" /> Add a new level</button> : (
      <div className="rounded-2xl bg-well p-3 ring-1 ring-inset ring-line space-y-2">
        <div className="text-xs text-ink-3">Add a level</div>
        <Choice<LiquidityKind> size="sm" value={adding} onChange={setAdding} options={LEVEL_KINDS} />
        <div className="flex items-end gap-2">
          <div className="flex-1"><PriceField label="Price" value={price} onChange={setPrice} /></div>
          <button disabled={price === undefined} onClick={() => { onChange([...levels, { id: newLocalId(), kind: adding, price: price!, swept: false }], inducementId); setPrice(undefined); }}
            className="mb-0.5 inline-flex items-center gap-1 rounded-xl bg-raised px-3 py-2.5 text-sm font-medium text-ink ring-1 ring-inset ring-line hover:ring-accent/50 disabled:opacity-40"><Plus className="h-4 w-4" /> Add</button>
        </div>
      </div>)}
    </div>
  );
};

/** One-tap picker over existing items (pick, don't type). */
export function PickList<T extends { id: string }>({ items, selectedId, onPick, render, empty }: { items: T[]; selectedId?: string; onPick: (item: T) => void; render: (item: T) => React.ReactNode; empty: string }) {
  if (!items.length) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.id}>
          <button onClick={() => onPick(it)} aria-pressed={selectedId === it.id}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ring-1 ring-inset transition ${selectedId === it.id ? 'bg-accent/15 ring-accent/60 text-ink' : 'bg-raised ring-line text-ink-2 hover:ring-line-strong hover:text-ink'}`}>
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ring-1 ring-inset ${selectedId === it.id ? 'bg-accent text-[#032420] ring-accent' : 'ring-line-strong'}`}>{selectedId === it.id && <Check className="h-3 w-3" />}</span>
            <span className="min-w-0 flex-1">{render(it)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
