import React, { useEffect, useRef, useState } from 'react';
import type { BadgeState, DayState, Tier } from '../utils/discipline';
import { TIER_LABEL } from '../utils/discipline';

/** Eases a number from its previous value to `value` (respects reduced motion). */
export function useCountUp(value: number, ms = 900): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from.current === value) { setShown(value); from.current = value; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value, ms]);
  return shown;
}

const WAVE = 'M0 10 Q 25 0 50 10 T 100 10 T 150 10 T 200 10 V 40 H 0 Z';

/** A glass sphere filled with liquid to `pct` (0–100). */
export const LiquidOrb: React.FC<{ pct: number; size?: number; label?: string; sub?: string; tone?: 'aqua' | 'amber' | 'rose' }> = ({ pct, size = 168, label, sub, tone = 'aqua' }) => {
  const shown = useCountUp(pct);
  const level = 100 - Math.max(4, Math.min(100, shown));
  const colors = {
    aqua: ['#5eead4', '#0891b2'],
    amber: ['#fcd34d', '#d97706'],
    rose: ['#fda4af', '#e11d48'],
  }[tone];
  const id = React.useId().replace(/:/g, '');
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label ?? 'Discipline'} ${Math.round(pct)}%`}>
      <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 30px 60px -24px ${colors[1]}88, 0 0 0 1px rgba(255,255,255,.08) inset` }} />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full rounded-full overflow-hidden">
        <defs>
          <clipPath id={`c${id}`}><circle cx="50" cy="50" r="48" /></clipPath>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={colors[0]} />
            <stop offset="1" stopColor={colors[1]} />
          </linearGradient>
          <radialGradient id={`s${id}`} cx="35%" cy="28%" r="70%">
            <stop offset="0" stopColor="rgba(255,255,255,.22)" />
            <stop offset=".45" stopColor="rgba(255,255,255,.03)" />
            <stop offset="1" stopColor="rgba(0,0,0,.25)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="var(--tos-well)" />
        <g clipPath={`url(#c${id})`}>
          <g style={{ transform: `translateY(${level}px)`, transition: 'transform 1.2s cubic-bezier(.2,.8,.2,1)' }}>
            <path d={WAVE} fill={`url(#g${id})`} opacity=".45" className="tos-wave-slow" />
            <path d={WAVE} fill={`url(#g${id})`} className="tos-wave-fast" transform="translate(0 3)" />
            <rect x="0" y="40" width="100" height="70" fill={colors[1]} />
          </g>
        </g>
        <circle cx="50" cy="50" r="48" fill={`url(#s${id})`} />
        <ellipse cx="36" cy="22" rx="16" ry="7" fill="rgba(255,255,255,.18)" />
        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="tos-figure text-[2.1rem] leading-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.45)]">{Math.round(shown)}<span className="text-lg align-top">%</span></div>
          {label && <div className="mt-1 text-[10px] font-semibold uppercase tracking-[.18em] text-white/85">{label}</div>}
          {sub && <div className="text-[10px] text-white/70">{sub}</div>}
        </div>
      </div>
    </div>
  );
};

