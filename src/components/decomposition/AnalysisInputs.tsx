import type { ReactNode } from 'react';
import { confirmedBreak, legEvidence, rangeEvidence, swingTrend, type Analysis, type AnalysisLayerId } from '../../decomposition/analysis';
import { blankPoi, Choice, Computed, fmtPrice, LevelList, newLocalId, PoiEditor, PriceField } from './ui';

export function AnalysisText({ label, value, change, area = false }: { label: string; value?: string; change: (value: string) => void; area?: boolean }) {
  const props = { value: value ?? '', onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(event.target.value), className: 'tos-input mt-1' };
  return <label className="block text-sm text-ink-2">{label}{area ? <textarea {...props} rows={2} /> : <input {...props} />}</label>;
}
const Grid = ({ children }: { children: ReactNode }) => <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
const toggle = [['yes', 'Yes'], ['no', 'No']] as Array<['yes' | 'no', string]>;

export function AnalysisInputs({ id, value, edit, cutoff }: {
  id: AnalysisLayerId; value: Analysis; edit: <K extends AnalysisLayerId>(key: K, patch: Partial<NonNullable<Analysis[K]>>) => void; cutoff: string;
}) {
  switch (id) {
    case 'S1': {
      const swings = value.S1?.swings ?? [];
      const trend = swingTrend(swings);
      return <div className="space-y-3">
        {swings.map((s, index) => {
          const change = (patch: Partial<typeof s>) => edit('S1', { swings: swings.map((item) => item.id === s.id ? { ...s, ...patch } : item) });
          return <fieldset key={s.id} className="rounded-lg border border-line p-3">
            <legend className="px-1 text-sm text-ink-2">Swing {index + 1}</legend>
            <div className="mb-2"><Choice value={s.kind} onChange={(kind) => change({ kind })} options={[['HIGH', 'Swing high'], ['LOW', 'Swing low']]} /></div>
            <Grid><PriceField label="Swing price" value={s.price} onChange={(price) => change({ price })} />
              <label className="text-sm text-ink-2">Chart date<input className="tos-input mt-1" type="date" max={cutoff.slice(0, 10)} value={s.date ?? ''} onChange={(e) => change({ date: e.target.value })} /></label></Grid>
            <button className="tos-secondary mt-2" onClick={() => edit('S1', { swings: swings.filter((item) => item.id !== s.id) })}>Remove swing {index + 1}</button>
          </fieldset>;
        })}
        <button className="tos-secondary" onClick={() => edit('S1', { swings: [...swings, { id: newLocalId(), kind: 'HIGH' }] })}>Add swing point</button>
        <Computed label="Swing sequence" value={trend ? trend.toLowerCase() : 'Needs two dated highs and two dated lows'} />
      </div>;
    }
    case 'S2': {
      const s = value.S2 ?? {};
      const br = confirmedBreak(s);
      return <div className="space-y-3">
        <Grid><PriceField label="Reference swing price" value={s.level} onChange={(level) => edit('S2', { level })} /><PriceField label="Completed candle close" value={s.close} onChange={(close) => edit('S2', { close })} /></Grid>
        <Choice value={s.event} onChange={(event) => edit('S2', { event })} options={[['BOS', 'Break of structure'], ['CHOCH', 'Change of character'], ['SWEEP', 'Sweep'], ['NONE', 'No event']]} />
        <Choice value={s.direction} onChange={(direction) => edit('S2', { direction })} options={[['BULLISH', 'Upward'], ['BEARISH', 'Downward']]} />
        <Choice value={s.scope} onChange={(scope) => edit('S2', { scope })} options={[['EXTERNAL', 'External swing'], ['INTERNAL', 'Internal swing']]} />
        {s.event && <Computed label="Close evidence" value={br ? 'Close beyond the swing' : 'No confirmed structural break from these inputs'} />}
      </div>;
    }
    case 'S3': {
      const s = value.S3 ?? {};
      const metrics = rangeEvidence(s);
      return <div className="space-y-3"><Grid>
        <PriceField label="Range high" value={s.high} onChange={(high) => edit('S3', { high })} />
        <PriceField label="Range low" value={s.low} onChange={(low) => edit('S3', { low })} />
        <PriceField label="Price at observation" value={s.price} onChange={(price) => edit('S3', { price })} />
      </Grid>{metrics && <Grid><Computed label="Equilibrium" value={fmtPrice(metrics.midpoint)} /><Computed label="Price location" value={metrics.location ?? 'Enter price'} /></Grid>}</div>;
    }
    case 'S4': {
      const s = value.S4 ?? {};
      const metrics = legEvidence(s);
      return <div className="space-y-3"><Grid>
        <PriceField label="Impulse start" value={s.start} onChange={(start) => edit('S4', { start })} />
        <PriceField label="Impulse end" value={s.end} onChange={(end) => edit('S4', { end })} />
        <PriceField label="Correction endpoint" value={s.correction} onChange={(correction) => edit('S4', { correction })} />
        <PriceField label="ATR at observation" value={s.atr} onChange={(atr) => edit('S4', { atr })} />
      </Grid>
        {metrics && <Grid><Computed label="Retracement" value={metrics.correction === undefined ? '—' : `${metrics.correction.toFixed(1)}%`} /><Computed label="Leg relative to ATR" value={metrics.atrMultiple === undefined ? '—' : `${metrics.atrMultiple.toFixed(2)}×`} /></Grid>}
        <Choice value={s.phase} onChange={(phase) => edit('S4', { phase })} options={[['EXPANSION', 'Expansion'], ['RETRACEMENT', 'Retracement'], ['RANGE', 'Range']]} />
        {([['outerCloses', 'Did closes meet your outer-range criterion?'], ['lowOverlap', 'Did overlap stay under your threshold?'], ['fvg', 'Was there an unmitigated FVG?']] as const).map(([field, title]) => <fieldset key={field}>
          <legend className="mb-1 text-sm text-ink-2">{title}</legend>
          <Choice value={s[field] === undefined ? undefined : s[field] ? 'yes' : 'no'} onChange={(v) => edit('S4', { [field]: v === 'yes' })} options={toggle} />
        </fieldset>)}
      </div>;
    }
    case 'S5': {
      const s = value.S5 ?? {};
      return <div className="space-y-3"><LevelList levels={s.levels ?? []} inducementId={s.inducementId} onChange={(levels, inducementId) => edit('S5', { levels, inducementId })} />
        <PriceField label="Potential draw price" value={s.target} onChange={(target) => edit('S5', { target })} /></div>;
    }
    case 'S6': {
      const s = value.S6 ?? {};
      return <div className="space-y-3">
        {(['primary', 'backup'] as const).map((role) => {
          const poi = s[role];
          return <fieldset key={role} className="rounded-lg border border-line p-3"><legend className="px-1 capitalize">{role} POI</legend>
            {poi ? <PoiEditor poi={poi} onChange={(next) => edit('S6', { [role]: next })} onRemove={() => edit('S6', { [role]: undefined })} />
              : <button className="tos-secondary" onClick={() => edit('S6', { [role]: { ...blankPoi(value.S2?.direction === 'BEARISH' ? 'SELL' : 'BUY', role === 'primary' ? 'POI A' : 'POI B'), beyondInducement: false } })}>Add {role} POI</button>}
          </fieldset>;
        })}
        <PriceField label="Invalidation level" value={s.invalidation} onChange={(invalidation) => edit('S6', { invalidation })} />
      </div>;
    }
    case 'S7': {
      const s = value.S7 ?? {};
      return <div className="space-y-3">
        <AnalysisText label="Observed Wyckoff events" value={s.events} change={(events) => edit('S7', { events })} area />
        <Grid><PriceField label="Event volume" value={s.volume} onChange={(volume) => edit('S7', { volume })} /><PriceField label="Comparison volume" value={s.baselineVolume} onChange={(baselineVolume) => edit('S7', { baselineVolume })} /></Grid>
        {s.volume !== undefined && s.volume >= 0 && s.baselineVolume !== undefined && s.baselineVolume > 0 && <Computed label="Relative volume" value={`${(s.volume / s.baselineVolume).toFixed(2)}×`} />}
        <AnalysisText label="Proposed Wyckoff phase" value={s.phase} change={(phase) => edit('S7', { phase })} />
      </div>;
    }
    case 'S8': {
      const facts = value.S8?.facts ?? [];
      return <div className="space-y-3">
        {facts.map((fact, index) => {
          const change = (patch: Partial<typeof fact>) => edit('S8', { facts: facts.map((item) => item.id === fact.id ? { ...fact, ...patch } : item) });
          return <fieldset key={fact.id} className="space-y-2 rounded-lg border border-line p-3"><legend className="px-1">Source {index + 1}</legend>
            <Grid><AnalysisText label="Source or reference URL" value={fact.source} change={(source) => change({ source })} />
              <label className="text-sm text-ink-2">Publication time (UTC)<input className="tos-input mt-1" type="datetime-local" max={cutoff.slice(0, 16)} value={fact.date ?? ''} onChange={(e) => change({ date: e.target.value })} /></label></Grid>
            <AnalysisText label="Published fact" value={fact.fact} change={(text) => change({ fact: text })} area />
            <button className="tos-secondary" onClick={() => edit('S8', { facts: facts.filter((item) => item.id !== fact.id) })}>Remove source {index + 1}</button>
          </fieldset>;
        })}
        <button className="tos-secondary" onClick={() => edit('S8', { facts: [...facts, { id: newLocalId() }] })}>Add a source</button>
      </div>;
    }
  }
}
