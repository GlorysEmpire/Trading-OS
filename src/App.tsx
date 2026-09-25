import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TradingProvider, useTrading } from './context/TradingContext';
import { LoginView } from './components/LoginView';
import { Header } from './components/Header';
import { QuickTradeModal } from './components/QuickTradeModal';
import { DashboardView } from './components/DashboardView';
import { CalendarView } from './components/CalendarView';
import { AlertsView } from './components/AlertsView';
import { TradingHQView } from './components/TradingHQView';
import { AssetDesksView } from './components/AssetDesksView';
import { JournalView } from './components/JournalView';
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

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        theme === 'ash' ? 'bg-[#edf0f5] text-slate-900 ash-theme' : 'bg-[#080c14] text-slate-100 dark-theme'
      }`}
    >
      <Header />
      <main className="flex-1 overflow-x-hidden">{renderActiveView()}</main>
      <QuickTradeModal />
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
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
