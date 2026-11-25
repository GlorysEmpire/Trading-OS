import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  attachCandlestickRead, createStructuralRecord, insertPeriodPlan, insertReview, loadPeriodPlans, loadStructuralRecords, recordBacktestOutcome, saveStructuralUpdate,
} from '../lib/decompositionStore';
import { FEED_PRESETS, closeBacktest, type BacktestOutcome, type Cadence, type FeedProfile, type LayerData, type PeriodPlan, type PeriodReview, type StructuralRecord } from '../decomposition';
import type { AssetCategory } from '../types';

/**
 * M3: structural records and period plans for the signed-in user, shared by
 * the Market Decomposition screens (and later the desk and Today). Uses only
 * the M2 store and the M0 contract.
 */
interface Value {
  structural: StructuralRecord[];
  plans: PeriodPlan[];
  loading: boolean;
  /** Plain-language notice when the data can't be loaded (e.g. database update not applied). */
  notice?: string;
  reload: () => Promise<void>;
  /** The LIVE structural map of a desk, if any. */
  mapFor: (deskId: string) => StructuralRecord | undefined;
  saveStructure: (input: { deskId: string; symbol: string; layers: Array<{ asOf: string; data: LayerData }>; definitionsVersion: string }) => Promise<StructuralRecord>;
  savePlan: (plan: PeriodPlan) => Promise<PeriodPlan>;
  saveCandlestick: (plan: PeriodPlan, read: NonNullable<PeriodPlan['read']['candlestickDecomposition']>) => Promise<void>;
  saveReview: (plan: PeriodPlan, review: PeriodReview) => Promise<PeriodPlan>;
  /** The chart feed used for a desk's candles (remembered per desk in this browser). */
  profileFor: (deskId: string, category?: AssetCategory) => FeedProfile;
  setProfile: (deskId: string, profile: FeedProfile) => void;
  /** BACKTEST records (newest first). */
  backtests: StructuralRecord[];
  /** Starts a new replay read: a new BACKTEST record whose saved layers are locked predictions. */
  saveBacktest: (input: { deskId: string; symbol: string; researchQuestionId?: string; layers: Array<{ asOf: string; data: LayerData }>; definitionsVersion: string }) => Promise<StructuralRecord>;
  /** Records the outcome once (checked here and by the database). */
  closeBacktestRecord: (rec: StructuralRecord, outcome: Omit<BacktestOutcome, 'recordedAt' | 'predictionLayerId'>) => Promise<StructuralRecord>;
  /** Asset Desk "Decompose" button: the desk to open next time the Decompose page shows. */
  pendingDeskId?: string;
  pendingCadence?: Cadence;
  requestDecompose: (deskId: string | undefined, cadence?: Cadence) => void;
  /** Today → Review: the plan to open straight into its review. */
  pendingReviewId?: string;
  requestReview: (planId: string | undefined) => void;
  pendingPlanId?: string;
  requestPlanView: (planId: string | undefined) => void;
}

const Ctx = createContext<Value | null>(null);
const PROFILE_KEY = 'trading_os_feed_profiles_v1';

function readProfiles(): Record<string, FeedProfile> {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}'); } catch { return {}; }
}

