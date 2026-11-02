import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import type { ExecutionModel, FocusDay, MistakeCode, ResearchFramework, RiskRules, SessionWindow, SetupGradeRule, TradingHQConfig } from '../types';

/** One row per category, versioned: editing never overwrites — it
 * deactivates the old row and inserts the next version, so historical
 * trades keep referencing what was active when taken.
 *
 * Matches `trading_hq_configs.category`'s check constraint in Supabase —
 * but that constraint was deployed with only 6 of these 7 values (missing
 * `process_score`), which caused every HQ load to fail seeding it with a
 * 23514 violation until supabase/migrations/20261021_widen_hq_category_check.sql
 * was run. If you add another HQCategory value here, the DB constraint
 * needs a matching migration — it does not grow on its own. `focus_rotation`
 * (added 2026-11-02) is allowed by supabase/migrations/20261102000000_hq_update_nov.sql. */
export type HQCategory = 'risk' | 'setup_quality' | 'execution_model' | 'session' | 'process_score' | 'research_framework' | 'mistake_code' | 'focus_rotation';

export const HQ_CATEGORIES: HQCategory[] = ['risk', 'setup_quality', 'execution_model', 'session', 'process_score', 'mistake_code', 'research_framework', 'focus_rotation'];

export interface HQConfigRow {
  id: string;
  category: HQCategory;
  version: number;
  content: unknown;
  changed_reason: string | null;
  updated_at: string;
}

/** Real, already-confirmed methodology only (per the context handoff doc) —
 * no invented model criteria, no fabricated numbers. Anything not yet
 * confirmed is left genuinely blank/undefined rather than guessed. */
const REAL_RISK_RULES: RiskRules = {
  riskPerSetupPct: 1.0,
  maxDailyLosses: 2,
  noReEntry: true,
  noAdding: true,
  scratchCountsAsLoss: true,
};

const REAL_SETUP_GRADES: SetupGradeRule[] = [
  { grade: 'A+', minR: 5.0, breakevenAtR: 5, description: '≥5.0R, OR 3R where the structure itself makes 3R the reasonable ceiling. Breakeven only after 5R or for a structural reason; otherwise hold to TP.' },
  { grade: 'B+', minR: 3.0, breakevenAtR: 3, description: '≥3.0R with HTF narrative alignment and clear invalidation. Breakeven at 3R or for a structural reason (especially retracement trades).' },
  { grade: 'Standard minimum', minR: 3.0, description: 'Minimum acceptable trade threshold across all models.' },
];

const REAL_EXECUTION_MODELS: ExecutionModel[] = [
  {
    id: 'model-slp',
    name: 'SLP',
    description: 'Named execution model. Full definition and entry criteria are not yet documented in Trading HQ — fill in once finalized.',
    keyCriteria: [],
  },
  {
    id: 'model-wyckoff-ict',
    name: 'Wyckoff + ICT',
    description:
      'Range/schematic development read through Wyckoff phases combined with institutional order-flow concepts. AR (Automatic Reaction) is an analytical event only — never an entry trigger, POI, or mandatory sequence step. Distinguish an external CHoCH (a break of the relevant external swing structure) from an internal structural/behavioral shift; do not label every internal shift a CHoCH.',
    keyCriteria: [],
  },
  {
    id: 'model-failure-swing',
    name: 'Failure Swing',
    description: 'Named execution model. Full definition and entry criteria are not yet documented in Trading HQ — fill in once finalized.',
    keyCriteria: [],
  },
  {
    id: 'model-rdm',
    name: 'Range Delivery Model (RDM)',
    description:
      'Broader narrative concept — price delivering supply → demand and demand → supply — broader than a single entry trigger. Exact execution rules stay configurable, not invented in code.',
    keyCriteria: [],
  },
];

/** Session windows in New York time — the source of truth. Four
 * back-to-back sessions tiling the full NY day (confirmed by the trader; the
 * only problem with the old setup was that its stored Lagos times ignored US
 * daylight saving). Local times are now derived from these NY times at
 * display/scoring time, so DST and travel are handled automatically. */
/** Sessions run every day, weekends included (confirmed 2026-11-02). */
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const REAL_SESSIONS: SessionWindow[] = [
  {
    id: 'sess-london',
    name: 'London',
    nyStart: '00:00',
    nyEnd: '05:00',
    activeDays: ALL_DAYS,
    notes: 'Sub-5M execution only within this window. 15M+ setups have no window restriction.',
  },
  {
    id: 'sess-new-york',
    name: 'New York',
    nyStart: '05:00',
    nyEnd: '12:00',
    activeDays: ALL_DAYS,
    notes: 'Sub-5M execution only within this window. 15M+ setups have no window restriction.',
  },
  {
    id: 'sess-afternoon',
    name: 'Afternoon',
    nyStart: '12:00',
    nyEnd: '18:00',
    activeDays: ALL_DAYS,
    notes: 'Sub-5M execution only within this window. 15M+ setups have no window restriction.',
  },
  {
    id: 'sess-tokyo',
    name: 'Tokyo',
    nyStart: '18:00',
    nyEnd: '00:00',
    activeDays: ALL_DAYS,
    notes: 'Crosses midnight NY time (18:00–00:00). Sub-5M execution only within this window. 15M+ setups have no window restriction.',
  },
];

