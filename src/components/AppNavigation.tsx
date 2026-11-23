import React, { useEffect, useState } from 'react';
import {
  Bell, BookOpen, Brain, CalendarDays, CalendarRange, ChevronDown, ClipboardCheck,
  Download, FlaskConical, Globe, HelpCircle, History, LayoutDashboard, LogOut,
  Award, Clock, Moon, Radar, Settings2, Sliders, Sparkles, Sun, TrendingUp, Upload,
} from 'lucide-react';
import { useTrading, type NavSection } from '../context/TradingContext';
import { useAuth } from '../context/AuthContext';
import { deviceTimeZone, getActiveSession } from '../utils/traderTime';
import { localIsNY, zoneLabel } from '../utils/timeDisplay';
import { GlossaryDrawer } from './GlossaryDrawer';

type NavItem = { id: NavSection; label: string; mobileLabel?: string; icon: React.ElementType };

const PRIMARY: NavItem[] = [
  { id: 'dashboard', label: 'Today', icon: LayoutDashboard },
  { id: 'asset-desks', label: 'Asset Desks', mobileLabel: 'Desks', icon: TrendingUp },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'discipline', label: 'Discipline', icon: Award },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'research', label: 'Research', icon: FlaskConical },
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
      { id: 'calendar', label: 'Calendar', icon: CalendarDays },
      { id: 'backtesting', label: 'Backtesting', icon: History },
      { id: 'research', label: 'Research', icon: FlaskConical },
      { id: 'market-intelligence', label: 'Market intelligence', icon: Globe },
      { id: 'scanner', label: 'Scanner', icon: Radar },
    ],
  },
];

