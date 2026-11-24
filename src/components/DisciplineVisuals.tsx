import React from 'react';
import { Flame } from 'lucide-react';
import type { BadgeState, DayState, Tier } from '../utils/discipline';
import { TIER_LABEL } from '../utils/discipline';

const toneColor = {
  aqua: 'var(--tos-accent)',
  amber: 'var(--tos-warning)',
  rose: 'var(--tos-negative)',
  emerald: 'var(--tos-positive)',
};

const bounded = (value: number) => Math.max(0, Math.min(100, value));

export const ProgressBar: React.FC<{ pct: number; tone?: keyof typeof toneColor; className?: string; label?: string }> = ({ pct, tone = 'aqua', className, label = 'Progress' }) => (
  <progress className={`tos-progress ${className ?? 'w-full'}`} max={100} value={bounded(pct)}
    style={{ '--progress-fill': toneColor[tone] } as React.CSSProperties} aria-label={label} />
);

export const DisciplineGauge: React.FC<{ pct: number; size?: number; label?: string; sub?: string; tone?: 'aqua' | 'amber' | 'rose' }> = ({ pct, size = 168, label = 'Discipline', sub, tone = 'aqua' }) => (
  <div className="max-w-full shrink-0 rounded-lg bg-well p-3 ring-1 ring-inset ring-line" style={{ width: size }}>
    <div className="tos-label">{label}</div>
    <div className="tos-figure my-1 text-3xl leading-none text-ink">{Math.round(bounded(pct))}%</div>
    <ProgressBar pct={pct} tone={tone} label={label} />
    {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
  </div>
);

const tierStyle: Record<Tier | 'locked', string> = {
  bronze: 'border-orange-500/30 text-orange-300',
  silver: 'border-line-strong text-ink',
  gold: 'border-amber-500/35 text-amber-300',
  locked: 'border-line text-ink-3',
};

export const BadgeMark: React.FC<{ tier: Tier | null; mono: string; size?: number }> = ({ tier, mono, size = 44 }) => (
  <span className={`inline-grid shrink-0 place-items-center rounded-lg border bg-raised font-mono text-sm font-semibold ${tierStyle[tier ?? 'locked']}`}
    style={{ width: size, height: size }} aria-hidden="true">{mono}</span>
);

/** Badge tier and progress to its next threshold. */
export const BadgeTile: React.FC<{ badge: BadgeState; compact?: boolean }> = ({ badge, compact }) => {
  const { def, value, tier, next } = badge;
  const pct = next ? (value / next.target) * 100 : 100;
  return (
    <div className={`group flex ${compact ? 'items-center gap-3' : 'flex-col items-center text-center gap-2.5 p-4'} rounded-2xl`}>
      <BadgeMark tier={tier} mono={def.mono} size={compact ? 48 : 72} />
      <div className={compact ? 'min-w-0 flex-1' : 'w-full'}>
        <div className="text-sm font-semibold text-ink">{def.name}</div>
        <div className="text-[11px] text-ink-3 leading-snug">{tier ? `${TIER_LABEL[tier]} · ` : ''}{def.rule}</div>
        <div className="mt-2 flex items-center gap-2">
          <ProgressBar pct={pct} tone={tier === 'gold' ? 'amber' : 'aqua'} className="flex-1" />
          <span className="text-[10px] tabular-nums text-ink-3 whitespace-nowrap">{next ? `${value}/${next.target}` : 'Maxed'}</span>
        </div>
      </div>
    </div>
  );
};

const CELL: Record<DayState | 'FUTURE', string> = {
  NONE: 'bg-well ring-1 ring-inset ring-line',
  FUTURE: 'bg-transparent ring-1 ring-inset ring-line/50',
  CLEAN: 'bg-[var(--tos-positive)]',
  PARTIAL: 'bg-teal-500/40 ring-1 ring-inset ring-teal-400/30',
  BROKEN: 'bg-rose-500/70 ring-1 ring-inset ring-rose-300/30',
};
const STATE_TEXT: Record<DayState | 'FUTURE', string> = {
  NONE: 'No trades', FUTURE: '', CLEAN: 'Every trade 5/5, no rule broken', PARTIAL: 'No rule broken', BROKEN: 'A rule was broken',
};

/** Weeks as columns, days as rows — a process calendar. */
export const ProcessHeatmap: React.FC<{ weeks: Array<Array<{ date: string; state: DayState | 'FUTURE'; trades: number; avgProcess: number }>> }> = ({ weeks }) => (
  <div>
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      <div className="grid grid-rows-7 gap-1.5 pr-1 text-[9px] text-ink-3">
        {['M', '', 'W', '', 'F', '', 'S'].map((d, i) => <span key={i} className="h-3.5 leading-[14px]">{d}</span>)}
      </div>
      {weeks.map((col, w) => (
        <div key={w} className="grid grid-rows-7 gap-1.5">
          {col.map((d) => (
            <span key={d.date} className={`h-3.5 w-3.5 rounded-[4px] ${CELL[d.state]}`}
              title={d.state === 'FUTURE' ? d.date : `${d.date}: ${STATE_TEXT[d.state]}${d.trades ? ` · ${d.trades} trade${d.trades > 1 ? 's' : ''}, avg ${d.avgProcess}/5` : ''}`} />
          ))}
        </div>
      ))}
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-ink-3">
      {(['CLEAN', 'PARTIAL', 'BROKEN', 'NONE'] as const).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-[3px] ${CELL[s]}`} />{STATE_TEXT[s]}</span>
      ))}
    </div>
  </div>
);

export const StreakFlame: React.FC<{ n: number; className?: string }> = ({ n, className = 'h-5 w-5' }) => (
  <Flame aria-hidden="true" className={`${className} ${n > 0 ? 'text-amber-300' : 'text-ink-3'}`} />
);
