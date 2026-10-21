import React, { useState, useRef, useEffect } from 'react';
import { useTrading } from '../context/TradingContext';
import { getAuthHeaders } from '../lib/supabaseClient';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShieldCheck,
  RotateCcw,
  BookOpen,
  Calendar,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-01',
    sender: 'assistant',
    text: `Trading OS Assistant online. I have full operational context across your active Trading HQ rules (${'v1.4.2-live'}), current asset desks, active operational schedule, and journal history.

How can I assist your operational preparation or post-trade review today?`,
    timestamp: '08:00 AM',
  },
];

export const AIAssistantView: React.FC = () => {
  const { tradingHQ, assets, trades, researchQuestions, calendarEvents, performanceStats } = useTrading();

  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputPrompt('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          prompt: text.trim(),
          context: {
            rules: tradingHQ.riskRules,
            grades: tradingHQ.setupGrades,
            version: tradingHQ.version,
            performance: performanceStats,
            assets: assets.map((a) => ({
              symbol: a.symbol,
              bias: a.currentBias,
              narrative: a.currentNarrative,
              quickLevels: a.quickLevels,
            })),
            activeResearchQuestion: researchQuestions[0],
            latestTrades: trades.slice(0, 3),
            calendarEvents: calendarEvents.slice(0, 5),
          },
        }),
      });

      const data = await response.json();
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: response.ok ? data.text || 'Operational response synthesized.' : data.error || 'The AI request failed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Operational Fallback: You are operating under active Trading HQ rules. Max 2 losses daily limit, 1% risk per setup. No re-entry allowed after stop. Active backtest assignment: ETH RQ-05 (50 sample target).',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const chips = [
    'What am I supposed to be doing today?',
    'What asset am I backtesting today?',
    'What is my current ETH narrative?',
    'Audit my latest trade against Trading HQ rules',
    'Explain how Good Process + Loss compares to Bad Process + Win',
    'Clarify the Wyckoff AR semantic rule',
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-mono text-base font-bold text-slate-100 flex items-center gap-2">
              <span>TRADING OS COGNITIVE ASSISTANT</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Anchored to your Trading HQ configuration, active asset desks, and historical process journal.
            </p>
          </div>
        </div>

        <button
          onClick={() => setMessages(INITIAL_MESSAGES)}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
          title="Reset Conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Suggested Question Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-none">
        {chips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            className="px-2.5 py-1 rounded bg-[#131a26] border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 whitespace-nowrap transition cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-lg bg-[#0e141e] border border-slate-800">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-7 h-7 rounded bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-3.5 rounded-lg max-w-2xl text-xs leading-relaxed space-y-1 ${
                  isUser
                    ? 'bg-cyan-700 text-white font-sans'
                    : 'bg-[#141d2b] border border-slate-800 text-slate-200 font-sans shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span>{isUser ? 'TRADER' : 'TRADING OS ASSISTANT'}</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div className="whitespace-pre-line">{msg.text}</div>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 items-center text-xs font-mono text-cyan-400">
            <div className="w-7 h-7 rounded bg-cyan-950/80 border border-cyan-800 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5 p-3 rounded-lg bg-[#141d2b] border border-slate-800">
              <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
              <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              <span className="ml-2 text-slate-400 text-xs">Consulting Trading HQ knowledge base...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Ask Trading OS about active rules, ETH narrative, backtesting assignments, or trade audits..."
          className="flex-1 bg-[#101722] border border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-100 placeholder-slate-500 font-sans outline-none focus:border-cyan-500 transition"
        />
        <button
          type="submit"
          disabled={!inputPrompt.trim() || loading}
          className="px-5 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Send className="w-4 h-4" />
          <span>SEND</span>
        </button>
      </form>
    </div>
  );
};
