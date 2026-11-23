import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  DefinitionsNotReadyError, loadDefinitionsHistory, saveDefinitions, seedDefinitions, type DefinitionsRow,
} from '../lib/decompositionDefinitionsStore';
import { PLACEHOLDER_DEFINITIONS, definitionsResolver, type DecompositionDefinitions } from '../decomposition';

/**
 * M1: the active decomposition definitions and their history, for Trading HQ
 * (editor) and later the decomposition screens. Independent of the main
 * trading context. Falls back to the placeholder if loading fails, so nothing
 * else in the app is blocked by it.
 */
interface Value {
  /** Definitions to use for new reads. */
  current: DecompositionDefinitions;
  /** The active HQ row (undefined until saved in the database). */
  currentRow?: DefinitionsRow;
  history: DefinitionsRow[];
  loading: boolean;
  /** Plain-language problem, if the definitions couldn't be loaded or saved. */
  notice?: string;
  definitionsFor: (version: string) => DecompositionDefinitions | undefined;
  save: (edited: DecompositionDefinitions, reason: string) => Promise<void>;
}

const Ctx = createContext<Value | null>(null);

export const DecompositionDefinitionsProvider: React.FC<{ userId: string; children: React.ReactNode }> = ({ userId, children }) => {
  const [history, setHistory] = useState<DefinitionsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let rows = await loadDefinitionsHistory(supabase, userId);
      if (!rows.length) {
        await seedDefinitions(supabase, userId);
        rows = await loadDefinitionsHistory(supabase, userId);
      }
      setHistory(rows);
      setNotice(undefined);
    } catch (e) {
      setNotice(e instanceof DefinitionsNotReadyError ? e.message : `Decomposition definitions could not be loaded, so the placeholders are in use. ${e instanceof Error ? e.message : ''}`.trim());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const currentRow = history.find((r) => r.isActive);
  const current = currentRow?.definitions ?? PLACEHOLDER_DEFINITIONS;
  const definitionsFor = useMemo(() => definitionsResolver(history.map((r) => r.definitions)), [history]);

  const save = useCallback(async (edited: DecompositionDefinitions, reason: string) => {
    if (!currentRow) throw new Error(notice ?? 'Definitions are still loading.');
    await saveDefinitions(supabase, currentRow, edited, reason);
    await load();
  }, [currentRow, load, notice]);

  return (
    <Ctx.Provider value={{ current, currentRow, history, loading, notice, definitionsFor, save }}>
      {children}
    </Ctx.Provider>
  );
};

export function useDecompositionDefinitions(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDecompositionDefinitions must be used inside DecompositionDefinitionsProvider');
  return v;
}
