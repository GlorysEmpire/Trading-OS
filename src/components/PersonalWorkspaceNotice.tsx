import React, { useState } from 'react';
import { useTrading, type PersonalWorkspace } from '../context/TradingContext';

const LABEL: Record<PersonalWorkspace, string> = {
  calendar: 'calendar items', psychology: 'psychology notes', alerts: 'alerts',
};

export const PersonalWorkspaceNotice: React.FC<{ workspace: PersonalWorkspace }> = ({ workspace }) => {
  const { personalWorkspaceStatus, importLocalWorkspace } = useTrading();
  const { loading, error, localCount } = personalWorkspaceStatus[workspace];
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const importItems = async () => {
    setImporting(true); setMessage(null);
    try {
      await importLocalWorkspace(workspace);
      setMessage('Browser records are now available in your account. The browser copy remains as a backup.');
    } catch { /* The account error below explains the failure. */ }
    finally { setImporting(false); }
  };

  return (
    <div className="space-y-2" aria-live="polite">
      {loading && <p className="text-sm text-ink-3">Loading your {LABEL[workspace]}…</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">{error}</p>}
      {localCount > 0 && !loading && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-800/60 bg-amber-950/15 px-4 py-3">
        <p className="text-sm text-ink-2">{localCount} {LABEL[workspace]} saved in this browser. Import them to see them on your other devices.</p>
        <button onClick={importItems} disabled={importing} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50">{importing ? 'Importing…' : 'Import browser records'}</button>
      </div>}
      {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
    </div>
  );
};
