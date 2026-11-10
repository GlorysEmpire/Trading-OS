import React, { useEffect, useState } from 'react';
import {
  Bell, BookOpen, Brain, CalendarDays, CalendarRange, ChevronDown, ClipboardCheck,
  Download, FlaskConical, Globe, HelpCircle, History, LayoutDashboard, LogOut,
  Moon, Plus, Radar, Settings2, Sliders, Sparkles, Sun, TrendingUp, Upload,
} from 'lucide-react';
import { useTrading, type NavSection } from '../context/TradingContext';
import { useAuth } from '../context/AuthContext';
import { getActiveSession } from '../utils/traderTime';
import { GlossaryDrawer } from './GlossaryDrawer';

type NavItem = { id: NavSection; label: string; mobileLabel?: string; icon: React.ElementType };

const PRIMARY: NavItem[] = [
  { id: 'dashboard', label: 'Today', icon: LayoutDashboard },
  { id: 'asset-desks', label: 'Markets', icon: TrendingUp },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'calendar', label: 'Calendar', mobileLabel: 'Plan', icon: CalendarDays },
  { id: 'research', label: 'Research', icon: FlaskConical },
  { id: 'backtesting', label: 'Backtesting', icon: History },
];

const MORE: { title: string; items: NavItem[] }[] = [
  {
    title: 'Reflect',
    items: [
      { id: 'debrief', label: 'Daily debrief', icon: ClipboardCheck },
      { id: 'weekly-review', label: 'Weekly review', icon: CalendarRange },
      { id: 'psychology', label: 'Psychology', icon: Brain },
    ],
  },
  {
    title: 'Your system',
    items: [
      { id: 'trading-hq', label: 'Trading HQ', icon: Sliders },
      { id: 'alerts', label: 'Alerts', icon: Bell },
      { id: 'ai-assistant', label: 'AI assistant', icon: Sparkles },
    ],
  },
  {
    title: 'Explore',
    items: [
      { id: 'research', label: 'Research', icon: FlaskConical },
      { id: 'backtesting', label: 'Backtesting', icon: History },
      { id: 'market-intelligence', label: 'Market intelligence', icon: Globe },
      { id: 'scanner', label: 'Scanner', icon: Radar },
    ],
  },
];

