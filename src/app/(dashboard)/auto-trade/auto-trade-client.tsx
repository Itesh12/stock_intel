"use client";

import React, { useState, useEffect } from "react";
import { 
    Bot, 
    Plus, 
    Play, 
    Pause, 
    Trash2, 
    Settings, 
    History, 
    AlertTriangle, 
    Activity, 
    DollarSign, 
    ArrowUpRight, 
    ArrowDownRight, 
    CheckCircle2, 
    Info,
    RefreshCw,
    TrendingUp
} from "lucide-react";
import { formatCurrency, formatSymbol } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Strategy {
    id: string;
    slug: string;
    name: string;
    riskLevel: string;
    winRate: string;
    objective: string;
}

interface BotData {
    id: string;
    name: string;
    strategySlug: string;
    strategyName: string;
    status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
    capitalAllocated: number;
    maxPositionSizePercent: number;
    riskPerTradePercent: number;
    maxTradesPerDay: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    minConfluenceScore: number;
    totalTradesExecuted: number;
    winCount: number;
    lossCount: number;
    totalPnL: number;
    todayTradeCount: number;
    createdAt: string;
}

interface Trade {
    id: string;
    symbol: string;
    quantity: number;
    price: number;
    totalValue: number;
    type: 'BUY' | 'SELL';
    timestamp: string;
    realizedPL?: number;
}

