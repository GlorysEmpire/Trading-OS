import { getTimeView, viewZone, zoneLabel } from '../utils/timeDisplay';
import React, { useMemo, useState } from 'react';
import { GitMerge, Plus, Trash2, X } from 'lucide-react';
import type { ActivePOI, AssetDeskData, ExternalLevel, LiquidityZone } from '../types';
import { buildLadder, type MapLadderLevel, DEFAULT_BAND_PCT, kindLabel, kindOptions, parsePriceRange, type LadderRow } from '../utils/levelsLadder';
import { contextId, fieldAge, formatAsOfNY, isoToNyInput, nyInputToIso } from '../utils/marketContext';

/** The zone trading times are shown and typed in right now. */
const zoneName = () => (getTimeView() === 'NY' ? 'New York time' : `${zoneLabel(viewZone())} time`);

const input = 'w-full rounded-lg border border-line bg-well px-3 py-2 text-sm text-ink outline-none focus:border-sky-500';
const smallBtn = 'inline-flex items-center gap-1 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs text-ink-2 hover:text-ink';
const GRID = 'grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] md:grid-cols-[130px_minmax(0,1fr)_150px_90px_170px] gap-x-3 gap-y-1 items-center';

type Whose = 'liquidity' | 'poi' | 'external';
type Draft = {
  whose: Whose;
  id: string | null;
  name: string;
  kind: string;
  price: string;
  timeframe: string;
  status: LiquidityZone['status'];
  active: boolean;
  source: string;
  asOf: string;
  stale: string;
  note: string;
};

const blankDraft = (whose: Whose): Draft => ({
  whose, id: null, name: '', kind: '', price: '', timeframe: '', status: 'UNTOUCHED', active: true,
  source: 'Manual', asOf: isoToNyInput(new Date().toISOString()), stale: '', note: '',
});

interface Props {
  desk: AssetDeskData;
  allDesks: AssetDeskData[];
  onUpdate: (patch: Partial<AssetDeskData>) => void;
  /** Levels from the structural map (read-only here; edited through Decompose). */
  mapLevels?: MapLadderLevel[];
  /** Desk-typed liquidity and POIs are legacy notes: shown, not edited. Outside levels stay editable. */
  legacyReadOnly?: boolean;
}