/** A thin liquid progress bar. */
export const LiquidBar: React.FC<{ pct: number; tone?: 'aqua' | 'amber' | 'rose' | 'emerald'; className?: string }> = ({ pct, tone = 'aqua', className }) => {
  const bg = { aqua: 'from-teal-300 to-cyan-500', amber: 'from-amber-300 to-orange-500', rose: 'from-rose-300 to-rose-500', emerald: 'from-emerald-300 to-emerald-500' }[tone];
  return (
    <div className={`relative h-2 rounded-full bg-well overflow-hidden ring-1 ring-inset ring-line ${className ?? ''}`}>
      <div className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${bg} shadow-[0_0_12px_rgba(45,212,191,.35)]`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }}>
        <span className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-white/30" />
      </div>
    </div>
  );
};

const TIER_FACE: Record<Tier | 'locked', { face: string; rim: string; ink: string; glow: string }> = {
  bronze: { face: 'radial-gradient(circle at 32% 28%, #ffe2c2 0%, #d98b4f 38%, #8a4b22 78%, #5c2f14 100%)', rim: 'conic-gradient(from 210deg, #f6c79a, #7a3f1b, #e8a46d, #5c2f14, #f6c79a)', ink: '#3b1b08', glow: 'rgba(217,139,79,.45)' },
  silver: { face: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #d5dde6 36%, #8994a3 78%, #5b6573 100%)', rim: 'conic-gradient(from 210deg, #f8fafc, #7d8896, #e2e8f0, #59636f, #f8fafc)', ink: '#1f2937', glow: 'rgba(203,213,225,.45)' },
  gold: { face: 'radial-gradient(circle at 32% 28%, #fff7d1 0%, #f5c84c 36%, #b7791f 78%, #7c4a03 100%)', rim: 'conic-gradient(from 210deg, #fde68a, #a16207, #fcd34d, #78350f, #fde68a)', ink: '#3f2a02', glow: 'rgba(245,200,76,.5)' },
  locked: { face: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.16) 0%, rgba(255,255,255,.05) 50%, rgba(0,0,0,.2) 100%)', rim: 'conic-gradient(from 210deg, rgba(255,255,255,.22), rgba(255,255,255,.04), rgba(255,255,255,.16), rgba(255,255,255,.03), rgba(255,255,255,.22))', ink: 'var(--tos-ink-3)', glow: 'transparent' },
};

/** A minted 3D coin. Locked badges stay as glass outlines. */
export const BadgeCoin: React.FC<{ tier: Tier | null; mono: string; size?: number; spin?: boolean }> = ({ tier, mono, size = 64, spin }) => {
  const t = TIER_FACE[tier ?? 'locked'];
  return (
    <div className="relative shrink-0 [perspective:600px]" style={{ width: size, height: size }}>
      <div className={`relative h-full w-full rounded-full ${spin ? 'tos-coin-spin' : 'tos-coin'}`}
        style={{ background: t.rim, padding: size * 0.07, boxShadow: tier ? `0 ${size * 0.18}px ${size * 0.35}px -${size * 0.12}px ${t.glow}, 0 2px 0 rgba(0,0,0,.35)` : 'none' }}>
        <div className="relative h-full w-full rounded-full overflow-hidden grid place-items-center"
          style={{ background: t.face, boxShadow: 'inset 0 2px 3px rgba(255,255,255,.55), inset 0 -3px 6px rgba(0,0,0,.35)' }}>
          <div className="absolute inset-[14%] rounded-full" style={{ boxShadow: tier ? 'inset 0 1px 2px rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.4)' : 'inset 0 0 0 1px rgba(255,255,255,.08)' }} />
          <span className="relative font-extrabold tracking-tight" style={{ color: t.ink, fontSize: size * 0.27, textShadow: tier ? '0 1px 0 rgba(255,255,255,.45)' : 'none' }}>{mono}</span>
          {tier && <span className="tos-coin-shine pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />}
        </div>
      </div>
    </div>
  );
};

/** A badge with its coin, name, tier and progress to the next tier. */
export const BadgeTile: React.FC<{ badge: BadgeState; compact?: boolean }> = ({ badge, compact }) => {
  const { def, value, tier, next } = badge;
  const pct = next ? (value / next.target) * 100 : 100;
  return (
    <div className={`group flex ${compact ? 'items-center gap-3' : 'flex-col items-center text-center gap-2.5 p-4'} rounded-2xl`}>
      <BadgeCoin tier={tier} mono={def.mono} size={compact ? 48 : 72} />
      <div className={compact ? 'min-w-0 flex-1' : 'w-full'}>
        <div className="text-sm font-semibold text-ink">{def.name}</div>
        <div className="text-[11px] text-ink-3 leading-snug">{tier ? `${TIER_LABEL[tier]} · ` : ''}{def.rule}</div>
        <div className="mt-2 flex items-center gap-2">
          <LiquidBar pct={pct} tone={tier === 'gold' ? 'amber' : 'aqua'} className="flex-1" />
          <span className="text-[10px] tabular-nums text-ink-3 whitespace-nowrap">{next ? `${value}/${next.target}` : 'Maxed'}</span>
        </div>
      </div>
    </div>
  );
};

const CELL: Record<DayState | 'FUTURE', string> = {
  NONE: 'bg-well ring-1 ring-inset ring-line',
  FUTURE: 'bg-transparent ring-1 ring-inset ring-line/50',
  CLEAN: 'bg-gradient-to-br from-teal-300 to-cyan-500 shadow-[0_0_10px_rgba(45,212,191,.45)]',
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

/** Flame for a streak; still when the streak is 0. */
export const StreakFlame: React.FC<{ n: number; className?: string }> = ({ n, className }) => (
  <svg viewBox="0 0 24 24" className={`${className ?? 'h-5 w-5'} ${n > 0 ? 'tos-flame' : 'opacity-40 grayscale'}`} aria-hidden>
    <defs>
      <linearGradient id="tosFlame" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#f97316" />
        <stop offset=".6" stopColor="#fb923c" />
        <stop offset="1" stopColor="#fde68a" />
      </linearGradient>
    </defs>
    <path fill="url(#tosFlame)" d="M12 2c.6 3.2 3.9 5 4.9 8.4.9 3.3-.6 7.1-4.1 8.4-3.6 1.3-7.6-.9-8.1-4.8-.4-2.6.9-4.4 2.3-5.6-.1 1.6.5 2.9 1.7 3.4C8.4 8.2 10.6 5.3 12 2z" />
    <path fill="#fff7ed" opacity=".75" d="M12.3 12.2c.3 1.3 1.6 2 1.7 3.4.1 1.5-1 2.7-2.4 2.7s-2.4-1-2.3-2.4c.1-1.2 1-1.8 1.5-2.6.2.7.6 1.1 1.1 1.2-.1-.9.1-1.6.4-2.3z" />
  </svg>
);
