import { useRef, useState } from 'react';

/** The caller keys the mounted editor by record identity. Published records use their normal store. */
export function useLocalDraft<T>(key: string, initial: () => T) {
  const [draft, setDraft] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored) as T;
    } catch { /* An unavailable draft must not block creating a new one. */ }
    return initial();
  });
  const current = useRef(draft);
  const [localError, setLocalError] = useState(false);

  const update = (change: (previous: T) => T) => {
    const next = change(current.current);
    current.current = next;
    setDraft(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setLocalError(false); }
    catch { setLocalError(true); }
  };
  const clear = () => {
    try { localStorage.removeItem(key); }
    catch { setLocalError(true); }
  };
  return { draft, update, clear, localError };
}