/** Weekly focus rotation (Trading HQ, 2026-11-02). A focus, not a restriction:
 * a qualified setup on another asset can still be traded. */
export const REAL_FOCUS_ROTATION: FocusDay[] = [
  { day: 'Monday', assets: ['BTC', 'ETH'], activity: 'Trade + Backtest' },
  { day: 'Tuesday', assets: ['NAS'], activity: 'Trade + Backtest' },
  { day: 'Wednesday', assets: ['Gold', 'Silver'], activity: 'Trade + Backtest' },
  { day: 'Thursday', assets: ['GU', 'EU'], activity: 'Trade + Backtest' },
  { day: 'Friday', assets: ['GER40'], activity: 'Trade + Backtest' },
  { day: 'Saturday', assets: ['JP225'], activity: 'Backtest / Research' },
  { day: 'Sunday', assets: ['USDCAD', 'USDCHF', 'USDJPY'], activity: 'Backtest / Research' },
];

const REAL_PROCESS_CHECKS = ['Session', 'Grade', 'Risk', 'Management', 'Structure'];

// Real codes, carried over from the earlier (Next.js) build's seed rather than
// re-invented — the audit flagged these as the ones that trace back to real
// context, unlike Build B's own M-01..M-06 list.
const REAL_MISTAKE_CODES: MistakeCode[] = [
  { code: 'BE_EARLY', label: 'Moved to break-even too early', category: 'MANAGEMENT', description: 'Moved to breakeven before the grade allows it (A+: 5R, B+: 3R) without a structural reason — new structure forming a new invalidation zone beyond the entry.' },
  { code: 'OUT_WINDOW', label: 'Traded outside session window', category: 'EXECUTION', description: 'A sub-5M entry outside the session windows (NY time). 15M+ entries are not window-restricted.' },
  { code: 'GREED_TP', label: 'Moved target for more', category: 'MANAGEMENT', description: 'Adjusted target further away mid-trade chasing additional R.' },
  { code: 'COMMUNITY_PRESSURE', label: 'Influenced by community pressure', category: 'PSYCHOLOGY', description: 'Decision was influenced by outside opinion rather than the trader’s own process.' },
  { code: 'SIZE_ANXIETY', label: 'Sizing driven by anxiety', category: 'PSYCHOLOGY', description: 'Position size changed because of fear or overconfidence rather than the risk plan.' },
  { code: 'CORRELATED_OVEREXPOSURE', label: 'Correlated overexposure', category: 'RISK', description: 'Held simultaneous correlated positions (e.g. BTC + ETH) without accounting for combined risk.' },
  { code: 'REENTRY', label: 'Re-entered after stop-out', category: 'RISK', description: 'Violated the no re-entry rule after the initial stop was hit.' },
  { code: 'UNTESTED_MODEL', label: 'Traded an untested model', category: 'EXECUTION', description: 'Traded a model before its backtest sample was complete (12–15 clean samples).' },
  { code: 'OTHER', label: 'Other', category: 'EXECUTION', description: 'Any deviation not covered by the codes above — record what happened in the trade notes.' },
];

export const REAL_RESEARCH_FRAMEWORK: ResearchFramework = {
  workflow: ['OBSERVATION', 'HYPOTHESIS', 'BACKTEST', 'VALIDATION', 'LOCKED_RULE'],
  minSamples: 12,
  notes: 'A finding is not meaningful before roughly 12–15 clean samples (configurable, not a universal law). Research is a tree, not a flat list — child questions branch from findings.',
};

const REAL_DEFAULTS: Record<HQCategory, unknown> = {
  risk: REAL_RISK_RULES,
  setup_quality: REAL_SETUP_GRADES,
  execution_model: REAL_EXECUTION_MODELS,
  session: REAL_SESSIONS,
  process_score: REAL_PROCESS_CHECKS,
  mistake_code: REAL_MISTAKE_CODES,
  research_framework: REAL_RESEARCH_FRAMEWORK,
  focus_rotation: REAL_FOCUS_ROTATION,
};

/** The shipped defaults for a category — used by Trading HQ to offer items
 * (e.g. a newly added mistake code) that an existing account doesn't have yet. */
export function defaultContent<T>(category: HQCategory): T {
  return REAL_DEFAULTS[category] as T;
}

export async function loadHQConfigRows(supabase: SupabaseClient, userId: string): Promise<HQConfigRow[]> {
  const { data, error } = await supabase
    .from('trading_hq_configs')
    .select('id, category, version, content, changed_reason, updated_at')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) throw toSupabaseError(error);
  return (data ?? []) as HQConfigRow[];
}

