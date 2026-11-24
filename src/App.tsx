import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TradingProvider, useTrading } from './context/TradingContext';
import { DecompositionDefinitionsProvider } from './context/DecompositionDefinitionsContext';
import { DecompositionDataProvider } from './context/DecompositionDataContext';
import { MarketDecompositionView } from './components/MarketDecompositionView';
import { LoginView } from './components/LoginView';
import { AppNavigation } from './components/AppNavigation';
import { QuickTradeModal } from './components/QuickTradeModal';
import { TodayView } from './components/TodayView';
import { DisciplineView } from './components/DisciplineView';
import { BadgeUnlockToast } from './components/BadgeUnlockToast';
import { CloseVerdict } from './components/CloseVerdict';
import { CalendarView } from './components/CalendarView';
import { AlertsView } from './components/AlertsView';
import { TradingHQView } from './components/TradingHQView';
import { AssetDesksView } from './components/AssetDesksView';
import { JournalView } from './components/JournalView';
import { DebriefView } from './components/DebriefView';
import { WeeklyReviewView } from './components/WeeklyReviewView';
import { BacktestingView } from './components/BacktestingView';
import { ResearchView } from './components/ResearchView';
import { PsychologyView } from './components/PsychologyView';
import { MarketIntelligenceView } from './components/MarketIntelligenceView';
import { ScannerView } from './components/ScannerView';
import { AIAssistantView } from './components/AIAssistantView';

const MainShell: React.FC = () => {
  const { activeTab, setQuickTradeModalOpen, theme } = useTrading();

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
      <div className="tos-ambient" aria-hidden="true">
        <div className="tos-blob tos-blob-1" />
        <div className="tos-blob tos-blob-2" />
        <div className="tos-blob tos-blob-3" />
        <div className="tos-floor" />
        <div className="tos-grain" />
      </div>
      <AppNavigation />
      <main className="flex-1 overflow-x-hidden pb-24 md:pb-6">{renderActiveView()}</main>
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