export const AppNavigation: React.FC = () => {
  const {
    theme, setTheme, activeTab, setActiveTab, setQuickTradeModalOpen,
    tradingHQ, performanceStats, exportDataJSON, importDataJSON,
  } = useTrading();
  const { user, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [nyTime, setNyTime] = useState('');

  useEffect(() => {
    const update = () => setNyTime(new Date().toLocaleTimeString('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
    }));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-nav-menu]')) setMoreOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [moreOpen]);

  useEffect(() => { setMoreOpen(false); }, [activeTab]);

  const navigate = (section: NavSection) => { setActiveTab(section); setMoreOpen(false); };
  const session = getActiveSession(tradingHQ.sessions);
  const halted = performanceStats.lossCountToday >= tradingHQ.riskRules.maxDailyLosses;
  const isMoreActive = MORE.some(group => group.items.some(item => item.id === activeTab));

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      if (typeof content !== 'string') return;
      importDataJSON(content).then(success => {
        window.alert(success ? 'Trading OS backup restored.' : 'Could not restore this backup. Your current data was not changed.');
      });
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-panel">
        <div className="mx-auto max-w-[1500px] h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <button onClick={() => navigate('dashboard')} className="flex items-center gap-2.5 shrink-0" aria-label="Trading OS home">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-700 text-white font-bold shadow-[0_6px_20px_rgba(8,145,178,.25)]">T</span>
            <span className="text-base font-semibold tracking-tight text-ink">Trading OS</span>
          </button>
          <div className="hidden lg:flex items-center gap-2 text-xs text-ink-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${session ? 'bg-emerald-400' : 'bg-ink-3'}`} />
              {session ? `${session.name} session` : 'Between sessions'}
            </span>
            <span className={`rounded-full border px-3 py-1.5 ${halted ? 'border-rose-800 bg-rose-950/30 text-rose-300' : 'border-line bg-raised'}`}>
              {performanceStats.lossCountToday}/{tradingHQ.riskRules.maxDailyLosses} losses today
            </span>
            <span className="px-1 tabular-nums">NY {nyTime || '--:--'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setQuickTradeModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm">
              <Plus className="h-4 w-4" /><span className="hidden sm:inline">Log trade</span><span className="sm:hidden">Trade</span>
            </button>
          </div>
        </div>

        <nav aria-label="Main" className="hidden md:flex mx-auto max-w-[1500px] px-4 sm:px-6 items-center gap-1 border-t border-line/70">
          {PRIMARY.map(item => {
            const Icon = item.icon;
            return <button key={item.id} onClick={() => navigate(item.id)} aria-current={activeTab === item.id ? 'page' : undefined}
              className={`relative ${item.id === 'research' || item.id === 'backtesting' ? 'hidden xl:inline-flex' : 'inline-flex'} items-center gap-2 px-3.5 py-3 text-sm transition ${activeTab === item.id ? 'text-ink font-semibold' : 'text-ink-3 hover:text-ink'}`}>
              <Icon className={`h-4 w-4 ${activeTab === item.id ? 'text-cyan-400' : ''}`} /> {item.label}
              {activeTab === item.id && <span className="absolute bottom-0 inset-x-2 h-0.5 rounded-full bg-cyan-400" />}
            </button>;
          })}
          <button data-nav-menu onClick={() => setMoreOpen(open => !open)} aria-expanded={moreOpen}
            className={`ml-auto inline-flex items-center gap-1.5 px-3.5 py-3 text-sm ${isMoreActive || moreOpen ? 'text-ink font-semibold' : 'text-ink-3 hover:text-ink'}`}>
            More <ChevronDown className={`h-4 w-4 transition ${moreOpen ? 'rotate-180' : ''}`} />
          </button>
        </nav>

        {moreOpen && <div data-nav-menu className="fixed inset-x-3 bottom-18 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-line-strong bg-panel p-4 shadow-2xl md:absolute md:inset-x-auto md:bottom-auto md:top-full md:right-6 md:w-[470px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MORE.map(group => <div key={group.title}>
              <p className="px-2 text-[10px] uppercase tracking-widest font-semibold text-ink-3 mb-1">{group.title}</p>
              {group.items.map(item => {
                const Icon = item.icon;
                return <button key={item.id} onClick={() => navigate(item.id)}
                  className={`w-full flex ${item.id === 'research' || item.id === 'backtesting' ? 'xl:hidden' : ''} items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left hover:bg-raised ${activeTab === item.id ? 'bg-raised text-cyan-400 font-semibold' : 'text-ink-2'}`}>
                  <Icon className="h-4 w-4 shrink-0" />{item.label}
                </button>;
              })}
            </div>)}
          </div>
          <div className="border-t border-line mt-4 pt-3">
            <p className="px-2 text-[10px] uppercase tracking-widest font-semibold text-ink-3 mb-1">Preferences & data</p>
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => { setTheme(theme === 'ash' ? 'dark' : 'ash'); setMoreOpen(false); }} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-ink-2 hover:bg-raised">{theme === 'ash' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} {theme === 'ash' ? 'Dark theme' : 'Light theme'}</button>
              <button onClick={() => { setGlossaryOpen(true); setMoreOpen(false); }} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-ink-2 hover:bg-raised"><HelpCircle className="h-4 w-4" /> Glossary</button>
              <button onClick={() => { exportDataJSON(); setMoreOpen(false); }} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-ink-2 hover:bg-raised"><Download className="h-4 w-4" /> Download backup</button>
              <label className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-ink-2 hover:bg-raised cursor-pointer"><Upload className="h-4 w-4" /> Restore backup<input type="file" accept=".json" onChange={handleFileUpload} className="sr-only" /></label>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line mt-2 pt-3 px-2 text-xs text-ink-3">
              <span className="truncate">{user?.email}</span>
              <button onClick={signOut} className="inline-flex items-center gap-1.5 text-rose-400 hover:text-rose-300 shrink-0"><LogOut className="h-4 w-4" /> Sign out</button>
            </div>
          </div>
        </div>}
      </header>

      <nav aria-label="Mobile" className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-panel/95 backdrop-blur-xl px-1 pb-[env(safe-area-inset-bottom)] flex justify-around">
        {PRIMARY.slice(0, 4).map(item => {
          const Icon = item.icon;
          return <button key={item.id} onClick={() => navigate(item.id)} aria-current={activeTab === item.id ? 'page' : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${activeTab === item.id ? 'text-cyan-400 font-semibold' : 'text-ink-3'}`}>
            <Icon className="h-5 w-5" /><span>{item.mobileLabel ?? item.label}</span>
          </button>;
        })}
        <button data-nav-menu onClick={() => setMoreOpen(open => !open)} aria-expanded={moreOpen}
          className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${moreOpen || isMoreActive ? 'text-cyan-400 font-semibold' : 'text-ink-3'}`}>
          <Settings2 className="h-5 w-5" /><span>More</span>
        </button>
      </nav>
      <GlossaryDrawer open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </>
  );
};
