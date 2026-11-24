import React, { useState, type FormEvent } from 'react';
import { Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error } = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    if (mode === 'signup') {
      setNotice('Account created. If email confirmation is on, check your inbox, then sign in.');
      setMode('signin');
    }
  };

  return (
    <main className="min-h-screen bg-canvas text-ink flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <form onSubmit={submit} className="tos-card w-full max-w-md space-y-5 p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <span className="tos-cta grid h-10 w-10 place-items-center rounded-lg"><Activity className="h-5 w-5" /></span>
          <span className="text-sm font-semibold tracking-tight text-ink">Trading OS</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{mode === 'signin' ? 'Welcome back' : 'Create your workspace'}</h1>
          <p className="mt-1 text-sm text-ink-3">Your markets, process, and progress in one place.</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-2">Email</span>
          <input
            className="w-full bg-raised border border-line rounded-lg px-3 py-2.5 text-ink text-sm outline-none focus:border-cyan-500"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-ink-2">Password</span>
          <input
            className="w-full bg-raised border border-line rounded-lg px-3 py-2.5 text-ink text-sm outline-none focus:border-cyan-500"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>

        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}

        <button
          className="tos-cta w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50"
          type="submit"
          disabled={loading}
        >
          {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          className="text-sm text-ink-3 hover:text-cyan-400 block transition"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setNotice(null);
          }}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </main>
  );
};
