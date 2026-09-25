import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivePOI, AssetCategory, AssetDeskData, LiquidityZone, Scenario } from '../types';

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

type DeskRow = {
  id: string;
  symbol: string;
  name: string;
  bias: string | null;
  htf_structure: string | null;
  narrative: string | null;
  liquidity: string | null; // repurposed: JSON-encoded quickLevels
  pois: string | null; // unused (structured active_pois jsonb replaces it)
  wyckoff_development: string | null; // JSON-encoded {phase, notes}
  external_context: string | null; // JSON-encoded ExternalContext
  scenarios: string | null; // unused (structured scenario_list jsonb replaces it)
  research_notes: string | null;
  notes: string | null;
  liquidity_zones: LiquidityZone[] | null;
  active_pois: ActivePOI[] | null;
  scenario_list: Scenario[] | null;
  wyckoff_events: string[] | null;
  tradingview_symbol: string | null;
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

  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    category: CATEGORY_BY_SYMBOL[row.symbol] ?? 'CRYPTO',
    currentBias: (row.bias as AssetDeskData['currentBias']) || 'NEUTRAL',
    tradingViewSymbol: row.tradingview_symbol || '',
    htfStructure: safeParse(row.htf_structure, { monthly: '', weekly: '', daily: '', h4: '' }),
    currentNarrative: row.narrative || '',
    liquidityZones: row.liquidity_zones ?? [],
    activePOIs: row.active_pois ?? [],
    wyckoffDevelopment: { phase, notes, eventsIdentified: row.wyckoff_events ?? [] },
    externalContext,
    scenarios: row.scenario_list ?? [],
    researchNotes: row.research_notes || '',
    quickLevels,
    charts: [], // not persisted — chart upload isn't wired to storage yet
  };
}

export async function loadAssetDesks(supabase: SupabaseClient, userId: string): Promise<AssetDeskData[]> {
  const { data, error } = await supabase
    .from('asset_desks')
    .select(
      'id, symbol, name, bias, htf_structure, narrative, liquidity, pois, wyckoff_development, external_context, scenarios, research_notes, notes, liquidity_zones, active_pois, scenario_list, wyckoff_events, tradingview_symbol'
    )
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
    tradingview_symbol: a.tradingViewSymbol,
    bias: 'NEUTRAL',
  }));
  const { error } = await supabase.from('asset_desks').upsert(rows, { onConflict: 'user_id,symbol', ignoreDuplicates: true });
  if (error) throw error;
}

/** Translates a partial AssetDeskData patch into the underlying columns and
 * writes it. Structured fields (liquidityZones/activePOIs/scenarios) map
 * straight onto their jsonb columns; nested free-form objects are stored as
 * JSON text in a repurposed legacy text column (documented per-field above). */
export async function saveAssetDeskPatch(supabase: SupabaseClient, deskId: string, patch: Partial<AssetDeskData>) {
  const update: Record<string, unknown> = {};
  if (patch.currentBias !== undefined) update.bias = patch.currentBias;
  if (patch.currentNarrative !== undefined) update.narrative = patch.currentNarrative;
  if (patch.researchNotes !== undefined) update.research_notes = patch.researchNotes;
  if (patch.tradingViewSymbol !== undefined) update.tradingview_symbol = patch.tradingViewSymbol;
  if (patch.htfStructure !== undefined) update.htf_structure = JSON.stringify(patch.htfStructure);
  if (patch.externalContext !== undefined) update.external_context = JSON.stringify(patch.externalContext);
  if (patch.quickLevels !== undefined) update.liquidity = JSON.stringify(patch.quickLevels);
  if (patch.wyckoffDevelopment !== undefined) {
    update.wyckoff_development = JSON.stringify({ phase: patch.wyckoffDevelopment.phase, notes: patch.wyckoffDevelopment.notes });
    update.wyckoff_events = patch.wyckoffDevelopment.eventsIdentified;
  }
  if (patch.liquidityZones !== undefined) update.liquidity_zones = patch.liquidityZones;
  if (patch.activePOIs !== undefined) update.active_pois = patch.activePOIs;
  if (patch.scenarios !== undefined) update.scenario_list = patch.scenarios;

  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from('asset_desks').update(update).eq('id', deskId);
  if (error) throw error;
}