export default function AutoTradeClient({
    initialBots,
    initialStrategies,
    cashBalance
}: {
    initialBots: BotData[];
    initialStrategies: Strategy[];
    cashBalance: number;
}) {
    const [bots, setBots] = useState<BotData[]>(initialBots);
    const [activeTab, setActiveTab] = useState<'bots' | 'create' | 'history'>('bots');
    const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
    const [historyTrades, setHistoryTrades] = useState<Trade[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    // Form State
    const [formName, setFormName] = useState("");
    const [formStrategySlug, setFormStrategySlug] = useState(initialStrategies[0]?.slug || "");
    const [formCapital, setFormCapital] = useState(Math.min(100000, cashBalance));
    const [formMaxPosPercent, setFormMaxPosPercent] = useState(20);
    const [formRiskPercent, setFormRiskPercent] = useState(2);
    const [formMaxTrades, setFormMaxTrades] = useState(3);
    const [formStopLoss, setFormStopLoss] = useState(7);
    const [formTakeProfit, setFormTakeProfit] = useState(15);
    const [formMinScore, setFormMinScore] = useState(70);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Fetch history for selected bot
    useEffect(() => {
        if (selectedBotId) {
            setLoadingHistory(true);
            fetch(`/api/auto-trade/${selectedBotId}/history`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setHistoryTrades(data);
                    }
                })
                .catch(err => console.error("Error loading history:", err))
                .finally(() => setLoadingHistory(false));
        } else {
            setHistoryTrades([]);
        }
    }, [selectedBotId]);

    // Handle bot creation
    const handleCreateBot = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError(null);
        setFormSuccess(null);

        if (formCapital > cashBalance) {
            setFormError(`Capital allocated exceeds current portfolio cash balance (${formatCurrency(cashBalance)})`);
            setIsSubmitting(false);
            return;
        }

        try {
            const res = await fetch("/api/auto-trade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formName,
                    strategySlug: formStrategySlug,
                    capitalAllocated: Number(formCapital),
                    maxPositionSizePercent: Number(formMaxPosPercent),
                    riskPerTradePercent: Number(formRiskPercent),
                    maxTradesPerDay: Number(formMaxTrades),
                    stopLossPercent: Number(formStopLoss),
                    takeProfitPercent: Number(formTakeProfit),
                    minConfluenceScore: Number(formMinScore),
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to launch bot");
            }

            setBots(prev => [data, ...prev]);
            setFormSuccess(`Bot "${formName}" successfully deployed and activated!`);
            // Reset
            setFormName("");
            setTimeout(() => {
                setActiveTab('bots');
                setFormSuccess(null);
            }, 1500);
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Toggle Bot Status
    const handleToggleStatus = async (botId: string, currentStatus: string) => {
        setActionLoading(botId);
        const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        try {
            const res = await fetch(`/api/auto-trade/${botId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus })
            });

            if (res.ok) {
                const updated = await res.json();
                setBots(prev => prev.map(b => b.id === botId ? updated : b));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    // Delete Bot
    const handleDeleteBot = async (botId: string) => {
        if (!confirm("Are you sure you want to permanently delete this bot? All configurations will be lost.")) return;
        setActionLoading(botId);
        try {
            const res = await fetch(`/api/auto-trade/${botId}`, {
                method: "DELETE"
            });

            if (res.ok) {
                setBots(prev => prev.filter(b => b.id !== botId));
                if (selectedBotId === botId) {
                    setSelectedBotId(null);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setActionLoading(null);
        }
    };

    // Trigger Manual Run for testing
    const handleManualTrigger = async () => {
        setActionLoading("trigger");
        try {
            const res = await fetch("/api/auto-trade/trigger", {
                method: "POST"
            });
            const data = await res.json();
            alert(`Trigger complete!\nLimit order checks: Executed ${data.limitOrders?.executed || 0}, Failed ${data.limitOrders?.failed || 0}`);
            
            // Refresh bot list to show updated stats
            const listRes = await fetch("/api/auto-trade");
            if (listRes.ok) {
                const refreshedBots = await listRes.json();
                setBots(refreshedBots);
            }
        } catch (err) {
            console.error(err);
            alert("Trigger failed. Check logs.");
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-[1400px] mx-auto px-4 sm:px-6 py-4 md:py-6 pb-20">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-2.5">
                        <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Activity size={10} className="animate-pulse" /> Live Simulation
                        </div>
                        <div className="h-1 w-1 rounded-full bg-slate-700"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Bot size={12} /> {bots.length} Active Bots
                        </span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tighter font-outfit flex items-center gap-4">
                        Auto Trade Hub <Bot className="text-indigo-400" size={40} />
                    </h1>
                    <p className="text-slate-500 text-sm font-medium max-w-2xl">
                        Deploy algorithmic execution agents on your quant scanner models. Bots will scan, size positions, execute trades, and manage target exits/stop-losses in your virtual portfolio automatically.
                    </p>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={handleManualTrigger}
                        disabled={actionLoading === "trigger"}
                        className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 flex items-center gap-2 transition-all"
                    >
                        <RefreshCw size={16} className={cn("text-slate-400", actionLoading === "trigger" && "animate-spin")} />
                        {actionLoading === "trigger" ? "Running Engine..." : "Trigger Manual Scan"}
                    </button>
                    <button 
                        onClick={() => setActiveTab('create')}
                        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all"
                    >
                        <Plus size={16} /> Deploy New Bot
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Capital</span>
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">{formatCurrency(cashBalance)}</h3>
                    <p className="text-xs text-slate-500 mt-2 font-medium">Virtual cash balance available for bot allocation</p>
                </div>

                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bots Performance</span>
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    {(() => {
                        const totalPnL = bots.reduce((sum, b) => sum + b.totalPnL, 0);
                        const isProfit = totalPnL >= 0;
                        return (
                            <>
                                <h3 className={cn("text-2xl font-bold tracking-tight flex items-center gap-1", isProfit ? "text-emerald-400" : "text-rose-400")}>
                                    {isProfit ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                                    {formatCurrency(totalPnL)}
                                </h3>
                                <p className="text-xs text-slate-500 mt-2 font-medium">Combined realized returns from all active & stopped bots</p>
                            </>
                        );
                    })()}
                </div>

                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Bot Trades</span>
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                            <Activity size={16} />
                        </div>
                    </div>
                    {(() => {
                        const totalTrades = bots.reduce((sum, b) => sum + b.totalTradesExecuted, 0);
                        const wins = bots.reduce((sum, b) => sum + b.winCount, 0);
                        const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0.0";
                        return (
                            <>
                                <h3 className="text-2xl font-bold text-white tracking-tight">{totalTrades} Executed</h3>
                                <p className="text-xs text-slate-500 mt-2 font-medium">Win Rate: <span className="text-emerald-400 font-semibold">{winRate}%</span> across all bots</p>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-white/5 pb-2">
                <button
                    onClick={() => setActiveTab('bots')}
                    className={cn(
                        "px-6 py-3 font-semibold text-sm rounded-xl transition-all flex items-center gap-2",
                        activeTab === 'bots' ? "bg-white/5 text-white border border-white/10" : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    <Bot size={16} /> My Trading Bots
                </button>
                <button
                    onClick={() => setActiveTab('create')}
                    className={cn(
                        "px-6 py-3 font-semibold text-sm rounded-xl transition-all flex items-center gap-2",
                        activeTab === 'create' ? "bg-white/5 text-white border border-white/10" : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    <Plus size={16} /> Deploy Configuration
                </button>
                {selectedBotId && (
                    <button
                        onClick={() => setActiveTab('history')}
                        className={cn(
                            "px-6 py-3 font-semibold text-sm rounded-xl transition-all flex items-center gap-2",
                            activeTab === 'history' ? "bg-white/5 text-white border border-white/10" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <History size={16} /> Bot History: {bots.find(b => b.id === selectedBotId)?.name}
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="mt-6">
                <AnimatePresence mode="wait">
                    {/* MY BOTS TAB */}
                    {activeTab === 'bots' && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {bots.length === 0 ? (
                                <div className="glass-morphic-card p-12 text-center rounded-[32px] border-white/5 flex flex-col items-center">
                                    <Bot size={48} className="text-slate-600 mb-4" />
                                    <h3 className="text-lg font-bold text-white mb-2">No Active Trading Bots</h3>
                                    <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                                        You haven't deployed any automated execution configurations yet. Set up a bot to trade scanner alerts automatically.
                                    </p>
                                    <button 
                                        onClick={() => setActiveTab('create')}
                                        className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold flex items-center gap-2"
                                    >
                                        <Plus size={16} /> Launch Your First Bot
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {bots.map((bot) => (
                                        <BotCard 
                                            key={bot.id} 
                                            bot={bot} 
                                            onToggleStatus={handleToggleStatus} 
                                            onDelete={handleDeleteBot}
                                            onViewHistory={(id) => {
                                                setSelectedBotId(id);
                                                setActiveTab('history');
                                            }}
                                            actionLoading={actionLoading}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* DEPLOY BOT TAB */}
                    {activeTab === 'create' && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="glass-morphic-card p-8 sm:p-10 rounded-[32px] border-white/5 max-w-4xl"
                        >
                            <h2 className="text-2xl font-bold text-white mb-2 font-outfit flex items-center gap-2">
                                <Plus className="text-indigo-400" size={24} /> Configure Algorithmic Bot
                            </h2>
                            <p className="text-slate-500 text-sm mb-8">
                                Define capital, risk settings, entry thresholds, and target levels. Bots run indefinitely, checking strategy scanner outputs on every scheduled cycle.
                            </p>

                            <form onSubmit={handleCreateBot} className="space-y-8">
                                {formError && (
                                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-2.5">
                                        <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                                        <span>{formError}</span>
                                    </div>
                                )}

                                {formSuccess && (
                                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2.5">
                                        <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                                        <span>{formSuccess}</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bot Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            placeholder="e.g. Swing Breakout Alpha"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Strategy Source</label>
                                        <select
                                            value={formStrategySlug}
                                            onChange={(e) => setFormStrategySlug(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                        >
                                            {initialStrategies.map((s) => (
                                                <option key={s.slug} value={s.slug} className="bg-slate-950 text-white">
                                                    {s.name} ({s.winRate})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Capital Allocated (INR)</span>
                                            <span className="text-indigo-400 font-bold font-mono">{formatCurrency(formCapital)}</span>
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min={5000}
                                            max={cashBalance}
                                            value={formCapital}
                                            onChange={(e) => setFormCapital(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                        />
                                        <span className="text-[10px] text-slate-500 font-medium">Max budget available to this bot for purchases.</span>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Min Confluence Score to enter</span>
                                            <span className="text-indigo-400 font-bold font-mono">{formMinScore} / 100</span>
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range"
                                                min={50}
                                                max={90}
                                                step={5}
                                                value={formMinScore}
                                                onChange={(e) => setFormMinScore(Number(e.target.value))}
                                                className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                            />
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium">Min score recommended by strategy engine to filter trade entries.</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-white/5 pt-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Max Position Size</span>
                                            <span className="text-indigo-400 font-bold font-mono">{formMaxPosPercent}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            min={5}
                                            max={100}
                                            step={5}
                                            value={formMaxPosPercent}
                                            onChange={(e) => setFormMaxPosPercent(Number(e.target.value))}
                                            className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                        />
                                        <span className="text-[10px] text-slate-500 font-medium">Max allocation per single stock purchase.</span>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Risk Per Trade</span>
                                            <span className="text-indigo-400 font-bold font-mono">{formRiskPercent}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            min={0.5}
                                            max={5}
                                            step={0.5}
                                            value={formRiskPercent}
                                            onChange={(e) => setFormRiskPercent(Number(e.target.value))}
                                            className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                        />
                                        <span className="text-[10px] text-slate-500 font-medium">Capital risk margin per setup.</span>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Max Trades / Day</span>
                                            <span className="text-indigo-400 font-bold font-mono">{formMaxTrades} trades</span>
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min={1}
                                            max={10}
                                            value={formMaxTrades}
                                            onChange={(e) => setFormMaxTrades(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Stop Loss Trigger</span>
                                            <span className="text-rose-400 font-bold font-mono">-{formStopLoss}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            min={2}
                                            max={15}
                                            step={0.5}
                                            value={formStopLoss}
                                            onChange={(e) => setFormStopLoss(Number(e.target.value))}
                                            className="w-full accent-rose-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                        />
                                        <span className="text-[10px] text-slate-500 font-medium">Triggers automated sell limit when price falls by this percent.</span>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                            <span>Take Profit Target</span>
                                            <span className="text-emerald-400 font-bold font-mono">+{formTakeProfit}%</span>
                                        </label>
                                        <input
                                            type="range"
                                            min={5}
                                            max={30}
                                            step={1}
                                            value={formTakeProfit}
                                            onChange={(e) => setFormTakeProfit(Number(e.target.value))}
                                            className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                        />
                                        <span className="text-[10px] text-slate-500 font-medium">Triggers exit order when stock rises to target.</span>
                                    </div>
                                </div>

                                <div className="border-t border-white/5 pt-6 flex justify-end gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setActiveTab('bots')}
                                        className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all"
                                    >
                                        {isSubmitting ? "Deploying..." : "Launch Bot Instance"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {/* BOT HISTORY TAB */}
                    {activeTab === 'history' && selectedBotId && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="glass-morphic-card rounded-[32px] overflow-hidden border-white/5"
                        >
                            <div className="p-6 md:p-8 bg-white/[0.01] border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-xl font-bold text-white font-outfit">
                                        Trade Log: {bots.find(b => b.id === selectedBotId)?.name}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">
                                        Chronological list of all executions performed by this automated strategy bot.
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setSelectedBotId(null)}
                                    className="text-xs font-semibold text-slate-400 hover:text-white bg-white/5 px-4 py-2 rounded-xl transition-all"
                                >
                                    Close Logs
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                {loadingHistory ? (
                                    <div className="p-20 text-center text-slate-500 text-sm font-medium flex justify-center items-center gap-2">
                                        <RefreshCw className="animate-spin text-slate-500" size={18} /> Loading execution log...
                                    </div>
                                ) : historyTrades.length === 0 ? (
                                    <div className="p-20 text-center text-slate-500 text-sm font-medium flex flex-col items-center">
                                        <Activity size={32} className="text-slate-700 mb-3" />
                                        No executions recorded yet. This bot is waiting for qualified strategy signals.
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white/[0.02] text-slate-500 text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                                                <th className="px-6 py-4 md:py-5 font-bold">Execution Date</th>
                                                <th className="px-6 py-4 md:py-5 font-bold">Symbol</th>
                                                <th className="px-6 py-4 md:py-5 font-bold">Type</th>
                                                <th className="px-6 py-4 md:py-5 font-bold">Shares</th>
                                                <th className="px-6 py-4 md:py-5 font-bold">Execution Price</th>
                                                <th className="px-6 py-4 md:py-5 font-bold">Total Value</th>
                                                <th className="px-6 py-4 md:py-5 font-bold text-right">Realized Return</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-sm">
                                            {historyTrades.map((t) => (
                                                <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="px-6 py-4 text-slate-400 font-medium">
                                                        {new Date(t.timestamp).toLocaleString("en-IN", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            hour: "2-digit",
                                                            minute: "2-digit"
                                                        })}
                                                    </td>
                                                    <td className="px-6 py-4 text-white font-bold tracking-tight">
                                                        {formatSymbol(t.symbol)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-bold tracking-wider",
                                                            t.type === 'BUY' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                                        )}>
                                                            {t.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-300 font-mono font-medium">
                                                        {t.quantity}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-300 font-mono font-medium">
                                                        {formatCurrency(t.price)}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-300 font-mono font-medium">
                                                        {formatCurrency(t.totalValue)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {t.realizedPL !== undefined ? (
                                                            <span className={cn(
                                                                "font-mono font-bold",
                                                                t.realizedPL >= 0 ? "text-emerald-400" : "text-rose-400"
                                                            )}>
                                                                {t.realizedPL >= 0 ? "+" : ""}
                                                                {formatCurrency(t.realizedPL)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500 font-medium">--</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function BotCard({ 
    bot, 
    onToggleStatus, 
    onDelete, 
    onViewHistory, 
    actionLoading 
}: { 
    bot: BotData; 
    onToggleStatus: (id: string, stat: string) => void;
    onDelete: (id: string) => void;
    onViewHistory: (id: string) => void;
    actionLoading: string | null;
}) {
    const isRunning = bot.status === 'ACTIVE';
    const isProfit = bot.totalPnL >= 0;
    const totalTrades = bot.totalTradesExecuted;
    const winRate = totalTrades > 0 ? ((bot.winCount / totalTrades) * 100).toFixed(0) : "0";

    return (
        <div className="glass-morphic-card rounded-3xl p-6 sm:p-7 border-white/5 bg-white/[0.01] hover:border-white/10 transition-all flex flex-col justify-between group">
            <div>
                {/* Bot Identity Header */}
                <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h4 className="text-lg font-bold text-white tracking-tight">{bot.name}</h4>
                            <span className={cn(
                                "h-2 w-2 rounded-full",
                                bot.status === 'ACTIVE' ? "bg-emerald-500 animate-pulse" : bot.status === 'PAUSED' ? "bg-amber-500" : "bg-rose-500"
                            )}></span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                            Strategy: <span className="text-indigo-400 font-semibold">{bot.strategyName}</span>
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => onToggleStatus(bot.id, bot.status)}
                            disabled={actionLoading === bot.id}
                            title={isRunning ? "Pause Bot" : "Resume Bot"}
                            className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center border transition-all",
                                isRunning 
                                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20" 
                                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            )}
                        >
                            {actionLoading === bot.id ? (
                                <RefreshCw className="animate-spin" size={14} />
                            ) : isRunning ? (
                                <Pause size={14} />
                            ) : (
                                <Play size={14} />
                            )}
                        </button>
                        <button
                            onClick={() => onDelete(bot.id)}
                            disabled={actionLoading === bot.id}
                            title="Delete Bot"
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Performance overview */}
                <div className="grid grid-cols-3 gap-4 my-6 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Bot P&L</span>
                        <span className={cn(
                            "text-sm font-mono font-bold mt-1 block",
                            isProfit ? "text-emerald-400" : "text-rose-400"
                        )}>
                            {isProfit ? "+" : ""}
                            {formatCurrency(bot.totalPnL)}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Win Rate</span>
                        <span className="text-sm font-mono font-bold text-slate-300 mt-1 block">
                            {winRate}% <span className="text-xs text-slate-500">({bot.winCount} w)</span>
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Daily limit</span>
                        <span className="text-sm font-mono font-bold text-slate-300 mt-1 block">
                            {bot.todayTradeCount} / {bot.maxTradesPerDay}
                        </span>
                    </div>
                </div>

                {/* Configurations parameters list */}
                <div className="space-y-2.5 text-xs font-semibold text-slate-400">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Capital Limit:</span>
                        <span className="text-slate-300 font-mono">{formatCurrency(bot.capitalAllocated)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Execution Filters:</span>
                        <span className="text-indigo-400 font-mono">Confluence Score &ge; {bot.minConfluenceScore}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Max Sizing / Trade:</span>
                        <span className="text-slate-300 font-mono">{bot.maxPositionSizePercent}% of capital</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Risk Target bounds:</span>
                        <span className="text-slate-300 font-mono">SL: -{bot.stopLossPercent}% | TP: +{bot.takeProfitPercent}%</span>
                    </div>
                </div>
            </div>

            <div className="border-t border-white/5 mt-6 pt-4 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Status: <span className={cn(
                        "font-semibold",
                        isRunning ? "text-emerald-400" : "text-rose-400"
                    )}>{bot.status}</span>
                </span>
                <button
                    onClick={() => onViewHistory(bot.id)}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                >
                    <History size={12} /> Execution Logs
                </button>
            </div>
        </div>
    );
}
