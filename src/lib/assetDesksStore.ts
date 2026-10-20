import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivePOI, AssetChartScreenshot, AssetCategory, AssetDeskData, LiquidityZone, Scenario } from '../types';

/** The 5 primary assets/platforms from the context handoff. Configurable in
 * principle — this is just the starting seed, not a hardcoded universe. */
const REAL_ASSETS: { symbol: string; name: string; category: AssetCategory; tradingViewSymbol: string }[] = [
  { symbol: 'BTC', name: 'Bitcoin / USD', category: 'CRYPTO', tradingViewSymbol: 'BINANCE:BTCUSDT' },
  { symbol: 'ETH', name: 'Ethereum / USD', category: 'CRYPTO', tradingViewSymbol: 'BINANCE:ETHUSDT' },
  { symbol: 'NQ', name: 'Nasdaq 100 E-mini', category: 'INDICES', tradingViewSymbol: 'CME_MINI:NQ1!' },
  { symbol: 'XAU', name: 'Gold / USD', category: 'METALS', tradingViewSymbol: 'OANDA:XAUUSD' },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'FX', tradingViewSymbol: 'FX:EURUSD' },
];

const CATEGORY_BY_SYMBOL: Record<string, AssetCategory> = Object.fromEntries(REAL_ASSETS.map(a => [a.symbol, a.category]));
const TV_SYMBOL_BY_SYMBOL: Record<string, string> = Object.fromEntries(REAL_ASSETS.map(a => [a.symbol, a.tradingViewSymbol]));

/**
 * IMPORTANT — schema reality check (2026-10-20):
 * The deployed `asset_desks` table does NOT have `liquidity_zones`,
 * `active_pois`, `scenario_list`, `wyckoff_events`, or `tradingview_symbol`
 * columns (confirmed directly against the live PostgREST schema — selecting
 * any of them returns Postgres error 42703 "column does not exist"). This is
 * what was causing "Failed to load Asset Desks" for every user.
 *
 * We only have the client-side anon key here, not admin/service-role DB
 * access, so we can't run an ALTER TABLE migration. Instead, same pattern as
 * the other repurposed fields below: the legacy `pois` / `scenarios` text
 * columns (previously unused) now carry their real structured JSON, and the
 * previously-unused `notes` text column carries a small JSON bundle for the
 * remaining fields that have no column of their own at all (liquidity zones,
 * identified Wyckoff events, and desk chart/screenshot attachments).
 * `tradingViewSymbol` isn't persisted at all — it's never user-edited (only
 * used as an outbound TradingView link), so it's derived from the symbol via
 * the REAL_ASSETS map every time instead of needing a column.
 */

type DeskRow = {
  id: string;
  symbol: string;
  name: string;
  bias: string | null;
  htf_structure: string | null;
  narrative: string | null;
  liquidity: string | null; // repurposed: JSON-encoded quickLevels
  pois: string | null; // repurposed: JSON-encoded ActivePOI[]
  wyckoff_development: string | null; // JSON-encoded {phase, notes}
  external_context: string | null; // JSON-encoded ExternalContext
  scenarios: string | null; // repurposed: JSON-encoded Scenario[]
  research_notes: string | null;
  notes: string | null; // repurposed: JSON-encoded {liquidityZones, wyckoffEvents, charts}
};

const DESK_COLUMNS =
  'id, symbol, name, bias, htf_structure, narrative, liquidity, pois, wyckoff_development, external_context, scenarios, research_notes, notes';

type NotesBundle = {
  liquidityZones?: LiquidityZone[];
  wyckoffEvents?: string[];
  charts?: AssetChartScreenshot[];
};

function safeParse<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function rowToDesk(row: DeskRow): AssetDeskData {
  const { phase, notes } = safeParse(row.wyckoff_development, { phase: '', notes: 'AR (Automatic Reaction) is an analytical event only — never an entry trigger.' });
  const externalContext = safeParse(row.external_context, { updatedAt: '' } as AssetDeskData['externalContext']);
  const quickLevels = safeParse(row.liquidity, { high24h: '', low24h: '', keySustainedLevel: '' });
  const activePOIs = safeParse<ActivePOI[]>(row.pois, []);
  const scenarios = safeParse<Scenario[]>(row.scenarios, []);
  const notesBundle = safeParse<NotesBundle>(row.notes, {});

  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    category: CATEGORY_BY_SYMBOL[row.symbol] ?? 'CRYPTO',
    currentBias: (row.bias as AssetDeskData['currentBias']) || 'NEUTRAL',
    tradingViewSymbol: TV_SYMBOL_BY_SYMBOL[row.symbol] ?? '',
    htfStructure: safeParse(row.htf_structure, { monthly: '', weekly: '', daily: '', h4: '' }),
    currentNarrative: row.narrative || '',
    liquidityZones: notesBundle.liquidityZones ?? [],
    activePOIs,
    wyckoffDevelopment: { phase, notes, eventsIdentified: notesBundle.wyckoffEvents ?? [] },
    externalContext,
    scenarios,
    researchNotes: row.research_notes || '',
    quickLevels,
    charts: notesBundle.charts ?? [],
  };
}