/** Inserts any category the user doesn't have an active row for yet, using
 * only the real, already-confirmed values above. Never touches a category
 * that already has data.
 *
 * Inserted ONE ROW AT A TIME rather than as a single bulk insert: if the
 * live `trading_hq_configs_category_check` constraint doesn't actually
 * accept one of HQ_CATEGORIES' values (e.g. the DB was deployed with a
 * different category vocabulary than this code assumes — there's no
 * migration file to verify this against, only the live constraint), a
 * bulk insert fails ALL of them, including the ones that are perfectly
 * valid, and masks which value is the actual offender. Seeding every
 * category that does succeed, and naming exactly which one(s) didn't,
 * makes this fixable instead of a permanent, undiagnosable 400. */
export async function seedMissingHQCategories(supabase: SupabaseClient, userId: string, existing: HQConfigRow[]) {
  const have = new Set(existing.map(r => r.category));
  const missing = HQ_CATEGORIES.filter(c => !have.has(c));
  if (missing.length === 0) return;

  const rejected: { category: HQCategory; message: string }[] = [];
  for (const category of missing) {
    const { error } = await supabase.from('trading_hq_configs').insert({
      user_id: userId,
      category,
      slug: category.replace(/_/g, '-'),
      title: category,
      content: REAL_DEFAULTS[category],
      version: 1,
      is_active: true,
    });
    if (error) rejected.push({ category, message: toSupabaseError(error).message });
  }

  if (rejected.length > 0) {
    const detail = rejected.map((r) => `"${r.category}" (${r.message})`).join('; ');
    throw new Error(
      `Trading HQ category check constraint rejected: ${detail}. The database's ` +
        `trading_hq_configs_category_check doesn't accept one or more of this app's ` +
        `category values — the check constraint needs updating in Supabase to allow: ${HQ_CATEGORIES.join(', ')}.`
    );
  }
}

/** Deactivates the current row for a category and inserts the next version.
 * Never rewrites history — a trade taken under v1 still shows v1's content. */
export async function saveHQCategory(
  supabase: SupabaseClient,
  userId: string,
  row: HQConfigRow,
  newContent: unknown,
  changedReason: string
) {
  const { error: deactivateError } = await supabase.from('trading_hq_configs').update({ is_active: false }).eq('id', row.id);
  if (deactivateError) throw toSupabaseError(deactivateError);

  const { error: insertError } = await supabase.from('trading_hq_configs').insert({
    user_id: userId,
    category: row.category,
    slug: row.category.replace(/_/g, '-'),
    title: row.category,
    content: newContent,
    version: row.version + 1,
    is_active: true,
    changed_reason: changedReason || null,
  });
  if (insertError) throw toSupabaseError(insertError);
}

/** Normalizes rows (tolerating a legacy {description, values:string[]} shape
 * from the earlier Next.js build's seed) into the rich TradingHQConfig shape
 * this build renders. */
export function buildTradingHQConfig(rows: HQConfigRow[]): { config: TradingHQConfig; rowsByCategory: Record<HQCategory, HQConfigRow | undefined> } {
  const byCategory = {} as Record<HQCategory, HQConfigRow | undefined>;
  for (const row of rows) byCategory[row.category] = row;

  const content = <T,>(category: HQCategory, fallback: T): T => {
    const row = byCategory[category];
    if (!row) return fallback;
    const c = row.content as any;
    if (c && typeof c === 'object' && Array.isArray(c.values) && typeof c.description === 'string') {
      // Legacy {description, values:string[]} shape — best-effort passthrough.
      return c as unknown as T;
    }
    return (c ?? fallback) as T;
  };

  const maxVersion = rows.reduce((max, r) => Math.max(max, r.version), 0);
  const latestUpdate = rows.reduce((latest, r) => (r.updated_at > latest ? r.updated_at : latest), '');

  const config: TradingHQConfig = {
    version: maxVersion > 0 ? `v${maxVersion}` : 'unseeded',
    updatedAt: latestUpdate || new Date().toISOString(),
    riskRules: content<RiskRules>('risk', REAL_RISK_RULES),
    setupGrades: content<SetupGradeRule[]>('setup_quality', REAL_SETUP_GRADES),
    executionModels: content<ExecutionModel[]>('execution_model', REAL_EXECUTION_MODELS),
    sessions: content<SessionWindow[]>('session', REAL_SESSIONS),
    processChecks: content<string[]>('process_score', REAL_PROCESS_CHECKS),
    mistakeCodes: content<MistakeCode[]>('mistake_code', REAL_MISTAKE_CODES),
    researchFramework: content<ResearchFramework>('research_framework', REAL_RESEARCH_FRAMEWORK),
    focusRotation: content<FocusDay[]>('focus_rotation', REAL_FOCUS_ROTATION),
    notes: 'Trading HQ is the operational source of truth. Every category above is versioned in Supabase — editing writes a new version rather than rewriting history.',
  };

  return { config, rowsByCategory: byCategory };
}
