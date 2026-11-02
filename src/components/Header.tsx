import React, { useState, useEffect } from 'react';
import { useTrading, NavSection } from '../context/TradingContext';
import { useAuth } from '../context/AuthContext';
import {
  Download,
  Upload,
  LogOut,
  Sparkles,
  TrendingUp,
  BookOpen,
  ClipboardCheck,
  CalendarRange,
  Calendar,
  Bell,
  Brain,
  FlaskConical,
  LayoutDashboard,
  Globe,
  Radar,
  Sliders,
  Sun,
  Moon,
  HelpCircle,
  History,
} from 'lucide-react';
import { GlossaryDrawer } from './GlossaryDrawer';
import { getActiveSession, deviceTimeZone } from '../utils/traderTime';

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
  } = useTrading();
  const { user, signOut } = useAuth();

  const [nyTime, setNyTime] = useState('');
  const [lagosTime, setLagosTime] = useState('');
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const localTz = deviceTimeZone();
  const localLabel = localTz.split('/').pop()?.replace(/_/g, ' ') ?? 'Local';

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setNyTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
      setLagosTime(
        now.toLocaleTimeString('en-US', {
          timeZone: localTz,
          hour: '2-digit',
          minute: '2-digit',
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
        importDataJSON(content).then((success) => {
          if (success) {
            alert('Trading OS state successfully restored.');
          } else {
            alert('Failed to parse or save Trading OS backup JSON. Your current data has not been changed.');
          }
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Ordered by how often each screen is used, in groups: the daily trading
  // loop, then weekly/planning, then setup screens that change rarely, then
  // the intelligence screens (no data source connected yet).
  const navGroups: Array<Array<{ id: NavSection; label: string; icon: any; hint: string }>> = [
    [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: "Today at a glance: risk status, today's focus, pending setups and performance" },
      { id: 'asset-desks', label: 'Asset Desks', icon: TrendingUp, hint: 'One workspace per market: your analysis, charts, scenarios and pending setups' },
      { id: 'journal', label: 'Journal', icon: BookOpen, hint: 'Every trade you took, with its result and how well the plan was followed' },
      { id: 'debrief', label: 'Debrief', icon: ClipboardCheck, hint: 'End-of-day review: what happened today and one improvement for tomorrow' },
      { id: 'backtesting', label: 'Backtesting', icon: History, hint: 'Test ideas on past charts and record each example' },
      { id: 'research', label: 'Research', icon: FlaskConical, hint: "This month's research question and how many examples back it up" },
    ],
    [
      { id: 'weekly-review', label: 'Weekly Review', icon: CalendarRange, hint: 'Saturday review of the week, plus next week\'s watchlist' },
      { id: 'calendar', label: 'Calendar', icon: Calendar, hint: 'News events, sessions and your trading schedule' },
      { id: 'psychology', label: 'Psychology', icon: Brain, hint: 'Notes on your mindset and decisions' },
    ],
    [
      { id: 'trading-hq', label: 'Trading HQ', icon: Sliders, hint: 'Your rules: risk, grades, sessions, mistake codes, focus rotation' },
      { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles, hint: 'Ask questions about your system and journal' },
      { id: 'alerts', label: 'Alerts', icon: Bell, hint: 'Price and rule alerts' },
    ],
    [
      { id: 'market-intelligence', label: 'Market Intel', icon: Globe, hint: 'Market data (no data source connected yet)' },
      { id: 'scanner', label: 'Scanner', icon: Radar, hint: 'Automated setup scanning (not connected yet)' },
    ],
  ];

  const session = getActiveSession(tradingHQ.sessions);
  const lossesToday = performanceStats.lossCountToday;
  const maxLosses = tradingHQ.riskRules.maxDailyLosses;
  const halted = lossesToday >= maxLosses;
  const pill = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-line bg-raised text-xs whitespace-nowrap';
  const iconBtn = 'p-2 rounded-lg text-ink-3 hover:text-ink hover:bg-raised transition';

  return (
    <header className="bg-panel border-b border-line sticky top-0 z-40">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2 shrink-0" title={`Trading HQ ${tradingHQ.version}`}>
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-sky-600 text-white text-[13px] font-bold">T</span>
            <span className="text-[15px] font-semibold text-ink tracking-tight">Trading OS</span>
          </div>
          <div className="hidden md:flex items-center gap-2 min-w-0 overflow-hidden">
            <span className={pill} title="The trading session happening now (defined in New York time)">
              <span className={`w-1.5 h-1.5 rounded-full ${session ? 'bg-emerald-500' : 'bg-slate-500'}`} />
              <span className="text-ink-2">{session ? `${session.name} session` : 'No session'}</span>
            </span>
            <span className={pill} title="Risk per trade, from Trading HQ">
              <span className="text-ink-3">Risk</span>
              <span className="font-semibold text-ink">{tradingHQ.riskRules.riskPerSetupPct}%</span>
            </span>
            <span className={`${pill} ${halted ? 'border-rose-700 bg-rose-950/40' : ''}`} title="Losses today against the daily limit. At the limit, trading stops for the day.">
              <span className="text-ink-3">Losses today</span>
              <span className={`font-semibold ${halted ? 'text-rose-400' : 'text-ink'}`}>{lossesToday}/{maxLosses}</span>
            </span>
            <span className={`${pill} hidden lg:flex`} title="Sessions are defined in New York time">
              <span className="text-ink-3">New York</span>
              <span className="font-semibold text-ink font-mono">{nyTime || '--:--'}</span>
              <span className="text-ink-3 ml-1">{localLabel}</span>
              <span className="font-semibold text-ink font-mono">{lagosTime || '--:--'}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setGlossaryOpen(true)} title="What does this mean? Plain-English glossary" className={iconBtn}>
            <HelpCircle className="w-[18px] h-[18px]" />
          </button>
          <button
            onClick={() => setTheme(theme === 'ash' ? 'dark' : 'ash')}
            title={theme === 'ash' ? 'Switch to dark mode' : 'Switch to light mode'}
            className={iconBtn}
          >
            {theme === 'ash' ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
          </button>
          <button onClick={exportDataJSON} title="Download a full backup (JSON)" className={`${iconBtn} hidden sm:block`}>
            <Download className="w-[18px] h-[18px]" />
          </button>
          <label title="Restore from a backup (JSON)" className={`${iconBtn} cursor-pointer hidden sm:block`}>
            <Upload className="w-[18px] h-[18px]" />
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>
          <button onClick={signOut} title={user?.email ? `Sign out (${user.email})` : 'Sign out'} className={`${iconBtn} hover:text-rose-400`}>
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      <nav className="px-2 sm:px-4 flex items-center overflow-x-auto scrollbar-none border-t border-line">
        {navGroups.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <span className="w-px h-5 bg-line mx-1.5 shrink-0" aria-hidden />}
            {group.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  title={item.hint}
                  className={`relative flex items-center gap-1.5 px-3 h-11 text-sm whitespace-nowrap transition-colors ${
                    isActive ? 'text-ink font-semibold' : 'text-ink-3 hover:text-ink'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : ''}`} />
                  <span>{item.label}</span>
                  {isActive && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-sky-500" />}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </nav>
      <GlossaryDrawer open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </header>
  );
};
