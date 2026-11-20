import type { Trade, TradingAccount, TradingAccountKind } from '../types';

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

/** Money result of a closed trade on one account: the actual amount if
 * entered, else the account's balance at the time × risk % × R. */
export function tradePnl(trade: Trade, accountId: string, balanceBefore: number, fallbackRiskPct: number): { amount: number; estimated: boolean; fallbackRisk: boolean } {
  const actual = actualPnl(trade, accountId);
  if (actual !== undefined) return { amount: actual, estimated: false, fallbackRisk: false };
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
  for (const e of events) {
    if (e.kind === 'adj') {
      balance += e.amount;
      adjustmentsTotal += e.amount;
      peak = Math.max(peak, balance);
      continue;
    }
    const r = tradePnl(e.trade, account.id, balance, fallbackRiskPct);
    if (r.estimated) estimatedTrades++;
    if (r.estimated && r.fallbackRisk) fallbackRiskTrades++;
    balance += r.amount;
    pnl += r.amount;
    perTrade[e.trade.id] = { amount: round2(r.amount), estimated: r.estimated };
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
