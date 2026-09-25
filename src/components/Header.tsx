import React, { useState, useEffect } from 'react';
import { useTrading, NavSection } from '../context/TradingContext';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  Clock,
  PlusCircle,
  Download,
  Upload,
  LogOut,
  Sparkles,
  TrendingUp,
  BookOpen,
  Calendar,
  AlertTriangle,
  Brain,
  Search,
  Activity,
  Radar,
  Sliders,
  CheckCircle2,
  Sun,
  Moon,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    theme,
    setTheme,
    activeTab,
    setActiveTab,
    tradingHQ,
    performanceStats,
    exportDataJSON,
    importDataJSON,
    setQuickTradeModalOpen,
  } = useTrading();
  const { user, signOut } = useAuth();

  const [nyTime, setNyTime] = useState('');
  const [lagosTime, setLagosTime] = useState('');

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setNyTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setLagosTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Africa/Lagos',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDataJSON(content);
        if (success) {
          alert('Trading OS state successfully restored.');
        } else {
          alert('Failed to parse Trading OS backup JSON.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const navItems: Array<{ id: NavSection; label: string; icon: any; category: string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity, category: 'COMMAND' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, category: 'COMMAND' },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, category: 'COMMAND' },
    { id: 'trading-hq', label: 'Trading HQ', icon: Sliders, category: 'TRADING' },
    { id: 'asset-desks', label: 'Asset Desks', icon: TrendingUp, category: 'TRADING' },
    { id: 'journal', label: 'Journal', icon: BookOpen, category: 'TRADING' },
    { id: 'backtesting', label: 'Backtesting', icon: Search, category: 'RESEARCH' },
    { id: 'research', label: 'Research Engine', icon: Radar, category: 'RESEARCH' },
    { id: 'psychology', label: 'Psychology', icon: Brain, category: 'RESEARCH' },
    { id: 'market-intelligence', label: 'Market Intel', icon: Activity, category: 'INTELLIGENCE' },
    { id: 'scanner', label: 'Scanner', icon: Radar, category: 'INTELLIGENCE' },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles, category: 'AI' },
  ];

  return (
    <header className="bg-[#0c1017] border-b border-[#1f2937] sticky top-0 z-40">
      {/* Top Utility & Operational Awareness Strip */}
      <div className="px-4 py-2 border-b border-[#1b2332] flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
        {/* Brand & Strategic Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono font-bold tracking-wider text-slate-100 uppercase">
            <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-sm animate-pulse" />
            TRADING OS
          </div>
          <span className="text-slate-600">|</span>
          <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300 font-mono text-[11px]">
            {tradingHQ.version}
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-300">
            <span className="text-slate-500">RISK:</span>
            <span className="text-emerald-400 font-semibold">{tradingHQ.riskRules.riskPerSetupPct}% / setup</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-500">DAILY LIMIT:</span>
            <span className={`font-semibold ${performanceStats.lossCountToday >= tradingHQ.riskRules.maxDailyLosses ? 'text-rose-400' : 'text-slate-300'}`}>
              {performanceStats.lossCountToday} / {tradingHQ.riskRules.maxDailyLosses} Losses
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400/90">NO RE-ENTRY</span>
          </div>
        </div>

        {/* Global Operational Clocks & Quick Action */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 font-mono text-[11px] bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span className="text-slate-400">NY:</span>
              <span className="text-cyan-300 font-medium">{nyTime || '--:--:--'}</span>
            </div>
            <span className="text-slate-700">/</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">LAGOS:</span>
              <span className="text-emerald-300 font-medium">{lagosTime || '--:--:--'}</span>
            </div>
          </div>

          <button
            id="btn-log-trade"
            onClick={() => setQuickTradeModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold px-3 py-1.5 rounded transition cursor-pointer shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>LOG TRADE</span>
          </button>

          {/* Theme Switcher */}
          <button
            onClick={() => setTheme(theme === 'ash' ? 'dark' : 'ash')}
            title={theme === 'ash' ? 'Switch to Dark Mode' : 'Switch to Eye-Friendly Ash Light Mode'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono transition border border-slate-300 dark:border-slate-700"
          >
            {theme === 'ash' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-semibold">Ash Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] font-semibold">Dark Mode</span>
              </>
            )}
          </button>

          {/* Backup / Export / Reset */}
          <div className="flex items-center gap-1">
            <button
              onClick={exportDataJSON}
              title="Export Full Trading OS Backup (JSON)"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <label
              title="Import Trading OS Backup (JSON)"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
            <button
              onClick={signOut}
              title={user?.email ? `Sign out (${user.email})` : 'Sign out'}
              className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Primary Navigation Bar */}
      <nav className="px-4 flex items-center overflow-x-auto scrollbar-none gap-1 py-1 text-xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md whitespace-nowrap transition-colors font-medium ${
                isActive
                  ? 'bg-[#182335] text-cyan-300 border border-cyan-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span>{item.label}</span>
              {item.id === 'alerts' && (
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