export async function loadAssetDesks(supabase: SupabaseClient, userId: string): Promise<AssetDeskData[]> {
  const { data, error } = await supabase
    .from('asset_desks')
    .select(DESK_COLUMNS)
    .eq('user_id', userId)
    .order('symbol');
  if (error) throw error;
  return (data ?? []).map(row => rowToDesk(row as DeskRow));
}

/** Inserts the 5 real desks, starting genuinely blank — no fabricated
 * narrative, prices, or "charts". Only runs when the user has none yet. */
export async function seedAssetDesksIfMissing(supabase: SupabaseClient, userId: string) {
  const { count, error: countError } = await supabase.from('asset_desks').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (countError) throw countError;
  if (count && count > 0) return;

  const rows = REAL_ASSETS.map(a => ({
    user_id: userId,
    symbol: a.symbol,
    name: a.name,
    bias: 'NEUTRAL',
  }));
  const { error } = await supabase.from('asset_desks').upsert(rows, { onConflict: 'user_id,symbol', ignoreDuplicates: true });
  if (error) throw error;
}

/** Translates a partial AssetDeskData patch into the underlying columns and
 * writes it. Structured fields that have their own real column map straight
 * onto it; liquidityZones/wyckoffEvents/charts share the repurposed `notes`
 * JSON bundle, so writing any of those three read-merge-writes that bundle
 * (fetching the current value first) instead of overwriting the whole thing. */
export async function saveAssetDeskPatch(supabase: SupabaseClient, deskId: string, patch: Partial<AssetDeskData>) {
  const update: Record<string, unknown> = {};
  if (patch.currentBias !== undefined) update.bias = patch.currentBias;
  if (patch.currentNarrative !== undefined) update.narrative = patch.currentNarrative;
  if (patch.researchNotes !== undefined) update.research_notes = patch.researchNotes;
  if (patch.htfStructure !== undefined) update.htf_structure = JSON.stringify(patch.htfStructure);
  if (patch.externalContext !== undefined) update.external_context = JSON.stringify(patch.externalContext);
  if (patch.quickLevels !== undefined) update.liquidity = JSON.stringify(patch.quickLevels);
  if (patch.activePOIs !== undefined) update.pois = JSON.stringify(patch.activePOIs);
  if (patch.scenarios !== undefined) update.scenarios = JSON.stringify(patch.scenarios);
  if (patch.wyckoffDevelopment !== undefined) {
    update.wyckoff_development = JSON.stringify({ phase: patch.wyckoffDevelopment.phase, notes: patch.wyckoffDevelopment.notes });
  }

  const touchesNotesBundle =
    patch.liquidityZones !== undefined || patch.charts !== undefined || patch.wyckoffDevelopment?.eventsIdentified !== undefined;

  if (touchesNotesBundle) {
    const { data: existingRow, error: fetchErr } = await supabase.from('asset_desks').select('notes').eq('id', deskId).single();
    if (fetchErr) throw fetchErr;
    const current = safeParse<NotesBundle>((existingRow as { notes: string | null } | null)?.notes ?? null, {});
    const merged: NotesBundle = {
      liquidityZones: patch.liquidityZones !== undefined ? patch.liquidityZones : current.liquidityZones ?? [],
      wyckoffEvents: patch.wyckoffDevelopment?.eventsIdentified !== undefined ? patch.wyckoffDevelopment.eventsIdentified : current.wyckoffEvents ?? [],
      charts: patch.charts !== undefined ? patch.charts : current.charts ?? [],
    };
    update.notes = JSON.stringify(merged);
  }

  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from('asset_desks').update(update).eq('id', deskId);
  if (error) throw error;
}
