import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TradingProvider, useTrading } from './context/TradingContext';
import { DecompositionDefinitionsProvider } from './context/DecompositionDefinitionsContext';
import { DecompositionDataProvider } from './context/DecompositionDataContext';
import { LoginView } from './components/LoginView';
import { AppNavigation } from './components/AppNavigation';
import { QuickTradeModal } from './components/QuickTradeModal';
import { TodayView } from './components/TodayView';
import { BadgeUnlockToast } from './components/BadgeUnlockToast';
import { CloseVerdict } from './components/CloseVerdict';

const MarketDecompositionView = lazy(() => import('./components/MarketDecompositionView').then(({ MarketDecompositionView }) => ({ default: MarketDecompositionView })));
const DisciplineView = lazy(() => import('./components/DisciplineView').then(({ DisciplineView }) => ({ default: DisciplineView })));
const CalendarView = lazy(() => import('./components/CalendarView').then(({ CalendarView }) => ({ default: CalendarView })));
const AlertsView = lazy(() => import('./components/AlertsView').then(({ AlertsView }) => ({ default: AlertsView })));
const TradingHQView = lazy(() => import('./components/TradingHQView').then(({ TradingHQView }) => ({ default: TradingHQView })));
const AssetDesksView = lazy(() => import('./components/AssetDesksView').then(({ AssetDesksView }) => ({ default: AssetDesksView })));
const JournalView = lazy(() => import('./components/JournalView').then(({ JournalView }) => ({ default: JournalView })));
const DebriefView = lazy(() => import('./components/DebriefView').then(({ DebriefView }) => ({ default: DebriefView })));
const WeeklyReviewView = lazy(() => import('./components/WeeklyReviewView').then(({ WeeklyReviewView }) => ({ default: WeeklyReviewView })));
const BacktestingView = lazy(() => import('./components/BacktestingView').then(({ BacktestingView }) => ({ default: BacktestingView })));
const ResearchView = lazy(() => import('./components/ResearchView').then(({ ResearchView }) => ({ default: ResearchView })));
const PsychologyView = lazy(() => import('./components/PsychologyView').then(({ PsychologyView }) => ({ default: PsychologyView })));
const MarketIntelligenceView = lazy(() => import('./components/MarketIntelligenceView').then(({ MarketIntelligenceView }) => ({ default: MarketIntelligenceView })));
const ScannerView = lazy(() => import('./components/ScannerView').then(({ ScannerView }) => ({ default: ScannerView })));
const AIAssistantView = lazy(() => import('./components/AIAssistantView').then(({ AIAssistantView }) => ({ default: AIAssistantView })));

const MainShell: React.FC = () => {
  const { activeTab, setQuickTradeModalOpen, theme } = useTrading();
  const workspace = useRef<HTMLElement>(null);
  const previousTab = useRef(activeTab);

  useEffect(() => {
    if (previousTab.current === activeTab) return;
    previousTab.current = activeTab;
    window.scrollTo(0, 0);
    workspace.current?.focus({ preventScroll: true });
  }, [activeTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickTradeModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setQuickTradeModalOpen]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <TodayView />;
      case 'calendar':
        return <CalendarView />;
      case 'alerts':
        return <AlertsView />;
      case 'trading-hq':
        return <TradingHQView />;
      case 'asset-desks':
        return <AssetDesksView />;
      case 'decomposition':
        return <MarketDecompositionView />;
      case 'discipline':
        return <DisciplineView />;
      case 'journal':
        return <JournalView />;
      case 'debrief':
        return <DebriefView />;
      case 'weekly-review':
        return <WeeklyReviewView />;
      case 'backtesting':
        return <BacktestingView />;
      case 'research':
        return <ResearchView />;
      case 'psychology':
        return <PsychologyView />;
      case 'market-intelligence':
        return <MarketIntelligenceView />;
      case 'scanner':
        return <ScannerView />;
      case 'ai-assistant':
        return <AIAssistantView />;
      default:
        return <TodayView />;
    }
  };

  // Apply the theme to the whole document, so the page background, scrollbars
  // and anything rendered outside this tree use the same tokens.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('ash-theme', theme === 'ash');
    root.classList.toggle('dark-theme', theme !== 'ash');
  }, [theme]);

  return (
    <div className="relative isolate min-h-screen flex flex-col font-sans text-ink">
      <a href="#workspace" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 tos-secondary">Skip to workspace</a>
      <AppNavigation />
      <main ref={workspace} id="workspace" tabIndex={-1} className="flex-1 overflow-x-hidden pb-24 md:pb-6">
        <Suspense fallback={<p className="mx-auto max-w-7xl p-6 text-sm text-ink-2" role="status">Opening workspace…</p>}>
          <div key={activeTab} className="tos-rise">{renderActiveView()}</div>
        </Suspense>
      </main>
      <QuickTradeModal />
      <BadgeUnlockToast />
      <CloseVerdict />
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <span className="font-mono text-xs text-slate-500">Loading…</span>
      </div>
    );
  }

  if (!session) return <LoginView />;

  return (
    <TradingProvider userId={session.user.id}>
      <DecompositionDefinitionsProvider userId={session.user.id}>
        <DecompositionDataProvider userId={session.user.id}>
          <MainShell />
        </DecompositionDataProvider>
      </DecompositionDefinitionsProvider>
    </TradingProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
