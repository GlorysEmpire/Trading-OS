import type { AccountRisk, Trade, TradingAccount, TradingAccountKind } from '../types';
import { traderDateString } from './traderTime';

export const ACCOUNT_KIND_LABEL: Record<TradingAccountKind, string> = {
  PROP_CHALLENGE: 'Prop challenge',
  PROP_FUNDED: 'Prop funded',
  PERSONAL: 'Personal',
  DEMO: 'Demo',
  OTHER: 'Other',
};

export interface AccountSummary {
  accountId: string;
  balance: number;
  /** Money from closed trades (actual where entered, estimated otherwise). */
  tradePnl: number;
  /** Deposits minus withdrawals, payouts and fees. */
  adjustmentsTotal: number;
  /** Trade P/L as a % of the starting balance. */
  returnPct: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  totalR: number;
  /** Closed trades without an actual money result (balance uses risk % × R). */
  estimatedTrades: number;
  /** Of those, how many had no risk % recorded and used today's HQ risk. */
  fallbackRiskTrades: number;
  /** Lowest balance reached, and the deepest drop from a previous high (money). */
  maxDrawdown: number;
  /** Money result of each closed trade on the account, by trade id. */
  perTrade: Record<string, { amount: number; estimated: boolean }>;
  /** Highest balance reached (for trailing drawdown). */
  peakBalance: number;
  /** Every balance change in order, with its New York trading day. */
  history: Array<{ day: string; kind: 'trade' | 'adjustment'; amount: number; balanceAfter: number }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The accounts a trade is on (new multi-account field, or the older single one). */
export function tradeAccountIds(trade: Pick<Trade, 'accountIds' | 'accountId'>): string[] {
  if (Array.isArray(trade.accountIds)) return trade.accountIds;
  return trade.accountId ? [trade.accountId] : [];
}

/** The actual money result entered for one account, if any. */
export function actualPnl(trade: Trade, accountId: string): number | undefined {
  const v = trade.pnlByAccount?.[accountId];
  if (v !== undefined && Number.isFinite(v)) return v;
  if (trade.accountId === accountId && trade.pnlAmount !== undefined && Number.isFinite(trade.pnlAmount)) return trade.pnlAmount;
  return undefined;
}

/** The risk recorded for one account on a trade, if any. */
export function tradeRisk(trade: Trade, accountId: string): AccountRisk | undefined {
  const r = trade.riskByAccount?.[accountId];
  return r && Number.isFinite(r.amount) && r.amount > 0 ? r : undefined;
}

/** Money result of a closed trade on one account: the actual amount if
 * entered; else the money risked on that account × R; else the account's
 * balance at the time × risk % × R. */
export function tradePnl(trade: Trade, accountId: string, balanceBefore: number, fallbackRiskPct: number): { amount: number; estimated: boolean; fallbackRisk: boolean } {
  const actual = actualPnl(trade, accountId);
  if (actual !== undefined) return { amount: actual, estimated: false, fallbackRisk: false };
  const recorded = tradeRisk(trade, accountId);
  if (recorded && Number.isFinite(trade.realizedR)) return { amount: recorded.amount * (trade.realizedR ?? 0), estimated: true, fallbackRisk: false };
  const risk = trade.riskPercentAtEntry ?? fallbackRiskPct;
  const r = trade.realizedR ?? 0;
  if (!Number.isFinite(risk) || risk < 0 || !Number.isFinite(r)) return { amount: 0, estimated: true, fallbackRisk: trade.riskPercentAtEntry === undefined };
  return { amount: balanceBefore * (risk / 100) * r, estimated: true, fallbackRisk: trade.riskPercentAtEntry === undefined };
}

const countsTowardBalance = (t: Trade) => t.status === 'CLOSED' && !t.voided;

/** Balance and stats for one account, replaying trades and deposits/withdrawals in date order. */
export function summarizeAccount(account: TradingAccount, trades: Trade[], fallbackRiskPct: number): AccountSummary {
  const mine = trades.filter((t) => tradeAccountIds(t).includes(account.id) && !t.voided);
  const closed = mine.filter(countsTowardBalance);
  type Ev = { at: number; order: number; kind: 'trade'; trade: Trade } | { at: number; order: number; kind: 'adj'; amount: number };
  const events: Ev[] = [
    ...closed.map((t) => ({ at: t.closedAt ?? t.timestamp, order: 1, kind: 'trade' as const, trade: t })),
    // A deposit counts from the start of its day, before that day's trades.
    ...account.adjustments.map((a) => ({ at: Date.parse(`${a.date}T00:00:00Z`) || 0, order: 0, kind: 'adj' as const, amount: a.amount })),
  ];
  events.sort((a, b) => a.at - b.at || a.order - b.order || (a.kind === 'trade' && b.kind === 'trade' ? a.trade.id.localeCompare(b.trade.id) : 0));

  let balance = account.startingBalance;
  let peak = balance;
  let maxDrawdown = 0;
  let pnl = 0;
  let adjustmentsTotal = 0;
  let estimatedTrades = 0;
  let fallbackRiskTrades = 0;
  let wins = 0;
  let losses = 0;
  let totalR = 0;
  const perTrade: AccountSummary['perTrade'] = {};
  const history: AccountSummary['history'] = [];
  const dayOf = (at: number) => traderDateString(new Date(at));
  for (const e of events) {
    if (e.kind === 'adj') {
      balance += e.amount;
      adjustmentsTotal += e.amount;
      peak = Math.max(peak, balance);
      history.push({ day: dayOf(e.at + 12 * 3_600_000), kind: 'adjustment', amount: e.amount, balanceAfter: balance });
      continue;
    }
    const r = tradePnl(e.trade, account.id, balance, fallbackRiskPct);
    if (r.estimated) estimatedTrades++;
    if (r.estimated && r.fallbackRisk) fallbackRiskTrades++;
    balance += r.amount;
    pnl += r.amount;
    perTrade[e.trade.id] = { amount: round2(r.amount), estimated: r.estimated };
    history.push({ day: dayOf(e.at), kind: 'trade', amount: r.amount, balanceAfter: balance });
    if (e.trade.outcome === 'WIN') wins++;
    else if (e.trade.outcome === 'LOSS' || e.trade.outcome === 'SCRATCH') losses++;
    totalR += e.trade.realizedR ?? 0;
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, peak - balance);
  }
  return {
    accountId: account.id,
    balance: round2(balance),
    tradePnl: round2(pnl),
    adjustmentsTotal: round2(adjustmentsTotal),
    returnPct: round2((pnl / account.startingBalance) * 100),
    closedTrades: closed.length,
    openTrades: mine.filter((t) => t.status === 'OPEN').length,
    wins,
    losses,
    totalR: round2(totalR),
    estimatedTrades,
    fallbackRiskTrades,
    maxDrawdown: round2(maxDrawdown),
    perTrade,
    peakBalance: round2(peak),
    history,
  };
}

