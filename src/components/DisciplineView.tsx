import React, { useMemo } from 'react';
import { Award } from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { traderDateString } from '../utils/traderTime';
import {
  badgeDefsFor, badgeStates, badgeValues, debriefStreak, disciplineDays, disciplineStreak, disciplineToday, planKeptStreak, processCalendar, winStreak,
} from '../utils/discipline';
import { BadgeTile, DisciplineGauge, ProcessHeatmap, StreakFlame } from './DisciplineVisuals';
import { PageTitle } from './PageTitle';

/** Streaks, the process calendar and badges. Every reward here is for
 * following the plan; results are shown only as information. */
export const DisciplineView: React.FC = () => {
  const { trades, debriefs, backtestSamples, tradingHQ, setActiveTab } = useTrading();
  const today = traderDateString();

  const d = useMemo(() => {
    const days = disciplineDays(trades);
    const badges = badgeStates(badgeValues(trades, debriefs, backtestSamples, tradingHQ.riskRules.maxDailyLosses, today, tradingHQ.setupGrades[0]?.grade), badgeDefsFor(tradingHQ));
    return {
      today: disciplineToday(trades, today),
      streak: disciplineStreak(days),
      plan: planKeptStreak(trades),
      debrief: debriefStreak(debriefs, today),
      wins: winStreak(trades),
      calendar: processCalendar(days, today, 16),
      clean: days.filter((x) => x.state === 'CLEAN').length,
      broken: days.filter((x) => x.state === 'BROKEN').length,
      tradedDays: days.length,
      badges,
      earned: badges.filter((b) => b.tier).length,
    };
  }, [trades, debriefs, backtestSamples, tradingHQ, today]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <PageTitle icon={Award} title="Discipline" description="Streaks and badges for following your plan. Results never earn a badge; process does."
        meta={<span className="text-ink-3">Built from your Trading HQ rules, mistake codes and grades. <button onClick={() => setActiveTab('trading-hq')} className="font-semibold text-accent hover:underline">Edit your system</button></span>} />

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-5">
        <section className="tos-card tos-rise flex flex-col items-center justify-center gap-3 p-6">
          <div><DisciplineGauge pct={d.today.pct} label="Today" sub={d.today.trades ? `${d.today.trades} trade${d.today.trades > 1 ? 's' : ''}` : 'No trades yet'} size={188} /></div>
          <p className="max-w-[15rem] text-center text-xs text-ink-3">Average process score of today's trades, minus a step for each rule broken.</p>
        </section>
        <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StreakCard label="Discipline streak" value={d.streak.current} best={d.streak.best} unit="days" hint="Trading days in a row with no rule broken" flame />
          <StreakCard label="Plan kept" value={d.plan.current} best={d.plan.best} unit="trades" hint="Closed trades in a row at 5/5 process" />
          <StreakCard label="Debrief streak" value={d.debrief.current} best={d.debrief.best} unit="days" hint="Days in a row with a written debrief" />
          <StreakCard label="Wins in a row" value={d.wins} unit="trades" hint="Shown for information. Never rewarded." muted />
        </section>
      </div>

      <section className="tos-card tos-rise p-5 sm:p-6" style={{ animationDelay: '80ms' }}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Process calendar · last 16 weeks</h2>
          <p className="text-xs text-ink-3">{d.tradedDays} trading days · {d.clean} clean · {d.broken} with a rule broken</p>
        </div>
        <ProcessHeatmap weeks={d.calendar} />
      </section>

      <section className="tos-card tos-rise p-5 sm:p-6" style={{ animationDelay: '140ms' }}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Badges</h2>
          <p className="text-xs text-ink-3">{d.earned} of {d.badges.length} earned · bronze, silver, gold · never taken away</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1">
          {d.badges.map((b) => <BadgeTile key={b.def.id} badge={b} />)}
        </div>
      </section>
    </div>
  );
};

const StreakCard: React.FC<{ label: string; value: number; best?: number; unit: string; hint: string; flame?: boolean; muted?: boolean }> = ({ label, value, best, unit, hint, flame, muted }) => {
  return (
    <div className={`tos-card tos-rise flex flex-col justify-between p-4 sm:p-5`}>
      <div className="flex items-center justify-between text-xs text-ink-3">{label}{flame && <StreakFlame n={value} />}</div>
      <div className={`tos-figure mt-3 text-4xl ${muted ? 'text-ink-2' : 'text-ink'}`}>{Math.round(value)}<span className="ml-1.5 text-sm font-medium text-ink-3">{unit}</span></div>
      <div className="mt-2 text-[11px] leading-snug text-ink-3">{hint}{best !== undefined && <> · best {best}</>}</div>
    </div>
  );
};
