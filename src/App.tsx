import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TradingProvider, useTrading } from './context/TradingContext';
import { LoginView } from './components/LoginView';
import { AppNavigation } from './components/AppNavigation';
import { QuickTradeModal } from './components/QuickTradeModal';
import { DashboardView } from './components/DashboardView';
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
        return <DashboardView />;
      case 'calendar':
        return <CalendarView />;
      case 'alerts':
        return <AlertsView />;
      case 'trading-hq':
        return <TradingHQView />;
      case 'asset-desks':
        return <AssetDesksView />;
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
        return <DashboardView />;
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
    <div className="min-h-screen flex flex-col font-sans bg-canvas text-ink transition-colors duration-200">
      <AppNavigation />
      <main className="flex-1 overflow-x-hidden pb-18 md:pb-0">{renderActiveView()}</main>
      <QuickTradeModal />
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
      <MainShell />
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
