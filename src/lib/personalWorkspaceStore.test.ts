import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { importWorkspaceRecords, readLocalWorkspace, saveWorkspaceRecord } from './personalWorkspaceStore';

afterEach(() => vi.unstubAllGlobals());

describe('personal workspace migration', () => {
  it('reads only records saved for the requested workspace and keeps malformed browser data out', () => {
    const getItem = vi.fn(() => JSON.stringify([
      { id: 'cal-one', title: 'Research', date: '2026-11-10', time: '18:00' },
      { id: 'al-one', title: 'Other workspace', date: '2026-11-10', time: '18:00' },
      { id: 'cal-broken', title: 'Missing date' },
    ]));
    vi.stubGlobal('localStorage', { getItem });
    expect(readLocalWorkspace('personal-calendar', 'calendar')).toHaveLength(1);
    expect(getItem).toHaveBeenCalledWith('personal-calendar');
  });

  it('imports existing browser records without overwriting account records', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));
    const client = { from } as unknown as SupabaseClient;
    const item = { id: 'cal-one', title: 'Research', type: 'RESEARCH' as const, date: '2026-11-10', time: '18:00' };
    await expect(importWorkspaceRecords(client, 'owner-id', 'calendar', [item])).resolves.toBe(1);
    expect(from).toHaveBeenCalledWith('trading_os_calendar_events');
    expect(upsert).toHaveBeenCalledWith(
      [{ user_id: 'owner-id', id: 'cal-one', payload: item }],
      { onConflict: 'user_id,id', ignoreDuplicates: true },
    );
  });

  it('surfaces a failed account write so the UI does not claim a record was saved', async () => {
    const client = { from: () => ({ upsert: () => Promise.resolve({ error: { message: 'write rejected' } }) }) } as unknown as SupabaseClient;
    const item = { id: 'al-one', title: 'Level', type: 'LIQUIDITY' as const, conditionText: 'At level', triggered: false, active: true };
    await expect(saveWorkspaceRecord(client, 'owner-id', 'alerts', item)).rejects.toThrow('write rejected');
  });
});
