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
    <main className="min-h-screen bg-[#080c14] text-slate-100 flex items-center justify-center p-6">
      <form onSubmit={submit} className="bg-[#101722] border border-slate-800 rounded-lg p-8 w-full max-w-sm space-y-5">
        <div className="flex items-center gap-2 text-cyan-400">
          <Activity className="w-5 h-5" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider">Trading OS</span>
        </div>
        <h1 className="text-2xl font-mono font-bold text-slate-100">{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Email</span>
          <input
            className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-200 text-sm outline-none focus:border-cyan-500"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Password</span>
          <input
            className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-200 text-sm outline-none focus:border-cyan-500"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="text-xs font-mono text-rose-400">{error}</p>}
        {notice && <p className="text-xs font-mono text-emerald-400">{notice}</p>}

        <button
          className="w-full px-4 py-2.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-wider transition"
          type="submit"
          disabled={loading}
        >
          {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          className="text-xs font-mono text-slate-400 hover:text-cyan-300 block transition"
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
