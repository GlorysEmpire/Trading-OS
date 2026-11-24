import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  createStructuralRecord, insertPeriodPlan, insertReview, loadPeriodPlans, loadStructuralRecords, saveStructuralUpdate,
} from '../lib/decompositionStore';
import { FEED_PRESETS, type FeedProfile, type LayerData, type PeriodPlan, type PeriodReview, type StructuralRecord } from '../decomposition';
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
  saveReview: (plan: PeriodPlan, review: PeriodReview) => Promise<PeriodPlan>;
  /** The chart feed used for a desk's candles (remembered per desk in this browser). */
  profileFor: (deskId: string, category?: AssetCategory) => FeedProfile;
  setProfile: (deskId: string, profile: FeedProfile) => void;
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

  const savePlan = useCallback(async (plan: PeriodPlan) => {
    const saved = await insertPeriodPlan(supabase, userId, plan);
    setPlans((all) => [saved, ...all]);
    return saved;
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

  const value = useMemo(() => ({ structural, plans, loading, notice, reload, mapFor, saveStructure, savePlan, saveReview, profileFor, setProfile }),
    [structural, plans, loading, notice, reload, mapFor, saveStructure, savePlan, saveReview, profileFor, setProfile]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useDecompositionData(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDecompositionData must be used inside DecompositionDataProvider');
  return v;
}