/** MC-2: your levels and outside levels in one price-sorted list. */
export const LevelsLadder: React.FC<Props> = ({ desk, allDesks, onUpdate, mapLevels, legacyReadOnly }) => {
  const now = new Date();
  const ladder = useMemo(() => buildLadder(desk, now, { mapLevels, legacy: legacyReadOnly }), [desk, mapLevels, legacyReadOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState<Draft | null>(null);
  const [show, setShow] = useState<'all' | 'mine' | 'external' | 'confluence'>('all');
  const [band, setBand] = useState(String(desk.confluenceBandPct ?? DEFAULT_BAND_PCT));
  const [price, setPrice] = useState(desk.referencePrice?.value ?? '');
  React.useEffect(() => {
    setBand(String(desk.confluenceBandPct ?? DEFAULT_BAND_PCT));
    setPrice(desk.referencePrice?.value ?? '');
    setDraft(null);
  }, [desk.id]);

  const commitBand = () => {
    const n = Number(band);
    if (n > 0 && n !== (desk.confluenceBandPct ?? DEFAULT_BAND_PCT)) onUpdate({ confluenceBandPct: n });
    else setBand(String(desk.confluenceBandPct ?? DEFAULT_BAND_PCT));
  };
  const commitPrice = () => {
    const v = price.trim();
    if (v === (desk.referencePrice?.value ?? '')) return;
    onUpdate({ referencePrice: { value: v, asOf: v ? new Date().toISOString() : '' } });
  };

  const openEdit = (row: LadderRow) => {
    if (row.origin === 'liquidity') {
      const z = desk.liquidityZones.find((x) => x.id === row.id);
      if (z) setDraft({ ...blankDraft('liquidity'), id: z.id, name: z.notes, kind: kindLabel(z.type), price: z.level, status: z.status });
    } else if (row.origin === 'poi') {
      const p = desk.activePOIs.find((x) => x.id === row.id);
      if (p) setDraft({ ...blankDraft('poi'), id: p.id, name: p.name, kind: p.type, price: p.priceRange, timeframe: p.timeframe, active: p.active });
    } else if (row.origin === 'external') {
      const l = (desk.externalLevels ?? []).find((x) => x.id === row.id);
      if (l) setDraft({ ...blankDraft('external'), id: l.id, name: l.label, kind: l.kind, price: l.price, source: l.source, asOf: isoToNyInput(l.asOf), stale: l.staleAfterHours ? String(l.staleAfterHours) : '', note: l.note ?? '' });
    }
  };

  const saveDraft = (d: Draft) => {
    if (d.whose === 'liquidity') {
      const zone: LiquidityZone = { id: d.id ?? contextId('l'), level: d.price.trim(), type: d.kind.trim() || 'Liquidity', status: d.status, notes: d.name.trim() };
      onUpdate({ liquidityZones: d.id ? desk.liquidityZones.map((z) => (z.id === d.id ? zone : z)) : [...desk.liquidityZones, zone] });
    } else if (d.whose === 'poi') {
      const poi: ActivePOI = { id: d.id ?? contextId('p'), name: d.name.trim() || 'POI', priceRange: d.price.trim(), timeframe: d.timeframe.trim(), type: d.kind.trim(), active: d.active };
      onUpdate({ activePOIs: d.id ? desk.activePOIs.map((p) => (p.id === d.id ? poi : p)) : [...desk.activePOIs, poi] });
    } else {
      const hours = Number(d.stale);
      const prev = (desk.externalLevels ?? []).find((x) => x.id === d.id);
      const level: ExternalLevel = {
        id: d.id ?? contextId('x'), label: d.name.trim() || d.kind.trim() || 'Level', kind: d.kind.trim() || 'External', price: d.price.trim(),
        source: d.source.trim(), asOf: nyInputToIso(d.asOf), staleAfterHours: d.stale && hours > 0 ? hours : undefined,
        enteredBy: 'MANUAL', confirmedAt: prev && prev.enteredBy !== 'MANUAL' ? new Date().toISOString() : prev?.confirmedAt, note: d.note.trim() || undefined,
      };
      const list = desk.externalLevels ?? [];
      onUpdate({ externalLevels: d.id ? list.map((x) => (x.id === d.id ? level : x)) : [...list, level] });
    }
    setDraft(null);
  };

  const removeDraft = (d: Draft) => {
    if (!d.id || !window.confirm(`Remove "${d.name || d.kind || d.price}" from this desk?`)) return;
    if (d.whose === 'liquidity') onUpdate({ liquidityZones: desk.liquidityZones.filter((z) => z.id !== d.id) });
    else if (d.whose === 'poi') onUpdate({ activePOIs: desk.activePOIs.filter((p) => p.id !== d.id) });
    else onUpdate({ externalLevels: (desk.externalLevels ?? []).filter((x) => x.id !== d.id) });
    setDraft(null);
  };

  const confirmDraftLevel = (row: LadderRow) =>
    onUpdate({ externalLevels: (desk.externalLevels ?? []).map((x) => (x.id === row.id ? { ...x, enteredBy: 'MANUAL', confirmedAt: new Date().toISOString() } : x)) });

  const cycleStatus = (row: LadderRow) =>
    onUpdate({
      liquidityZones: desk.liquidityZones.map((z) =>
        z.id !== row.id ? z : { ...z, status: z.status === 'UNTOUCHED' ? 'SWEPT' : z.status === 'SWEPT' ? 'ENGINEERED' : 'UNTOUCHED' }),
    });

  const visible = (r: LadderRow) => show === 'all' || (show === 'mine' && r.mine) || (show === 'external' && !r.mine) || (show === 'confluence' && r.confluence.length > 0);
  const rows = ladder.rows.filter(visible);
  const refAsOf = desk.referencePrice?.asOf;
  const empty = ladder.rows.length === 0 && ladder.unpriced.length === 0;

  const renderRow = (r: LadderRow) => {
    const editable = r.origin === 'external' || (!legacyReadOnly && (r.origin === 'liquidity' || r.origin === 'poi'));
    return (
      <div
        key={r.key}
        className={`${GRID} border-b border-line px-4 py-2.5 ${r.confluence.length ? 'bg-amber-500/5' : ''} ${r.stale ? 'opacity-60' : ''} ${r.aiDraft ? 'border-dashed' : ''}`}
      >
        <span className="text-sm font-semibold text-ink">{r.priceText}</span>
        <div className="min-w-0">
          {editable ? (
            <button type="button" onClick={() => openEdit(r)} className="block max-w-full truncate text-left text-[13.5px] text-ink hover:text-sky-400" title="Edit level">{r.name}</button>
          ) : (
            <span className="block truncate text-[13.5px] text-ink" title={r.origin === 'map' ? 'From your structural map: change it in Decompose' : r.origin === 'quick' ? 'Edit under Analysis' : 'Legacy note: read-only'}>{r.name}</span>
          )}
          {r.confluence.length > 0 && (
            <span className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-600 bg-amber-950/40 px-2 py-0.5 text-[11.5px] font-semibold text-amber-300">
              <GitMerge className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">Confluence: {r.confluence.slice(0, 2).join(', ')}{r.confluence.length > 2 ? ` +${r.confluence.length - 2}` : ''}</span>
            </span>
          )}
        </div>
        <span className="text-xs text-ink-2 md:col-auto col-start-2">{r.kind}</span>
        <span className="col-start-2 md:col-auto">
          {r.origin === 'liquidity' && r.status && !legacyReadOnly ? (
            <button type="button" onClick={() => cycleStatus(r)} title="Untouched → Swept → Engineered" className="rounded-full border border-sky-500 bg-raised px-2 py-0.5 text-[11.5px] font-semibold text-sky-300">
              {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
            </button>
          ) : (
            <span className={`rounded-full border bg-raised px-2 py-0.5 text-[11.5px] font-semibold ${r.mine ? 'border-sky-500 text-sky-300' : 'border-line-strong text-ink-2'}`}>{r.mine ? 'Mine' : 'External'}</span>
          )}
        </span>
        <span className="col-start-2 md:col-auto text-xs text-ink-3">
          {r.source}
          {r.asOf ? ` · ${formatAsOfNY(r.asOf)}` : r.mine ? '' : ' · no time'}
          {r.stale && <span className="font-semibold text-orange-400"> · stale</span>}
          {r.aiDraft && (
            <>
              {' · AI draft '}
              <button type="button" onClick={() => confirmDraftLevel(r)} className="font-semibold text-sky-400 hover:text-sky-300">Confirm</button>
            </>
          )}
        </span>
      </div>
    );
  };

  const priceRow = (
    <div key="price-now" className="flex flex-wrap items-center gap-3 border-y border-sky-600 bg-sky-500/10 px-4 py-2">
      <span className="text-sm font-bold text-sky-300">{desk.referencePrice?.value}</span>
      <span className="text-xs font-semibold text-sky-300">Price now · entered {refAsOf ? `${formatAsOfNY(refAsOf)} (${fieldAge({ asOf: refAsOf } as never, now) || 'now'})` : ''}</span>
    </div>
  );

  // Where the price row lands among the *visible* rows.
  const priceAt = ladder.reference ? rows.findIndex((r) => (r.range!.high + r.range!.low) / 2 < ladder.reference!.high) : -2;

  return (
    <section aria-labelledby="ladder-title" className="rounded-xl border border-line bg-panel overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h3 id="ladder-title" className="text-[15px] font-semibold text-ink">Levels ladder · {desk.symbol}</h3>
          <p className="mt-0.5 text-xs text-ink-3">Your levels and outside levels in one price-sorted list. A confluence flag is a note to look closer, not a signal.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="ladder-price" className="block text-[11.5px] text-ink-3">Price now</label>
            <input id="ladder-price" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={commitPrice} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} placeholder="e.g. 64,410" className={`${input} !w-28`} />
          </div>
          <div>
            <label htmlFor="ladder-band" className="block text-[11.5px] text-ink-3">Confluence band %</label>
            <input id="ladder-band" type="number" min={0.05} step={0.05} value={band} onChange={(e) => setBand(e.target.value)} onBlur={commitBand} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className={`${input} !w-24`} />
          </div>
          <div>
            <label htmlFor="ladder-show" className="block text-[11.5px] text-ink-3">Show</label>
            <select id="ladder-show" value={show} onChange={(e) => setShow(e.target.value as typeof show)} className={`${input} !w-36`}>
              <option value="all">All levels</option>
              <option value="mine">Mine only</option>
              <option value="external">External only</option>
              <option value="confluence">Confluence only</option>
            </select>
          </div>
          <button type="button" onClick={() => setDraft(blankDraft(legacyReadOnly ? 'external' : 'liquidity'))} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-500">
            <Plus className="h-4 w-4" /> {legacyReadOnly ? 'Add outside level' : 'Add level'}
          </button>
        </div>
      </div>

      <div className={`${GRID} hidden md:grid border-b border-line bg-well px-4 py-2 text-[11.5px] text-ink-3`}>
        <span>Price</span><span>Level</span><span>Kind</span><span>Whose</span><span>Source · as of</span>
      </div>

      {empty && <p className="px-4 py-6 text-sm text-ink-3">{legacyReadOnly ? 'No levels yet. Your liquidity and POIs come from your structural map (Decompose). Add outside levels here, such as cost bases or option strikes.' : 'No levels yet. Add your liquidity and POIs, then outside levels such as cost bases or option strikes.'}</p>}
      {rows.map((r, i) => (
        <React.Fragment key={r.key}>
          {priceAt === i && priceRow}
          {renderRow(r)}
        </React.Fragment>
      ))}
      {ladder.reference && priceAt === -1 && priceRow}

      {ladder.unpriced.length > 0 && (
        <div className="border-t border-line">
          <p className="bg-well px-4 py-2 text-[11.5px] text-ink-3">No readable price — not placed on the ladder. Edit the level to give it a price like 81,800 or 68–72.5k.</p>
          {ladder.unpriced.map(renderRow)}
        </div>
      )}

      {draft && <LevelForm draft={draft} allDesks={allDesks} externalOnly={legacyReadOnly} onCancel={() => setDraft(null)} onSave={saveDraft} onRemove={removeDraft} />}
    </section>
  );
};

const LevelForm: React.FC<{
  draft: Draft;
  allDesks: AssetDeskData[];
  onCancel: () => void;
  onSave: (d: Draft) => void;
  onRemove: (d: Draft) => void;
  externalOnly?: boolean;
}> = ({ draft, allDesks, onCancel, onSave, onRemove, externalOnly }) => {
  const [d, setD] = useState(draft);
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const kinds = d.whose === 'liquidity' ? kindOptions(allDesks, 'liquidity') : d.whose === 'external' ? kindOptions(allDesks, 'external') : ['Order block', 'FVG', 'Breaker block'];
  const readable = !d.price.trim() || parsePriceRange(d.price) !== null;
  const isNew = !d.id;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onCancel}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (d.price.trim()) onSave(d); }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl space-y-4 rounded-xl border border-line-strong bg-panel p-5 shadow-2xl"
        aria-labelledby="lvl-title"
      >
        <div className="flex items-center justify-between">
          <h4 id="lvl-title" className="text-base font-semibold text-ink">{isNew ? 'Add level' : 'Edit level'}</h4>
          <button type="button" aria-label="Close" onClick={onCancel} className="rounded-lg p-1.5 text-ink-3 hover:bg-raised hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        {isNew && !externalOnly && (
          <div role="radiogroup" aria-label="Whose level" className="flex flex-wrap gap-2">
            {([['liquidity', 'My liquidity'], ['poi', 'My POI'], ['external', 'External level']] as [Whose, string][]).map(([w, label]) => (
              <button key={w} type="button" role="radio" aria-checked={d.whose === w} onClick={() => set({ whose: w, kind: '' })}
                className={`rounded-lg border px-3 py-2 text-sm ${d.whose === w ? 'border-sky-500 bg-sky-500/10 font-semibold text-ink' : 'border-line bg-raised text-ink-2'}`}>{label}</button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="lvl-price" label="Price or range">
            <input id="lvl-price" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder="81,800 or 68–72.5k" className={input} required />
            {!readable && <p className="mt-1 text-xs text-orange-400">Can't read this as a price, so it won't be placed on the ladder.</p>}
          </Field>
          <Field id="lvl-kind" label={d.whose === 'poi' ? 'POI type' : 'Kind (your own name)'}>
            <input id="lvl-kind" list="lvl-kinds" value={d.kind} onChange={(e) => set({ kind: e.target.value })} placeholder={d.whose === 'liquidity' ? 'e.g. Bull liquidity' : d.whose === 'external' ? 'e.g. Cost basis' : 'e.g. Order block'} className={input} />
            <datalist id="lvl-kinds">{kinds.map((k) => <option key={k} value={k} />)}</datalist>
          </Field>
          <Field id="lvl-name" label={d.whose === 'liquidity' ? 'Note' : 'Name'}>
            <input id="lvl-name" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder={d.whose === 'liquidity' ? "e.g. Last week's low" : d.whose === 'poi' ? 'e.g. Daily bearish OB + FVG' : 'e.g. Short-term holder cost basis'} className={input} />
          </Field>
          {d.whose === 'liquidity' && (
            <Field id="lvl-status" label="Status">
              <select id="lvl-status" value={d.status} onChange={(e) => set({ status: e.target.value as LiquidityZone['status'] })} className={input}>
                <option value="UNTOUCHED">Untouched</option><option value="SWEPT">Swept</option><option value="ENGINEERED">Engineered</option>
              </select>
            </Field>
          )}
          {d.whose === 'poi' && (
            <>
              <Field id="lvl-tf" label="Timeframe">
                <input id="lvl-tf" value={d.timeframe} onChange={(e) => set({ timeframe: e.target.value })} placeholder="e.g. Daily" className={input} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} /> Still active
              </label>
            </>
          )}
          {d.whose === 'external' && (
            <>
              <Field id="lvl-source" label="Source">
                <input id="lvl-source" value={d.source} onChange={(e) => set({ source: e.target.value })} className={input} />
              </Field>
              <Field id="lvl-asof" label={`As of (${zoneName()})`}>
                <input id="lvl-asof" type="datetime-local" value={d.asOf} onChange={(e) => set({ asOf: e.target.value })} className={input} />
              </Field>
              <Field id="lvl-stale" label="Grey out after (hours, blank = never)">
                <input id="lvl-stale" type="number" min={1} value={d.stale} onChange={(e) => set({ stale: e.target.value })} className={input} />
              </Field>
              <div className="sm:col-span-2">
                <Field id="lvl-note" label="Note (optional)">
                  <input id="lvl-note" value={d.note} onChange={(e) => set({ note: e.target.value })} className={input} />
                </Field>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {!isNew ? (
            <button type="button" onClick={() => onRemove(d)} className={`${smallBtn} hover:text-rose-400`}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-line bg-raised px-4 py-2 text-sm text-ink-2 hover:text-ink">Cancel</button>
            <button type="submit" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">Save</button>
          </div>
        </div>
      </form>
    </div>
  );
};

const Field: React.FC<{ id: string; label: string; children: React.ReactNode }> = ({ id, label, children }) => (
  <div className="space-y-1">
    <label htmlFor={id} className="block text-xs text-ink-2">{label}</label>
    {children}
  </div>
);
