import React, { useMemo, useState } from 'react';
import { X, Search, BookMarked } from 'lucide-react';

/** Plain-English definitions of the terms used across Trading OS, so the app
 * reads clearly to someone who isn't a trader. Methodology terms follow this
 * trader's own usage (e.g. AR is an analytical event, never an entry trigger). */
const TERMS: Array<{ term: string; group: string; text: string }> = [
  { group: 'Basics', term: 'Long / Short', text: 'Long means buying because you expect the price to rise. Short means selling because you expect it to fall.' },
  { group: 'Basics', term: 'Entry, Stop, Target', text: 'Entry is the price you get in at. The stop (stop loss) is the price where you accept you were wrong and exit with a small loss. The target (take profit) is where you plan to take the win.' },
  { group: 'Basics', term: 'R (R-multiple)', text: 'Results measured in units of what you risked. If you risk $100 and make $300, that is +3R; a full loss is -1R. It lets trades of different sizes be compared fairly.' },
  { group: 'Basics', term: 'Planned R / Realized R', text: 'Planned R is the reward the trade offered before entry (target distance ÷ stop distance). Realized R is what it actually returned when it closed.' },
  { group: 'Basics', term: 'Risk per trade', text: 'The share of the account you are willing to lose on one trade. Here it is 1%, every time, no exceptions.' },
  { group: 'Basics', term: 'Breakeven (BE)', text: 'Moving the stop to the entry price so the trade can no longer lose. A trade closed at entry is a scratch (0R), which counts as a loss for the daily limit.' },
  { group: 'Basics', term: 'Daily loss limit (halt)', text: 'After 2 losses in a day, trading stops until the next day. It protects against chasing losses.' },

  { group: 'Process', term: 'Setup grade (A+, B+)', text: 'How good a trade idea is before entering. A+ setups need at least 5R of potential (or 3R when the structure limits it); B+ need at least 3R.' },
  { group: 'Process', term: 'Process score', text: 'Five yes/no checks on every trade: right session, right grade, right risk, right management, right structure. It measures how well the plan was followed, not whether the trade made money.' },
  { group: 'Process', term: 'Good process loss / Bad process win', text: 'A losing trade that followed every rule is a good outcome for the system. A winning trade that broke the rules is a warning, even though it paid.' },
  { group: 'Process', term: 'Mistake code', text: 'A short tag for a specific rule break, such as BE_EARLY (moved to breakeven too soon) or REENTRY (got back in after being stopped out). They show which mistakes repeat.' },
  { group: 'Process', term: 'Session', text: 'A block of the trading day (London, New York, Afternoon, Tokyo), always defined in New York time and converted to your local time automatically.' },
  { group: 'Process', term: 'Pending setup', text: 'A planned trade waiting for its entry price. When the entry happens it moves to the Journal with all its details; if it never happens it is marked invalidated or expired.' },
  { group: 'Process', term: 'Locked trade, amendment, void', text: 'A closed trade is locked so its record can\'t be quietly changed. Corrections are logged as amendments with a reason. A duplicate or mistaken entry is voided: kept on record but left out of the stats.' },
  { group: 'Process', term: 'Debrief and 1% upgrade', text: 'A short end-of-day review: what the evidence showed, and one small improvement (the "1% upgrade") to carry into tomorrow.' },
  { group: 'Process', term: 'Focus rotation', text: 'Which markets get attention on which day of the week (e.g. Monday: BTC and ETH). A focus, not a restriction.' },

  { group: 'Market structure', term: 'Liquidity (bull / bear)', text: 'Price areas where many orders, especially stop losses, are clustered. Price is often drawn to these areas before it turns.' },
  { group: 'Market structure', term: 'Inducement', text: 'A smaller pool of liquidity that tempts traders in too early, often taken out before the real move. It is treated as a form of liquidity.' },
  { group: 'Market structure', term: 'POI (point of interest)', text: 'A price zone where a reaction is expected, chosen under or above liquidity (the "Structure, Liquidity, POI" approach).' },
  { group: 'Market structure', term: 'Order block (OB)', text: 'The last opposite candle before a strong move, where large orders are thought to have entered. A common type of POI.' },
  { group: 'Market structure', term: 'FVG (fair value gap)', text: 'A gap left by a fast move, where price traded through without overlap. Price often returns to fill part of it.' },
  { group: 'Market structure', term: 'BOS, CHoCH, MSS', text: 'Break of structure (BOS): the trend makes a new high or low. Change of character (CHoCH) and market structure shift (MSS): signs that momentum is changing direction.' },
  { group: 'Market structure', term: 'Wyckoff', text: 'A way of reading ranges as accumulation (before a rise) or distribution (before a fall). Labels like AR, ST, Spring and UTAD mark events inside the range. AR is an analytical event, never an entry signal on its own.' },
  { group: 'Market structure', term: 'HTF / LTF', text: 'Higher timeframe (monthly, weekly, daily, 4H) for direction and context; lower timeframe (15M and below) for timing the entry.' },

  { group: 'Statistics', term: 'Win rate', text: 'The share of closed trades that made money.' },
  { group: 'Statistics', term: 'Expectancy', text: 'The average result per trade in R, combining how often you win and how big wins and losses are. Positive expectancy means the approach makes money over many trades.' },
  { group: 'Statistics', term: 'Drawdown', text: 'The largest drop from a high point in results to a later low, in R. It shows how rough the bad stretches get.' },
  { group: 'Statistics', term: 'Backtest, sample, research question', text: 'A backtest replays past charts to test an idea. Each example studied is a sample. Each month has one research question; around 12–15 clean samples are needed before trusting the answer.' },
];

export const GlossaryDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = TERMS.filter((t) => !needle || t.term.toLowerCase().includes(needle) || t.text.toLowerCase().includes(needle));
    return [...new Set(list.map((t) => t.group))].map((g) => ({ group: g, terms: list.filter((t) => t.group === g) }));
  }, [q]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="w-full max-w-md h-full bg-panel border-l border-line shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-semibold text-ink">What does this mean?</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-ink-3 hover:text-ink hover:bg-raised" aria-label="Close glossary"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-3 border-b border-line">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-raised border border-line">
            <Search className="w-4 h-4 text-ink-3" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a term, e.g. R, breakeven, POI" className="flex-1 bg-transparent text-sm text-ink outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {groups.map((g) => (
            <section key={g.group} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase text-ink-3">{g.group}</h3>
              {g.terms.map((t) => (
                <div key={t.term} className="space-y-1">
                  <p className="text-sm font-semibold text-ink">{t.term}</p>
                  <p className="text-sm text-ink-2 leading-relaxed">{t.text}</p>
                </div>
              ))}
            </section>
          ))}
          {groups.length === 0 && <p className="text-sm text-ink-3">No matching term.</p>}
        </div>
      </aside>
    </div>
  );
};