/** Trades (not voided) that aren't on any existing account. */
export function unassignedTrades(trades: Trade[], accounts: TradingAccount[]): Trade[] {
  const ids = new Set(accounts.map((a) => a.id));
  return trades.filter((t) => !t.voided && (t.status === 'OPEN' || t.status === 'CLOSED') && !tradeAccountIds(t).some((id) => ids.has(id)));
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Accounts to preselect when logging a trade: the ones used on the last
 * trade that are still active, else the only active account, else none. */
export function defaultAccountIds(accounts: TradingAccount[], trades: Trade[]): string[] {
  const active = new Set(accounts.filter((a) => !a.archivedAt).map((a) => a.id));
  const last = [...trades].filter((t) => tradeAccountIds(t).length).sort((a, b) => b.timestamp - a.timestamp)[0];
  const fromLast = last ? tradeAccountIds(last).filter((id) => active.has(id)) : [];
  if (fromLast.length) return fromLast;
  return active.size === 1 ? [...active] : [];
}

export function newAccountId(): string {
  return `acc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Risk allowed per trade on an account: its own setting, else Trading HQ's. */
export function accountRiskPct(account: TradingAccount, hqRiskPct: number): number {
  return account.riskPct ?? hqRiskPct;
}

export type LimitState = 'OK' | 'CLOSE' | 'BREACHED';
const stateOf = (used: number, limit: number): LimitState => (used >= limit - 0.005 ? 'BREACHED' : used >= limit * 0.8 ? 'CLOSE' : 'OK');

export interface PropStatus {
  daily?: {
    limit: number;
    /** Net loss so far today (0 if today is up). */
    used: number;
    remaining: number;
    /** Today's net loss if every open trade on the account hits its stop. */
    usedIfOpenStopped: number;
    state: LimitState;
    basis: 'STARTING_BALANCE' | 'DAY_START_BALANCE';
  };
  max?: {
    limit: number;
    /** The balance the account must stay above. */
    floor: number;
    remaining: number;
    remainingIfOpenStopped: number;
    state: LimitState;
    type: 'STATIC' | 'TRAILING';
  };
  target?: { amount: number; progress: number; reached: boolean };
  tradingDays?: { done: number; required: number };
  openRisk: number;
}

/** Money at risk on open trades on this account (recorded risk, else risk % of balance). */
export function openRisk(account: TradingAccount, trades: Trade[], balance: number, hqRiskPct: number): number {
  return trades
    .filter((t) => t.status === 'OPEN' && !t.voided && tradeAccountIds(t).includes(account.id))
    .reduce((sum, t) => sum + (tradeRisk(t, account.id)?.amount ?? balance * ((t.riskPercentAtEntry ?? accountRiskPct(account, hqRiskPct)) / 100)), 0);
}

/** Where a prop account stands against its firm's rules, today (New York trading day). */
export function propStatus(account: TradingAccount, summary: AccountSummary, trades: Trade[], hqRiskPct: number, today: string = traderDateString()): PropStatus | undefined {
  const rules = account.propRules;
  if (!rules) return undefined;
  const start = account.startingBalance;
  const open = openRisk(account, trades, summary.balance, hqRiskPct);
  const out: PropStatus = { openRisk: round2(open) };

  if (rules.dailyLossPct) {
    const before = summary.history.filter((h) => h.day < today);
    const dayStart = before.length ? before[before.length - 1].balanceAfter : start;
    const basis = rules.dailyLossBasis ?? 'STARTING_BALANCE';
    const limit = ((basis === 'DAY_START_BALANCE' ? dayStart : start) * rules.dailyLossPct) / 100;
    const todayPnl = summary.history.filter((h) => h.day === today && h.kind === 'trade').reduce((t, h) => t + h.amount, 0);
    const used = Math.max(0, -todayPnl);
    out.daily = {
      limit: round2(limit),
      used: round2(used),
      remaining: round2(Math.max(0, limit - used)),
      usedIfOpenStopped: round2(used + open),
      state: stateOf(used, limit),
      basis,
    };
  }

  if (rules.maxLossPct) {
    const limit = (start * rules.maxLossPct) / 100;
    const type = rules.maxLossType ?? 'STATIC';
    let floor = start - limit;
    if (type === 'TRAILING') {
      floor = summary.peakBalance - limit;
      if (rules.trailingLocksAtStart) floor = Math.min(floor, start);
    }
    const remaining = summary.balance - floor;
    out.max = {
      limit: round2(limit),
      floor: round2(floor),
      remaining: round2(Math.max(0, remaining)),
      remainingIfOpenStopped: round2(remaining - open),
      state: stateOf(limit - remaining, limit),
      type,
    };
  }

  if (rules.profitTargetPct) {
    const amount = (start * rules.profitTargetPct) / 100;
    const progress = summary.balance - start;
    out.target = { amount: round2(amount), progress: round2(progress), reached: progress >= amount };
  }

  if (rules.minTradingDays) {
    const days = new Set(summary.history.filter((h) => h.kind === 'trade').map((h) => h.day));
    out.tradingDays = { done: days.size, required: rules.minTradingDays };
  }
  return out;
}

/** Warnings for a planned risk on one account: over its allowed risk, or more
 * than the room left before a prop limit. */
export function riskWarnings(account: TradingAccount, risk: AccountRisk, hqRiskPct: number, status: PropStatus | undefined): string[] {
  const out: string[] = [];
  const allowed = accountRiskPct(account, hqRiskPct);
  if (risk.pct > allowed + 1e-9) out.push(`${account.name}: ${round2(risk.pct)}% is above this account's ${allowed}% risk per trade.`);
  if (status?.daily && risk.amount > status.daily.remaining - (status.daily.usedIfOpenStopped - status.daily.used) + 1e-9) {
    out.push(`${account.name}: if this and your open trades all stop out, you pass today's daily loss limit.`);
  }
  if (status?.max && risk.amount > status.max.remainingIfOpenStopped + 1e-9) {
    out.push(`${account.name}: if this and your open trades all stop out, you pass the max loss limit.`);
  }
  return out;
}