export const DecompositionDataProvider: React.FC<{ userId: string; children: React.ReactNode }> = ({ userId, children }) => {
  const [structural, setStructural] = useState<StructuralRecord[]>([]);
  const [plans, setPlans] = useState<PeriodPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [profiles, setProfiles] = useState<Record<string, FeedProfile>>(readProfiles);
  const [pendingDecomposition, setPendingDecomposition] = useState<{ deskId: string; cadence?: Cadence }>();
  const requestDecompose = useCallback((deskId: string | undefined, cadence?: Cadence) => {
    setPendingDecomposition(deskId ? { deskId, cadence } : undefined);
  }, []);
  const [pendingReviewId, requestReview] = useState<string>();
  const [pendingPlanId, requestPlanView] = useState<string>();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, ps] = await Promise.all([loadStructuralRecords(supabase, userId), loadPeriodPlans(supabase, userId)]);
      setStructural(recs);
      setPlans(ps);
      setNotice(undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setNotice(/one-time database update|does not exist|schema cache/i.test(msg)
        ? 'Market decomposition needs its one-time database update before anything can be saved.'
        : `Decomposition records could not be loaded. ${msg}`.trim());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  const mapFor = useCallback((deskId: string) => structural.find((r) => r.deskId === deskId && r.mode === 'LIVE'), [structural]);

  const saveStructure: Value['saveStructure'] = useCallback(async ({ deskId, symbol, layers, definitionsVersion }) => {
    let rec = mapFor(deskId);
    if (!rec) rec = await createStructuralRecord(supabase, userId, { deskId, symbol, mode: 'LIVE' });
    const saved = await saveStructuralUpdate(supabase, userId, rec, layers, definitionsVersion);
    setStructural((all) => [...all.filter((r) => r.id !== saved.id), saved]);
    return saved;
  }, [mapFor, userId]);

  const backtests = useMemo(() => structural.filter((r) => r.mode === 'BACKTEST').sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [structural]);

  const saveBacktest: Value['saveBacktest'] = useCallback(async ({ deskId, symbol, researchQuestionId, layers, definitionsVersion }) => {
    const rec = await createStructuralRecord(supabase, userId, { deskId, symbol, mode: 'BACKTEST', researchQuestionId });
    const saved = await saveStructuralUpdate(supabase, userId, rec, layers, definitionsVersion);
    setStructural((all) => [...all.filter((r) => r.id !== saved.id), saved]);
    return saved;
  }, [userId]);

  const closeBacktestRecord: Value['closeBacktestRecord'] = useCallback(async (rec, outcome) => {
    const checked = closeBacktest(rec, { ...outcome, recordedAt: new Date().toISOString() }); // contract rules first
    const stored = await recordBacktestOutcome(supabase, rec.id, { ...outcome, predictionLayerId: checked.outcome!.predictionLayerId });
    const saved = { ...rec, outcome: stored };
    setStructural((all) => all.map((r) => (r.id === saved.id ? saved : r)));
    return saved;
  }, []);

  const savePlan = useCallback(async (plan: PeriodPlan) => {
    const saved = await insertPeriodPlan(supabase, userId, plan);
    setPlans((all) => [saved, ...all]);
    return saved;
  }, [userId]);

  const saveCandlestick: Value['saveCandlestick'] = useCallback(async (plan, candleRead) => {
    const read = await attachCandlestickRead(supabase, userId, plan, candleRead);
    setPlans((all) => all.map((current) => current.id === plan.id ? { ...current, read } : current));
  }, [userId]);

  const saveReview = useCallback(async (plan: PeriodPlan, review: PeriodReview) => {
    const saved = await insertReview(supabase, userId, plan, review);
    setPlans((all) => all.map((p) => (p.id === saved.id ? saved : p)));
    return saved;
  }, [userId]);

  const profileFor = useCallback((deskId: string, category?: AssetCategory): FeedProfile => {
    if (profiles[deskId]) return profiles[deskId];
    const preset = category === 'CRYPTO' ? FEED_PRESETS[0] : FEED_PRESETS[1];
    return { feed: preset.feed, zone: preset.zone, time: preset.time };
  }, [profiles]);

  const setProfile = useCallback((deskId: string, profile: FeedProfile) => {
    setProfiles((all) => {
      const next = { ...all, [deskId]: profile };
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); } catch { /* preference only */ }
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    structural, plans, loading, notice, reload, mapFor, saveStructure, savePlan, saveCandlestick, saveReview, profileFor, setProfile,
    pendingDeskId: pendingDecomposition?.deskId, pendingCadence: pendingDecomposition?.cadence, requestDecompose,
    pendingReviewId, requestReview, pendingPlanId, requestPlanView, backtests, saveBacktest, closeBacktestRecord,
  }), [structural, plans, loading, notice, reload, mapFor, saveStructure, savePlan, saveCandlestick, saveReview, profileFor, setProfile,
    pendingDecomposition, requestDecompose, pendingReviewId, pendingPlanId, backtests, saveBacktest, closeBacktestRecord]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useDecompositionData(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDecompositionData must be used inside DecompositionDataProvider');
  return v;
}