export const AppNavigation: React.FC = () => {
  const {
    theme, setTheme, activeTab, setActiveTab, timeView, setTimeView,
    tradingHQ, performanceStats, exportDataJSON, importDataJSON,
  } = useTrading();
  const { user, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [nyTime, setNyTime] = useState('');
  const [localTime, setLocalTime] = useState('');
  const localZone = deviceTimeZone();
  const sameAsNY = localIsNY();

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setNyTime(now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }));
      setLocalTime(now.toLocaleTimeString('en-US', { timeZone: localZone, hour: '2-digit', minute: '2-digit', hour12: false }));
    };
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
  const isMoreActive = !PRIMARY.some(item => item.id === activeTab) && MORE.some(group => group.items.some(item => item.id === activeTab));

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      if (typeof content !== 'string') return;
      importDataJSON(content).then(success => {
        window.alert(success ? 'Trading OS backup restored.' : 'Restore did not finish. Some records may have imported; review your workspaces before trying again.');
      });
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <>
      <header className="sticky top-0 z-40 px-3 sm:px-5 pt-3">
        <div className="tos-glass mx-auto max-w-[1500px] rounded-2xl">
          <div className="h-14 pl-3 pr-2 sm:pl-4 flex items-center justify-between gap-3">
            <button onClick={() => navigate('dashboard')} className="flex items-center gap-2.5 shrink-0" aria-label="Trading OS home">
              <span className="relative grid place-items-center h-8 w-8 rounded-[10px] text-[13px] font-extrabold text-[#032420] shadow-[inset_0_1px_0_rgba(255,255,255,.55),0_6px_16px_-6px_rgba(45,212,191,.6)]" style={{ background: 'var(--tos-cta)' }}>T</span>
              <span className="hidden sm:inline text-[15px] font-semibold tracking-tight text-ink">Trading OS</span>
            </button>

            <nav aria-label="Main" className="hidden md:flex items-center gap-0.5 rounded-xl bg-well p-1 ring-1 ring-inset ring-line">
              {PRIMARY.map(item => {
                const Icon = item.icon;
                const on = activeTab === item.id;
                return <button key={item.id} onClick={() => navigate(item.id)} aria-current={on ? 'page' : undefined}
                  className={`${item.id === 'research' ? 'hidden xl:inline-flex' : 'inline-flex'} items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] transition ${on ? 'bg-raised text-ink font-semibold shadow-[inset_0_1px_0_var(--tos-card-highlight),0_4px_12px_-6px_rgba(0,0,0,.5)] ring-1 ring-inset ring-line-strong' : 'text-ink-3 hover:text-ink'}`}>
                  <Icon className={`h-4 w-4 ${on ? 'text-accent' : ''}`} /> {item.label}
                </button>;
              })}
              <button data-nav-menu onClick={() => setMoreOpen(open => !open)} aria-expanded={moreOpen}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] transition ${isMoreActive || moreOpen ? 'bg-raised text-ink font-semibold ring-1 ring-inset ring-line-strong' : 'text-ink-3 hover:text-ink'}`}>
                More <ChevronDown className={`h-3.5 w-3.5 transition ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
            </nav>

            <div className="flex items-center gap-1.5 text-xs text-ink-3">
              <span className="hidden xl:inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-1.5" title={session ? `${session.name} session is open` : 'No session open'}>
                <span className={`h-1.5 w-1.5 rounded-full ${session ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]' : 'bg-ink-3'}`} />
                {session ? session.name : 'Between sessions'}
              </span>
              <span className={`hidden sm:inline-flex rounded-full px-2.5 py-1.5 tabular-nums ${halted ? 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30' : ''}`} title="Losses today against your daily limit">
                {performanceStats.lossCountToday}/{tradingHQ.riskRules.maxDailyLosses} losses
              </span>
              {sameAsNY ? (
                <span className="px-2 tabular-nums">NY {nyTime || '--:--'}</span>
              ) : (
                <div role="group" aria-label="Show trading times in" title="Trading times are New York time. Click your local clock to see them in your time instead."
                  className="inline-flex rounded-full bg-well p-0.5 ring-1 ring-inset ring-line">
                  {([['NY', `NY ${nyTime || '--:--'}`], ['LOCAL', `${zoneLabel(localZone)} ${localTime || '--:--'}`]] as const).map(([view, label]) => (
                    <button key={view} type="button" aria-pressed={timeView === view} onClick={() => setTimeView(view)}
                      className={`rounded-full px-2.5 py-1 tabular-nums transition ${timeView === view ? 'bg-raised text-ink font-semibold ring-1 ring-inset ring-line-strong' : 'text-ink-3 hover:text-ink'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {moreOpen && <div data-nav-menu className="tos-glass tos-pop fixed inset-x-3 bottom-20 z-50 max-h-[70vh] overflow-y-auto rounded-2xl p-4 md:absolute md:inset-x-auto md:bottom-auto md:top-[calc(100%+8px)] md:right-5 md:w-[470px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MORE.map(group => <div key={group.title}>
              <p className="px-2 text-[10px] uppercase tracking-widest font-semibold text-ink-3 mb-1">{group.title}</p>
              {group.items.map(item => {
                const Icon = item.icon;
                return <button key={item.id} onClick={() => navigate(item.id)}
                  className={`w-full flex ${item.id === 'research' ? 'xl:hidden' : item.id === 'calendar' ? 'md:hidden' : ''} items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-left hover:bg-raised ${activeTab === item.id ? 'bg-raised text-accent font-semibold' : 'text-ink-2'}`}>
                  <Icon className="h-4 w-4 shrink-0" />{item.label}
                </button>;
              })}
            </div>)}
          </div>
          <div className="border-t border-line mt-4 pt-3">
            <p className="px-2 text-[10px] uppercase tracking-widest font-semibold text-ink-3 mb-1">Preferences & data</p>
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => { setTheme(theme === 'ash' ? 'dark' : 'ash'); setMoreOpen(false); }} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-ink-2 hover:bg-raised">{theme === 'ash' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} {theme === 'ash' ? 'Dark theme' : 'Light theme'}</button>
              {!sameAsNY && (
                <button onClick={() => setTimeView(timeView === 'NY' ? 'LOCAL' : 'NY')} title="Trading times are New York time by default"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-ink-2 hover:bg-raised">
                  <Clock className="h-4 w-4" /> Times: {timeView === 'NY' ? 'New York' : zoneLabel(localZone)} → {timeView === 'NY' ? zoneLabel(localZone) : 'New York'}
                </button>
              )}
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

      <nav aria-label="Mobile" className="tos-glass md:hidden fixed bottom-3 inset-x-3 z-40 rounded-2xl px-1 mb-[env(safe-area-inset-bottom)] flex justify-around">
        {PRIMARY.slice(0, 4).map(item => {
          const Icon = item.icon;
          return <button key={item.id} onClick={() => navigate(item.id)} aria-current={activeTab === item.id ? 'page' : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${activeTab === item.id ? 'text-accent font-semibold' : 'text-ink-3'}`}>
            <Icon className="h-5 w-5" /><span>{item.mobileLabel ?? item.label}</span>
          </button>;
        })}
        <button data-nav-menu onClick={() => setMoreOpen(open => !open)} aria-expanded={moreOpen}
          className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${moreOpen || isMoreActive ? 'text-accent font-semibold' : 'text-ink-3'}`}>
          <Settings2 className="h-5 w-5" /><span>More</span>
        </button>
      </nav>
      <GlossaryDrawer open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </>
  );
};
