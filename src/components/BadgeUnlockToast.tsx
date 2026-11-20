import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { traderDateString } from '../utils/traderTime';
import { badgeDefsFor, badgeStates, badgeValues, earnedKeys, TIER_LABEL, type Tier } from '../utils/discipline';
import { BadgeCoin } from './DisciplineVisuals';

const SEEN_KEY = 'trading_os_badges_seen_v1';

/** Shows a minted coin when a new badge tier is reached. Silent the first
 * time (so existing history doesn't flood in) and after trades finish loading. */
export const BadgeUnlockToast: React.FC = () => {
  const { trades, debriefs, backtestSamples, tradingHQ, tradesLoading, setActiveTab } = useTrading();
  const states = useMemo(
    () => badgeStates(badgeValues(trades, debriefs, backtestSamples, tradingHQ.riskRules.maxDailyLosses, traderDateString(), tradingHQ.setupGrades[0]?.grade), badgeDefsFor(tradingHQ)),
    [trades, debriefs, backtestSamples, tradingHQ],
  );
  const [unlock, setUnlock] = useState<{ id: string; tier: Tier } | null>(null);

  useEffect(() => {
    if (tradesLoading) return;
    const keys = earnedKeys(states);
    let seen: string[] | null = null;
    try { const raw = localStorage.getItem(SEEN_KEY); seen = raw ? JSON.parse(raw) : null; } catch { return; }
    const save = () => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...(seen ?? []), ...keys])])); } catch { /* ignore */ } };
    if (!seen) { save(); return; }
    const fresh = keys.filter((k) => !seen!.includes(k));
    if (fresh.length) {
      const [id, tier] = fresh[fresh.length - 1].split(':') as [string, Tier];
      setUnlock({ id, tier });
    }
    save();
  }, [states, tradesLoading]);

  useEffect(() => {
    if (!unlock) return;
    const t = setTimeout(() => setUnlock(null), 7000);
    return () => clearTimeout(t);
  }, [unlock]);

  if (!unlock) return null;
  const badge = states.find((s) => s.def.id === unlock.id);
  if (!badge) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-sm md:bottom-6 md:right-6 md:left-auto md:mx-0">
      <div className="tos-glass tos-pop relative flex items-center gap-4 rounded-3xl p-4 pr-10">
        <BadgeCoin tier={unlock.tier} mono={badge.def.mono} size={60} spin />
        <button onClick={() => { setUnlock(null); setActiveTab('discipline'); }} className="min-w-0 text-left">
          <div className="tos-label">Badge earned</div>
          <div className="text-base font-semibold text-ink">{TIER_LABEL[unlock.tier]} {badge.def.name}</div>
          <div className="text-xs text-ink-3">{badge.def.rule}: {badge.value}</div>
        </button>
        <button onClick={() => setUnlock(null)} aria-label="Dismiss" className="absolute right-3 top-3 text-ink-3 hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
};
