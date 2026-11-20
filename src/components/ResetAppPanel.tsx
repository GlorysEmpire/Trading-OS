import React, { useState } from 'react';
import { AlertTriangle, Download, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { downloadFullBackup, wipeAllData, WIPE_PHRASE } from '../lib/accountReset';

/** "Reset app": back up, then permanently delete all Trading OS data so the
 * app starts again from blank desks and default Trading HQ rules. */
export const ResetAppPanel: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const [backedUp, setBackedUp] = useState(false);
  const [skipBackup, setSkipBackup] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState<'backup' | 'wipe' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!user) return null;

  const backup = async () => {
    setBusy('backup');
    setError(null);
    try {
      const r = await downloadFullBackup(supabase, user.id);
      setBackedUp(true);
      setBackupNote(`Backup downloaded: ${r.rows} records and a list of ${r.charts} chart file(s).${r.notReadable.length ? ` Couldn't read: ${r.notReadable.length} table(s).` : ''}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup failed.');
    } finally {
      setBusy(null);
    }
  };

  const wipe = async () => {
    setBusy('wipe');
    setError(null);
    try {
      const r = await wipeAllData(supabase, user.id, phrase.trim());
      const rows = Object.values(r.deletedRows).reduce((a, b) => a + b, 0);
      setDone(`Deleted ${rows} records and ${r.chartsDeleted} chart file(s).${r.chartsLeft ? ` ${r.chartsLeft} chart file(s) could not be removed.` : ''} Reloading…`);
      setTimeout(() => window.location.reload(), 1800);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/trading_os_wipe_my_data|function|schema cache/i.test(msg)
        ? 'The reset function is not set up on the database yet, so nothing was deleted.'
        : `Nothing was reset: ${msg}`);
      setBusy(null);
    }
  };

  const ready = (backedUp || skipBackup) && phrase.trim() === WIPE_PHRASE && !busy;

  return (
    <section aria-labelledby="reset-title" className="rounded-xl border border-rose-900/70 bg-panel p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden />
          <div>
            <h3 id="reset-title" className="text-[15px] font-semibold text-ink">Reset app</h3>
            <p className="mt-0.5 max-w-2xl text-sm text-ink-2">
              Permanently deletes everything in your account: trades and their amendment log, pending setups, debriefs, weekly reviews,
              research, backtests, desks and their analysis, calendar, psychology, alerts, capital settings, Trading HQ edits and chart images.
              The app then starts again with blank desks and the default Trading HQ rules. This cannot be undone.
            </p>
          </div>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-800 px-3.5 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950/40">
            <RotateCcw className="h-4 w-4" /> Reset app…
          </button>
        )}
      </div>

      {open && !done && (
        <div className="space-y-4 rounded-lg border border-line bg-well p-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">1. Download a backup</p>
            <p className="text-xs text-ink-3">Every record in your account as one JSON file. Chart images are listed by name, not downloaded.</p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={backup} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3.5 py-2 text-sm text-ink hover:border-sky-600 disabled:opacity-50">
                <Download className="h-4 w-4" /> {busy === 'backup' ? 'Preparing…' : 'Download backup'}
              </button>
              {!backedUp && (
                <label className="flex items-center gap-2 text-xs text-ink-3">
                  <input type="checkbox" checked={skipBackup} onChange={(e) => setSkipBackup(e.target.checked)} />
                  Reset without a backup
                </label>
              )}
            </div>
            {backupNote && <p className="text-xs text-emerald-400">{backupNote}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="reset-phrase" className="block text-sm font-semibold text-ink">2. Type <span className="font-mono text-rose-300">{WIPE_PHRASE}</span> to confirm</label>
            <input id="reset-phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" spellCheck={false}
              className="w-full max-w-xs rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-rose-500" />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={wipe} disabled={!ready} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40">
              {busy === 'wipe' ? 'Deleting…' : 'Delete everything and reset'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setPhrase(''); setError(null); }} disabled={busy === 'wipe'} className="rounded-lg border border-line bg-raised px-4 py-2 text-sm text-ink-2 hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}

      {done && <p className="text-sm text-emerald-400">{done}</p>}
    </section>
  );
};
