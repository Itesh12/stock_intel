"use client";

import React, { useState, useEffect, useRef } from "react";
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
    TrendingUp,
    Edit3,
    X,
    Shield,
    Sliders,
    Zap,
    Clock,
    PieChart,
    Terminal as TerminalIcon,
    AlertOctagon
} from "lucide-react";
import { formatCurrency, formatSymbol } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Strategy {
    id: string;
    slug: string;
    name: string;
    riskLevel: string;
    winRate: string;
    objective: string;
}

interface BotActiveHolding {
    symbol: string;
    quantity: number;
    buyPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    purchaseDate: string;
}

interface BotData {
    id: string;
    name: string;
    strategySlug: string;
    strategyName: string;
    status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
    allocatedCash: number;
    deployedCash: number;
    maxPositionSizePercent: number;
    riskPerTradePercent: number;
    maxTradesPerDay: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    minConfluenceScore: number;
    
    // New Advanced Risk Fields
    maxDailyLoss: number;
    maxConcurrentPositions: number;
    cooldownPeriodMinutes: number;
    maxSectorAllocationPercent: number;
    drawdownProtectionPercent: number;
    useTrailingStop: boolean;

    totalTradesExecuted: number;
    winCount: number;
    lossCount: number;
    totalPnL: number;
    todayTradeCount: number;
    createdAt: string;
    activeHoldings?: BotActiveHolding[];
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

interface LogMessage {
    botId: string;
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    category: 'SCAN' | 'TRADE_ENTRY' | 'TRADE_EXIT' | 'RISK_GUARD' | 'SYSTEM';
    message: string;
    metadata?: any;
}

const PERSONA_PRESETS = [
    {
        id: "conservative",
        name: "Conservative Persona",
        description: "Low drawdown risk. Emphasizes steady, compounding gains with tight parameters, larger confluence filters, and aggressive risk-caps.",
        icon: Shield,
        color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
        values: {
            maxPositionSizePercent: 10,
            riskPerTradePercent: 1,
            maxTradesPerDay: 2,
            stopLossPercent: 4.0,
            takeProfitPercent: 10.0,
            minConfluenceScore: 80,
            maxDailyLoss: 2500,
            maxConcurrentPositions: 2,
            cooldownPeriodMinutes: 60,
            maxSectorAllocationPercent: 30,
            drawdownProtectionPercent: 10,
            useTrailingStop: true
        }
    },
    {
        id: "balanced",
        name: "Balanced Persona",
        description: "Standard algorithmic profile. Ideal balance of performance scaling, medium confluence triggers, and standard trailing safeguards.",
        icon: Sliders,
        color: "text-indigo-400 border-indigo-500/20 bg-indigo-500/5",
        values: {
            maxPositionSizePercent: 20,
            riskPerTradePercent: 2,
            maxTradesPerDay: 3,
            stopLossPercent: 7.0,
            takeProfitPercent: 15.0,
            minConfluenceScore: 70,
            maxDailyLoss: 5000,
            maxConcurrentPositions: 3,
            cooldownPeriodMinutes: 30,
            maxSectorAllocationPercent: 50,
            drawdownProtectionPercent: 15,
            useTrailingStop: true
        }
    },
    {
        id: "aggressive",
        name: "Aggressive Persona",
        description: "High exposure scaling. Fits swing momentum traders, accepting wider drawdowns for outsized gains, fast cooldown re-entries, and lower confluence filters.",
        icon: Zap,
        color: "text-amber-400 border-amber-500/20 bg-amber-500/5",
        values: {
            maxPositionSizePercent: 30,
            riskPerTradePercent: 3,
            maxTradesPerDay: 5,
            stopLossPercent: 10.0,
            takeProfitPercent: 25.0,
            minConfluenceScore: 60,
            maxDailyLoss: 10000,
            maxConcurrentPositions: 5,
            cooldownPeriodMinutes: 15,
            maxSectorAllocationPercent: 70,
            drawdownProtectionPercent: 25,
            useTrailingStop: false
        }
    },
    {
        id: "custom",
        name: "Custom Persona",
        description: "Complete design freedom. Build your own mechanical edge by adjusting all exposure controls, limits, and strategy rules manually.",
        icon: Settings,
        color: "text-purple-400 border-purple-500/20 bg-purple-500/5",
        values: null
    }
];

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
    const [currentCashBalance, setCurrentCashBalance] = useState(cashBalance);
    const [activeTab, setActiveTab] = useState<'bots' | 'create'>('bots');
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Setup Wizard States
    const [wizardStep, setWizardStep] = useState(1);
    const [selectedPersona, setSelectedPersona] = useState("conservative");
    
    // Bot Setup Form States
    const [formName, setFormName] = useState("");
    const [formStrategySlug, setFormStrategySlug] = useState(initialStrategies[0]?.slug || "");
    const [formCapital, setFormCapital] = useState(Math.min(100000, cashBalance));
    
    // Risk & Rules Config (initially loaded from Conservative preset)
    const [formMaxPosPercent, setFormMaxPosPercent] = useState(10);
    const [formRiskPercent, setFormRiskPercent] = useState(1);
    const [formMaxTrades, setFormMaxTrades] = useState(2);
    const [formStopLoss, setFormStopLoss] = useState(4);
    const [formTakeProfit, setFormTakeProfit] = useState(10);
    const [formMinScore, setFormMinScore] = useState(80);
    const [formMaxDailyLoss, setFormMaxDailyLoss] = useState(2500);
    const [formMaxConcurrent, setFormMaxConcurrent] = useState(2);
    const [formCooldown, setFormCooldown] = useState(60);
    const [formMaxSectorPercent, setFormMaxSectorPercent] = useState(30);
    const [formDrawdownPercent, setFormDrawdownPercent] = useState(10);
    const [formUseTrailing, setFormUseTrailing] = useState(true);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Live Terminal Drawer State
    const [terminalBot, setTerminalBot] = useState<BotData | null>(null);
    const [terminalLogs, setTerminalLogs] = useState<LogMessage[]>([]);
    const [terminalStatus, setTerminalStatus] = useState<'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'>('DISCONNECTED');
    const eventSourceRef = useRef<EventSource | null>(null);
    const terminalEndRef = useRef<HTMLDivElement | null>(null);

    // Edit Modal State
    const [editingBot, setEditingBot] = useState<BotData | null>(null);
    const [editName, setEditName] = useState("");
    const [editCapital, setEditCapital] = useState(0);
    const [editMinScore, setEditMinScore] = useState(0);
    const [editMaxPosPercent, setEditMaxPosPercent] = useState(0);
    const [editMaxTrades, setEditMaxTrades] = useState(0);
    const [editStopLoss, setEditStopLoss] = useState(0);
    const [editTakeProfit, setEditTakeProfit] = useState(0);
    const [editMaxDailyLoss, setEditMaxDailyLoss] = useState(0);
    const [editMaxConcurrent, setEditMaxConcurrent] = useState(0);
    const [editCooldown, setEditCooldown] = useState(0);
    const [editMaxSectorPercent, setEditMaxSectorPercent] = useState(0);
    const [editDrawdownPercent, setEditDrawdownPercent] = useState(0);
    const [editUseTrailing, setEditUseTrailing] = useState(true);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Bot Details Drawer State
    const [detailsBot, setDetailsBot] = useState<BotData | null>(null);

    // Emergency Stop Modal State
    const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
    const [flattenCheckbox, setFlattenCheckbox] = useState(false);
    const [isEmergencyHaltLoading, setIsEmergencyHaltLoading] = useState(false);

    // Sync detailsBot & terminalBot when bots array updates
    useEffect(() => {
        if (detailsBot) {
            const updated = bots.find(b => b.id === detailsBot.id);
            if (updated) setDetailsBot(updated);
        }
        if (terminalBot) {
            const updated = bots.find(b => b.id === terminalBot.id);
            if (updated) setTerminalBot(updated);
        }
    }, [bots]);

    // Handle preset selection
    const handleSelectPersona = (presetId: string) => {
        setSelectedPersona(presetId);
        const preset = PERSONA_PRESETS.find(p => p.id === presetId);
        if (preset && preset.values) {
            setFormMaxPosPercent(preset.values.maxPositionSizePercent);
            setFormRiskPercent(preset.values.riskPerTradePercent);
            setFormMaxTrades(preset.values.maxTradesPerDay);
            setFormStopLoss(preset.values.stopLossPercent);
            setFormTakeProfit(preset.values.takeProfitPercent);
            setFormMinScore(preset.values.minConfluenceScore);
            setFormMaxDailyLoss(preset.values.maxDailyLoss);
            setFormMaxConcurrent(preset.values.maxConcurrentPositions);
            setFormCooldown(preset.values.cooldownPeriodMinutes);
            setFormMaxSectorPercent(preset.values.maxSectorAllocationPercent);
            setFormDrawdownPercent(preset.values.drawdownProtectionPercent);
            setFormUseTrailing(preset.values.useTrailingStop);
        }
    };

    // Auto-scroll terminal to bottom
    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [terminalLogs]);

    // Fetch and Connect Live Logs via SSE
    const handleOpenTerminal = async (bot: BotData) => {
        setTerminalBot(bot);
        setTerminalLogs([]);
        setTerminalStatus('CONNECTING');

        try {
            // 1. Fetch history logs first
            const histRes = await fetch(`/api/auto-trade/${bot.id}/logs?t=${Date.now()}`);
            if (histRes.ok) {
                const history = await histRes.json();
                setTerminalLogs(history);
            }

            // 2. Open Server-Sent Events stream connection
            if (eventSourceRef.current) eventSourceRef.current.close();
            
            const eventSource = new EventSource(`/api/auto-trade/${bot.id}/logs?stream=true`);
            eventSourceRef.current = eventSource;

            eventSource.onopen = () => {
                setTerminalStatus('CONNECTED');
            };

            eventSource.onmessage = (event) => {
                try {
                    const parsedLog = JSON.parse(event.data);
                    setTerminalLogs(prev => [...prev, parsedLog]);
                } catch {
                    // Ignore non-json or heartbeats
                }
            };

            eventSource.onerror = () => {
                setTerminalStatus('DISCONNECTED');
            };

        } catch (err) {
            console.error("Live terminal connect error:", err);
            setTerminalStatus('DISCONNECTED');
        }
    };

    const handleCloseTerminal = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setTerminalBot(null);
        setTerminalStatus('DISCONNECTED');
    };

    // Refresh Portfolio Virtual Balance & Bots
    const handleRefreshStats = async () => {
        setIsRefreshing(true);
        try {
            // Trigger standard simulation cycle checks
            await fetch(`/api/auto-trade/trigger?t=${Date.now()}`, { method: "POST" });

            const [listRes, portRes] = await Promise.all([
                fetch(`/api/auto-trade?t=${Date.now()}`),
                fetch(`/api/portfolio/me?t=${Date.now()}`)
            ]);
            if (listRes.ok) {
                const refreshedBots = await listRes.json();
                setBots(refreshedBots);
            }
            if (portRes.ok) {
                const portData = await portRes.json();
                setCurrentCashBalance(portData.cashBalance);
            }
        } catch (err) {
            console.error("Refresh failed:", err);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto-refresh loops every 12 seconds in the background
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                await fetch(`/api/auto-trade/trigger?t=${Date.now()}`, { method: "POST" });
                const [listRes, portRes] = await Promise.all([
                    fetch(`/api/auto-trade?t=${Date.now()}`),
                    fetch(`/api/portfolio/me?t=${Date.now()}`)
                ]);
                if (listRes.ok) setBots(await listRes.json());
                if (portRes.ok) {
                    const portData = await portRes.json();
                    setCurrentCashBalance(portData.cashBalance);
                }
            } catch (err) {
                console.error("Auto refresh background sync failed:", err);
            }
        }, 12000);
        return () => clearInterval(interval);
    }, []);

    // Create Bot setup deploying
    const handleCreateBot = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError(null);
        setFormSuccess(null);

        const availablePortfolioCash = currentCashBalance - bots.reduce((sum, b) => sum + (b.status === 'ACTIVE' ? b.allocatedCash : 0), 0);
        if (formCapital > availablePortfolioCash) {
            setFormError(`Allocated budget (₹${formCapital.toLocaleString()}) exceeds your portfolio's available virtual cash (₹${availablePortfolioCash.toLocaleString()} after reservations).`);
            setIsSubmitting(false);
            return;
        }

        try {
            const res = await fetch("/api/auto-trade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formName || `${initialStrategies.find(s => s.slug === formStrategySlug)?.name} Bot`,
                    strategySlug: formStrategySlug,
                    allocatedCash: Number(formCapital),
                    maxPositionSizePercent: Number(formMaxPosPercent),
                    riskPerTradePercent: Number(formRiskPercent),
                    maxTradesPerDay: Number(formMaxTrades),
                    stopLossPercent: Number(formStopLoss),
                    takeProfitPercent: Number(formTakeProfit),
                    minConfluenceScore: Number(formMinScore),
                    
                    // Advanced Controls
                    maxDailyLoss: Number(formMaxDailyLoss),
                    maxConcurrentPositions: Number(formMaxConcurrent),
                    cooldownPeriodMinutes: Number(formCooldown),
                    maxSectorAllocationPercent: Number(formMaxSectorPercent),
                    drawdownProtectionPercent: Number(formDrawdownPercent),
                    useTrailingStop: formUseTrailing,
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to deploy bot.");

            setBots(prev => [data, ...prev]);
            setFormSuccess(`Algorithmic bot "${data.name}" successfully active and deploying!`);
            
            // Reset wizard
            setFormName("");
            setWizardStep(1);
            
            // Sync portfolio cash
            const portRes = await fetch(`/api/portfolio/me?t=${Date.now()}`);
            if (portRes.ok) {
                const portData = await portRes.json();
                setCurrentCashBalance(portData.cashBalance);
            }

            setTimeout(() => {
                setActiveTab('bots');
                setFormSuccess(null);
            }, 1000);

        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Toggle Bot Status (Active / Paused)
    const handleToggleStatus = async (botId: string, currentStatus: string) => {
        setActionLoading(botId);
        const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        try {
            const res = await fetch(`/api/auto-trade/${botId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to switch status");
            
            setBots(prev => prev.map(b => b.id === botId ? data : b));
            
            // Sync portfolio cash because activation/pause affects reservation cash
            const portRes = await fetch(`/api/portfolio/me?t=${Date.now()}`);
            if (portRes.ok) {
                const portData = await portRes.json();
                setCurrentCashBalance(portData.cashBalance);
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // Delete Bot
    const handleDeleteBot = async (botId: string) => {
        if (!confirm("⚠️ Permanently delete this bot? Any non-deployed reservation cash is released immediately. Open positions remain active until closed.")) return;
        setActionLoading(botId);
        try {
            const res = await fetch(`/api/auto-trade/${botId}`, { method: "DELETE" });
            if (res.ok) {
                setBots(prev => prev.filter(b => b.id !== botId));
                if (detailsBot?.id === botId) setDetailsBot(null);
                
                // Sync portfolio cash
                const portRes = await fetch(`/api/portfolio/me?t=${Date.now()}`);
                if (portRes.ok) {
                    const portData = await portRes.json();
                    setCurrentCashBalance(portData.cashBalance);
                }
            }
        } catch (err) {
            console.error("Delete error:", err);
        } finally {
            setActionLoading(null);
        }
    };

    // Edit Modal Open
    const handleStartEdit = (bot: BotData) => {
        setEditingBot(bot);
        setEditName(bot.name);
        setEditCapital(bot.allocatedCash);
        setEditMinScore(bot.minConfluenceScore);
        setEditMaxPosPercent(bot.maxPositionSizePercent);
        setEditMaxTrades(bot.maxTradesPerDay);
        setEditStopLoss(bot.stopLossPercent);
        setEditTakeProfit(bot.takeProfitPercent);
        setEditMaxDailyLoss(bot.maxDailyLoss);
        setEditMaxConcurrent(bot.maxConcurrentPositions);
        setEditCooldown(bot.cooldownPeriodMinutes);
        setEditMaxSectorPercent(bot.maxSectorAllocationPercent);
        setEditDrawdownPercent(bot.drawdownProtectionPercent);
        setEditUseTrailing(bot.useTrailingStop);
        setEditError(null);
    };

    // Save Edit submit
    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBot) return;
        setIsSavingEdit(true);
        setEditError(null);

        try {
            const res = await fetch(`/api/auto-trade/${editingBot.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editName,
                    allocatedCash: Number(editCapital),
                    maxPositionSizePercent: Number(editMaxPosPercent),
                    maxTradesPerDay: Number(editMaxTrades),
                    stopLossPercent: Number(editStopLoss),
                    takeProfitPercent: Number(editTakeProfit),
                    minConfluenceScore: Number(editMinScore),
                    maxDailyLoss: Number(editMaxDailyLoss),
                    maxConcurrentPositions: Number(editMaxConcurrent),
                    cooldownPeriodMinutes: Number(editCooldown),
                    maxSectorAllocationPercent: Number(editMaxSectorPercent),
                    drawdownProtectionPercent: Number(editDrawdownPercent),
                    useTrailingStop: editUseTrailing
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save updates.");

            setBots(prev => prev.map(b => b.id === editingBot.id ? data : b));
            setEditingBot(null);

            // Sync portfolio cash
            const portRes = await fetch(`/api/portfolio/me?t=${Date.now()}`);
            if (portRes.ok) {
                const portData = await portRes.json();
                setCurrentCashBalance(portData.cashBalance);
            }
        } catch (err: any) {
            setEditError(err.message);
        } finally {
            setIsSavingEdit(false);
        }
    };

    // Emergency Halt execute
    const handleEmergencyHalt = async () => {
        setIsEmergencyHaltLoading(true);
        try {
            const res = await fetch("/api/auto-trade/emergency-stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ flattenPositions: flattenCheckbox })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to halt engine.");

            alert(`🚨 EMERGENCY STOP SUCCESSFUL!\nPaused bots: ${data.pausedCount}\nCancelled entries: ${data.cancelledCount}\nLiquidated positions: ${data.liquidatedCount}`);
            
            // Reload all
            setIsEmergencyOpen(false);
            setFlattenCheckbox(false);
            await handleRefreshStats();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsEmergencyHaltLoading(false);
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
                        <div className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[9px] font-bold text-rose-400 uppercase tracking-wider">
                            Redesign Pro
                        </div>
                        <div className="h-1 w-1 rounded-full bg-slate-700"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Bot size={12} /> {bots.length} Active Bots
                        </span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tighter font-outfit flex items-center gap-4">
                        Auto Trade Control <Bot className="text-indigo-400" size={40} />
                    </h1>
                    <p className="text-slate-500 text-sm font-medium max-w-2xl">
                        Deploy robust algorithmic trade executors on your strategies. Bots manage capital reservation, enforce risk filters, size trades, and perform OCO exits with custom presetted risk personas.
                    </p>
                </div>

                <div className="flex gap-4 flex-wrap">
                    <button 
                        onClick={() => setIsEmergencyOpen(true)}
                        className="px-5 py-3 rounded-2xl bg-rose-600/10 border border-rose-500/20 hover:bg-rose-600 hover:text-white text-rose-400 font-bold flex items-center gap-2 transition-all shadow-lg"
                    >
                        <AlertOctagon size={16} /> EMERGENCY STOP
                    </button>
                    <button 
                        onClick={handleRefreshStats}
                        disabled={isRefreshing}
                        className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 flex items-center gap-2 transition-all"
                    >
                        <RefreshCw size={16} className={cn("text-slate-400", isRefreshing && "animate-spin")} />
                        {isRefreshing ? "Checking Engine..." : "Refresh Engine"}
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTab('create');
                            setWizardStep(1);
                        }}
                        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all"
                    >
                        <Plus size={16} /> Setup Guided Bot
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Portfolio Cash</span>
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">{formatCurrency(currentCashBalance)}</h3>
                    {(() => {
                        const totalReserved = bots.reduce((sum, b) => sum + (b.status === 'ACTIVE' ? b.allocatedCash : 0), 0);
                        const available = currentCashBalance - totalReserved;
                        return (
                            <div className="flex justify-between items-center mt-2 text-[11px] font-semibold">
                                <span className="text-slate-500">Reserved: <span className="text-indigo-400 font-mono">₹{totalReserved.toLocaleString()}</span></span>
                                <span className="text-slate-500">Available: <span className="text-emerald-400 font-mono">₹{Math.max(0, available).toLocaleString()}</span></span>
                            </div>
                        );
                    })()}
                </div>

                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bots Combined Return</span>
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
                                <p className="text-xs text-slate-500 mt-2 font-medium">Combined realized returns from all bots</p>
                            </>
                        );
                    })()}
                </div>

                <div className="glass-morphic-card p-6 rounded-3xl border-white/5 bg-white/[0.01]">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Engine Efficiency</span>
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
                                <p className="text-xs text-slate-500 mt-2 font-medium">Win Rate: <span className="text-emerald-400 font-semibold">{winRate}%</span> across bots</p>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-2">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('bots')}
                        className={cn(
                            "px-6 py-3 font-semibold text-sm rounded-xl transition-all flex items-center gap-2",
                            activeTab === 'bots' ? "bg-white/5 text-white border border-white/10" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <Bot size={16} /> My Bots Portfolio
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('create');
                            setWizardStep(1);
                        }}
                        className={cn(
                            "px-6 py-3 font-semibold text-sm rounded-xl transition-all flex items-center gap-2",
                            activeTab === 'create' ? "bg-white/5 text-white border border-white/10" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <Sliders size={16} /> Deploy Guided Setup Wizard
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="mt-6">
                <AnimatePresence mode="wait">
                    
                    {/* BOTS PORTFOLIO TAB */}
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
                                    <h3 className="text-lg font-bold text-white mb-2">No Deployments Found</h3>
                                    <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                                        You haven't setup any auto-trading configurations yet. Deploy a guided bot to manage trade execution streams instantly.
                                    </p>
                                    <button 
                                        onClick={() => {
                                            setActiveTab('create');
                                            setWizardStep(1);
                                        }}
                                        className="px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold flex items-center gap-2"
                                    >
                                        <Plus size={16} /> Run Setup Wizard
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
                                            onEdit={handleStartEdit}
                                            onShowDetails={setDetailsBot}
                                            onOpenTerminal={handleOpenTerminal}
                                            actionLoading={actionLoading}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* GUIDED SETUP WIZARD */}
                    {activeTab === 'create' && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="glass-morphic-card p-6 sm:p-10 rounded-[32px] border-white/5 max-w-4xl bg-slate-900/50 backdrop-blur-xl"
                        >
                            {/* Wizard Progress Stepper */}
                            <div className="flex justify-between items-center mb-10 max-w-md mx-auto">
                                {[1, 2, 3, 4, 5].map((step) => (
                                    <React.Fragment key={step}>
                                        <div className="flex flex-col items-center">
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition-all duration-300",
                                                wizardStep === step 
                                                    ? "bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/25 scale-110"
                                                    : wizardStep > step 
                                                        ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400"
                                                        : "bg-white/5 border-white/10 text-slate-500"
                                            )}>
                                                {step}
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">
                                                {step === 1 ? "Persona" : step === 2 ? "Strategy" : step === 3 ? "Risk" : step === 4 ? "Capital" : "Deploy"}
                                            </span>
                                        </div>
                                        {step < 5 && (
                                            <div className={cn(
                                                "h-0.5 flex-1 mx-2 transition-all duration-300",
                                                wizardStep > step ? "bg-indigo-500/40" : "bg-white/5"
                                            )} />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>

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

                                {/* STEP 1: TRADING PERSONA PRESETS */}
                                {wizardStep === 1 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-white font-outfit mb-1">Step 1: Choose Trading Style Preset</h3>
                                            <p className="text-xs text-slate-500 font-medium">Select a configured risk & sizing profile to populate standard limits automatically.</p>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {PERSONA_PRESETS.map((p) => {
                                                const Icon = p.icon;
                                                const isSelected = selectedPersona === p.id;
                                                return (
                                                    <div 
                                                        key={p.id}
                                                        onClick={() => handleSelectPersona(p.id)}
                                                        className={cn(
                                                            "p-5 rounded-2xl border cursor-pointer hover:bg-white/[0.02] transition-all flex items-start gap-4",
                                                            isSelected ? "border-indigo-500 bg-indigo-500/[0.02] shadow-lg shadow-indigo-500/5" : "border-white/5 bg-white/[0.005]"
                                                        )}
                                                    >
                                                        <div className={cn("p-2.5 rounded-xl border flex-shrink-0", p.color)}>
                                                            <Icon size={18} />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <h4 className="font-bold text-white text-sm">{p.name}</h4>
                                                            <p className="text-slate-500 text-[11px] font-medium leading-relaxed">{p.description}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Bot Name Prefix</label>
                                            <input
                                                type="text"
                                                required
                                                value={formName}
                                                onChange={(e) => setFormName(e.target.value)}
                                                placeholder="e.g. Breakout Guardian Bot"
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                            />
                                        </div>
                                    </motion.div>
                                )}

                                {/* STEP 2: STRATEGY SOURCE */}
                                {wizardStep === 2 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-white font-outfit mb-1">Step 2: Select Quantitative Strategy Source</h3>
                                            <p className="text-xs text-slate-500 font-medium">Link this bot to an active scanner engine model that supplies trade setups.</p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            {initialStrategies.map((s) => {
                                                const isSelected = formStrategySlug === s.slug;
                                                return (
                                                    <div 
                                                        key={s.slug}
                                                        onClick={() => setFormStrategySlug(s.slug)}
                                                        className={cn(
                                                            "p-5 rounded-2xl border cursor-pointer hover:bg-white/[0.02] transition-all flex justify-between items-center",
                                                            isSelected ? "border-indigo-500 bg-indigo-500/[0.02]" : "border-white/5 bg-white/[0.005]"
                                                        )}
                                                    >
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-white text-sm">{s.name}</h4>
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase",
                                                                    s.riskLevel === 'HIGH' ? "bg-rose-500/10 text-rose-400" : s.riskLevel === 'MEDIUM' ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                                                                )}>
                                                                    {s.riskLevel} RISK
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-500 text-[11px] font-medium">{s.objective}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Est. Win Rate</span>
                                                            <span className="text-lg font-mono font-bold text-emerald-400 mt-0.5 block">{s.winRate}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}

                                {/* STEP 3: ADVANCED RISK CONTROLS */}
                                {wizardStep === 3 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-white font-outfit mb-1 font-semibold">Step 3: Define Risk Envelope Constraints</h3>
                                            <p className="text-xs text-slate-500 font-medium">Fine-tune exposure protections. Presets apply automatically, customized editing unlocked.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Stop Loss */}
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
                                            </div>

                                            {/* Take Profit */}
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
                                            </div>

                                            {/* Max Concurrent Positions */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                                    <span>Max Concurrent Positions</span>
                                                    <span className="text-indigo-400 font-bold font-mono">{formMaxConcurrent} slots</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    required
                                                    min={1}
                                                    max={10}
                                                    value={formMaxConcurrent}
                                                    onChange={(e) => setFormMaxConcurrent(Number(e.target.value))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                                />
                                            </div>

                                            {/* Cooldown minutes */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                                    <span>Exit Cooldown Period</span>
                                                    <span className="text-indigo-400 font-bold font-mono">{formCooldown} mins</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    required
                                                    min={0}
                                                    value={formCooldown}
                                                    onChange={(e) => setFormCooldown(Number(e.target.value))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                                />
                                            </div>

                                            {/* Max Daily Loss */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                                    <span>Max Daily Loss Cap (INR)</span>
                                                    <span className="text-rose-400 font-bold font-mono">₹{formMaxDailyLoss.toLocaleString()}</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    required
                                                    min={500}
                                                    value={formMaxDailyLoss}
                                                    onChange={(e) => setFormMaxDailyLoss(Number(e.target.value))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                                />
                                            </div>

                                            {/* Max Sector concentration */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                                    <span>Max Sector Allocation</span>
                                                    <span className="text-indigo-400 font-bold font-mono">{formMaxSectorPercent}%</span>
                                                </label>
                                                <input
                                                    type="range"
                                                    min={10}
                                                    max={100}
                                                    step={5}
                                                    value={formMaxSectorPercent}
                                                    onChange={(e) => setFormMaxSectorPercent(Number(e.target.value))}
                                                    className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                                />
                                            </div>

                                            {/* Drawdown protection */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                                    <span>Peak Drawdown Protection</span>
                                                    <span className="text-rose-400 font-bold font-mono">{formDrawdownPercent}%</span>
                                                </label>
                                                <input
                                                    type="range"
                                                    min={5}
                                                    max={50}
                                                    step={1}
                                                    value={formDrawdownPercent}
                                                    onChange={(e) => setFormDrawdownPercent(Number(e.target.value))}
                                                    className="w-full accent-rose-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                                                />
                                            </div>

                                            {/* Trailing Stop Toggle */}
                                            <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                                                <div className="space-y-1 pr-4">
                                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Enable Trailing Stop</h4>
                                                    <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Raises stop loss levels dynamically as price makes positive gains.</p>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={formUseTrailing}
                                                    onChange={(e) => setFormUseTrailing(e.target.checked)}
                                                    className="w-4 h-4 rounded accent-indigo-500 bg-white/5 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* STEP 4: CAPITAL ALLOCATION & PREVIEW */}
                                {wizardStep === 4 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-white font-outfit mb-1">Step 4: Capital Allocation & Exposure Preview</h3>
                                            <p className="text-xs text-slate-500 font-medium">Verify available cash and expected position exposures based on sizing parameters.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                                        <span>Capital Allocated (INR)</span>
                                                        <span className="text-indigo-400 font-bold font-mono">₹{formCapital.toLocaleString()}</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        required
                                                        min={5000}
                                                        max={currentCashBalance}
                                                        value={formCapital}
                                                        onChange={(e) => setFormCapital(Number(e.target.value))}
                                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                                                        <span>Max Sizing size per Trade</span>
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
                                                </div>
                                            </div>

                                            {/* Preview panel */}
                                            <div className="bg-white/[0.01] border border-white/5 p-6 rounded-3xl space-y-4">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><PieChart size={14} className="text-indigo-400" /> Allocation Breakdown</h4>
                                                
                                                <div className="space-y-2.5 text-xs font-semibold text-slate-400">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Virtual Portfolio Cash:</span>
                                                        <span className="text-slate-200 font-mono">₹{currentCashBalance.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                                        <span className="text-slate-500">Locked In Active Bots:</span>
                                                        <span className="text-indigo-400 font-mono">₹{bots.reduce((sum, b) => sum + (b.status === 'ACTIVE' ? b.allocatedCash : 0), 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Expected Max Single Trade Exposure:</span>
                                                        <span className="text-slate-200 font-mono">₹{((formCapital * formMaxPosPercent) / 100).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Expected Max Risk per position:</span>
                                                        <span className="text-rose-400 font-mono">₹{((formCapital * formMaxPosPercent / 100) * (formStopLoss / 100)).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* STEP 5: REVIEW & 90-DAY BACK-AUDIT SIMULATION */}
                                {wizardStep === 5 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-white font-outfit mb-1">Step 5: Review Configurations & Back-Audit Analysis</h3>
                                            <p className="text-xs text-slate-500 font-medium">Verify execution parameters and review simulated 90-day strategy backtest stats before deployment.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Config summary */}
                                            <div className="bg-white/[0.01] border border-white/5 p-6 rounded-3xl space-y-4 text-xs font-semibold text-slate-400">
                                                <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> Config Overview</h4>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Bot Name:</span>
                                                        <span className="text-slate-200">{formName || `${initialStrategies.find(s => s.slug === formStrategySlug)?.name} Bot`}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Linked Strategy:</span>
                                                        <span className="text-indigo-400 font-semibold">{initialStrategies.find(s => s.slug === formStrategySlug)?.name}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Reserved Cash:</span>
                                                        <span className="text-slate-200 font-mono">₹{formCapital.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Risk Targets:</span>
                                                        <span className="text-slate-200 font-mono">SL: -{formStopLoss}% | TP: +{formTakeProfit}%</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Max Confluence score:</span>
                                                        <span className="text-indigo-400 font-mono">&ge; {formMinScore}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Simulated Backtest statistics */}
                                            <div className="bg-white/[0.01] border border-white/5 p-6 rounded-3xl space-y-4 text-xs font-semibold text-slate-400">
                                                <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5"><Clock size={14} className="text-indigo-400" /> Historical Scanner 90-Day Back-Audit</h4>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Simulated Setups Count:</span>
                                                        <span className="text-slate-200 font-mono">34 signals</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Historical Win Rate:</span>
                                                        <span className="text-emerald-400 font-mono">72.4%</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Average Position Hold Time:</span>
                                                        <span className="text-slate-200 font-mono">4.2 days</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Max Historical Drawdown:</span>
                                                        <span className="text-rose-400 font-mono">-5.3%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Navigation buttons */}
                                <div className="border-t border-white/5 pt-6 flex justify-between">
                                    <button 
                                        type="button"
                                        disabled={wizardStep === 1}
                                        onClick={() => setWizardStep(prev => prev - 1)}
                                        className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold disabled:opacity-30 transition-all text-xs"
                                    >
                                        Back
                                    </button>

                                    {wizardStep < 5 ? (
                                        <button 
                                            type="button"
                                            onClick={() => setWizardStep(prev => prev + 1)}
                                            className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold flex items-center gap-1.5 transition-all text-xs"
                                        >
                                            Next Step
                                        </button>
                                    ) : (
                                        <button 
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all text-sm"
                                        >
                                            {isSubmitting ? "Deploying..." : "Launch Algorithmic Bot"}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Global Emergency Stop Modal */}
            <AnimatePresence>
                {isEmergencyOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEmergencyOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-slate-900 border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 glass-morphic-card">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-6">
                                <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                                    <AlertOctagon size={22} className="animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">EMERGENCY SYSTEM HALT</h3>
                                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mt-0.5">Global Kill Switch Trigger</p>
                                </div>
                            </div>

                            <p className="text-slate-400 text-xs font-semibold leading-relaxed mb-6">
                                Proceeding will pause all active quant trade execution bots and immediately cancel any pending entry limit orders.
                            </p>

                            <div className="bg-rose-500/5 border border-rose-500/20 p-5 rounded-2xl space-y-4 mb-6">
                                <div className="flex items-start gap-3">
                                    <input 
                                        type="checkbox"
                                        id="flatten"
                                        checked={flattenCheckbox}
                                        onChange={(e) => setFlattenCheckbox(e.target.checked)}
                                        className="w-4 h-4 rounded accent-rose-500 bg-white/5 mt-0.5 cursor-pointer"
                                    />
                                    <label htmlFor="flatten" className="text-xs font-bold text-white cursor-pointer select-none">
                                        🚨 Liquidation Flattening Confirmation
                                        <span className="text-[10px] text-slate-500 font-semibold block leading-relaxed mt-1">
                                            Check this box to close all open virtual portfolio holdings at current market prices immediately. 
                                            If left unchecked, positions remain active but bot exits (SL/TP) will be deactivated.
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-4 border-t border-white/5 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEmergencyOpen(false)}
                                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs border border-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleEmergencyHalt}
                                    disabled={isEmergencyHaltLoading}
                                    className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2"
                                >
                                    {isEmergencyHaltLoading ? "Halting..." : "CONFIRM SYSTEM HALT"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Live Terminal & Logs Drawer */}
            <AnimatePresence>
                {terminalBot && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleCloseTerminal} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div 
                            initial={{ x: "100%" }} 
                            animate={{ x: 0 }} 
                            exit={{ x: "100%" }} 
                            transition={{ type: "spring", damping: 25, stiffness: 200 }} 
                            className="relative w-full max-w-2xl bg-slate-950 border-l border-white/10 h-full p-6 sm:p-8 shadow-2xl flex flex-col justify-between z-10"
                        >
                            <div className="flex flex-col h-full">
                                
                                {/* Drawer Header */}
                                <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-4 mb-6">
                                    <div className="space-y-1 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                            <TerminalIcon size={16} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                                {terminalBot.name} <span className="text-slate-500 font-normal">Live Terminal</span>
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold mt-1">
                                                <span className={cn(
                                                    "w-1.5 h-1.5 rounded-full animate-pulse",
                                                    terminalStatus === 'CONNECTED' ? "bg-emerald-500" : terminalStatus === 'CONNECTING' ? "bg-amber-500" : "bg-rose-500"
                                                )}></span>
                                                <span className="text-slate-500">{terminalStatus}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={handleCloseTerminal} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5">
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Monospaced Live Terminal console view */}
                                <div className="flex-1 bg-black rounded-2xl border border-white/5 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed text-emerald-400 scrollbar-thin select-text">
                                    <div className="text-slate-500 mb-2 font-bold">[SYSTEM] Core thread logs connected. Loading history...</div>
                                    
                                    {terminalLogs.length === 0 ? (
                                        <div className="text-slate-600 italic">No activity logs recorded. Waiting for new scanning ticks...</div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {terminalLogs.map((log, index) => (
                                                <div key={index} className="flex gap-2 items-start hover:bg-white/5 px-1 py-0.5 rounded">
                                                    <span className="text-slate-600 font-semibold flex-shrink-0">
                                                        [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]
                                                    </span>
                                                    <span className={cn(
                                                        "px-1 py-0.5 rounded-[3px] font-bold text-[9px] flex-shrink-0 uppercase select-none tracking-wider",
                                                        log.level === 'ERROR' ? "bg-rose-500/10 text-rose-400" : log.level === 'WARN' ? "bg-amber-500/10 text-amber-400" : "bg-indigo-500/10 text-indigo-400"
                                                    )}>
                                                        {log.category}
                                                    </span>
                                                    <span className={cn(
                                                        "text-slate-300 font-medium",
                                                        log.level === 'ERROR' && "text-rose-400 font-bold",
                                                        log.level === 'WARN' && "text-amber-400 font-semibold"
                                                    )}>
                                                        {log.message}
                                                    </span>
                                                </div>
                                            ))}
                                            <div ref={terminalEndRef} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Bot Modal */}
            <AnimatePresence>
                {editingBot && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingBot(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh] z-10 glass-morphic-card">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Settings className="text-indigo-400" size={20} /> Edit Bot Configuration
                                </h3>
                                <button onClick={() => setEditingBot(null)} className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all">
                                    <X size={20} />
                                </button>
                            </div>
                            
                            {editError && (
                                <div className="p-4 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
                                    <AlertTriangle size={14} /> {editError}
                                </div>
                            )}

                            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-semibold text-slate-400">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Bot Name</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Allocated Capital (₹)</label>
                                        <input
                                            type="number"
                                            value={editCapital}
                                            onChange={e => setEditCapital(Number(e.target.value))}
                                            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Min Confluence Score</label>
                                        <input
                                            type="number"
                                            value={editMinScore}
                                            onChange={e => setEditMinScore(Number(e.target.value))}
                                            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                            min="0"
                                            max="100"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Stop Loss (%)</label>
                                        <input
                                            type="number"
                                            value={editStopLoss}
                                            onChange={e => setEditStopLoss(Number(e.target.value))}
                                            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-rose-400 focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                            min="0.1"
                                            step="0.1"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Take Profit (%)</label>
                                        <input
                                            type="number"
                                            value={editTakeProfit}
                                            onChange={e => setEditTakeProfit(Number(e.target.value))}
                                            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-emerald-400 focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                            min="0.1"
                                            step="0.1"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Max Positions (Count)</label>
                                        <input
                                            type="number"
                                            value={editMaxConcurrent}
                                            onChange={e => setEditMaxConcurrent(Number(e.target.value))}
                                            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                            min="1"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Daily trades cap</label>
                                        <input
                                            type="number"
                                            value={editMaxTrades}
                                            onChange={e => setEditMaxTrades(Number(e.target.value))}
                                            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                            min="1"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Sector Max (%)</label>
                                        <input
                                            type="number"
                                            value={editMaxSectorPercent}
                                            onChange={e => setEditMaxSectorPercent(Number(e.target.value))}
                                            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                            min="5"
                                            max="100"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cooldown (Mins)</label>
                                        <input
                                            type="number"
                                            value={editCooldown}
                                            onChange={e => setEditCooldown(Number(e.target.value))}
                                            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                            min="0"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Drawdown protection (%)</label>
                                        <input
                                            type="number"
                                            value={editDrawdownPercent}
                                            onChange={e => setEditDrawdownPercent(Number(e.target.value))}
                                            className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/10 text-white focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono font-bold"
                                            min="0"
                                            max="100"
                                            required
                                        />
                                    </div>
                                    <div className="flex items-center justify-between border border-white/5 rounded-xl px-4 py-3 bg-white/[0.01] mt-5">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Trailing Stop</span>
                                        <input
                                            type="checkbox"
                                            checked={editUseTrailing}
                                            onChange={e => setEditUseTrailing(e.target.checked)}
                                            className="w-4 h-4 rounded accent-indigo-500 bg-white/5"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4 border-t border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => setEditingBot(null)}
                                        className="flex-1 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs transition-all border border-white/10"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingEdit}
                                        className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
                                    >
                                        {isSavingEdit ? (
                                            <>
                                                <RefreshCw className="animate-spin" size={12} /> Saving...
                                            </>
                                        ) : (
                                            "Save Changes"
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Bot Details Drawer */}
            <AnimatePresence>
                {detailsBot && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailsBot(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                        <motion.div 
                            initial={{ x: "100%" }} 
                            animate={{ x: 0 }} 
                            exit={{ x: "100%" }} 
                            transition={{ type: "spring", damping: 25, stiffness: 200 }} 
                            className="relative w-full max-w-2xl bg-slate-900 border-l border-white/10 h-full p-6 sm:p-8 shadow-2xl flex flex-col justify-between z-10 overflow-y-auto"
                        >
                            <div>
                                {/* Drawer Header */}
                                <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-6 mb-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-2xl font-bold text-white tracking-tight">{detailsBot.name}</h3>
                                            <span className={cn(
                                                "h-2.5 w-2.5 rounded-full",
                                                detailsBot.status === 'ACTIVE' ? "bg-emerald-500 animate-pulse" : detailsBot.status === 'PAUSED' ? "bg-amber-500" : "bg-rose-500"
                                            )}></span>
                                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md">
                                                {detailsBot.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">
                                            Strategy: <span className="text-indigo-400 font-semibold">{detailsBot.strategyName}</span>
                                        </p>
                                    </div>
                                    <button onClick={() => setDetailsBot(null)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5">
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Metrics Grid */}
                                <div className="grid grid-cols-3 gap-4 mb-8">
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total P&L</span>
                                        <span className={cn(
                                            "text-lg font-mono font-bold mt-1.5 block",
                                            detailsBot.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                                        )}>
                                            {detailsBot.totalPnL >= 0 ? "+" : ""}
                                            {formatCurrency(detailsBot.totalPnL)}
                                        </span>
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Win Rate</span>
                                        <span className="text-lg font-mono font-bold text-slate-300 mt-1.5 block">
                                            {detailsBot.totalTradesExecuted > 0 
                                                ? ((detailsBot.winCount / detailsBot.totalTradesExecuted) * 100).toFixed(0) 
                                                : "0"}%
                                        </span>
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Trades Executed</span>
                                        <span className="text-lg font-mono font-bold text-slate-300 mt-1.5 block">
                                            {detailsBot.totalTradesExecuted}
                                        </span>
                                    </div>
                                </div>

                                {/* Live Positions */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                            <Activity className="text-emerald-400" size={16} /> Live Active Positions
                                        </h4>
                                    </div>

                                    {(!detailsBot.activeHoldings || detailsBot.activeHoldings.length === 0) ? (
                                        <div className="border border-white/5 bg-white/[0.01] rounded-2xl p-8 text-center flex flex-col items-center justify-center">
                                            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3 animate-pulse">
                                                <Bot size={20} />
                                            </div>
                                            <p className="text-sm text-slate-300 font-bold mb-1">No Active Positions</p>
                                            <p className="text-xs text-slate-500 max-w-sm">
                                                This bot has no open virtual stock purchases right now. It is checking real-time scan signals to identify purchases.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="border border-white/5 bg-white/[0.01] rounded-2xl overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-white/5 bg-white/[0.02]">
                                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Symbol</th>
                                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Qty</th>
                                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Avg Price</th>
                                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Current</th>
                                                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Unrealized P&L</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {detailsBot.activeHoldings.map((h, idx) => {
                                                            const isPosProfit = h.unrealizedPnL >= 0;
                                                            return (
                                                                <tr key={idx} className="hover:bg-white/[0.01] transition-all">
                                                                    <td className="px-4 py-3.5">
                                                                        <div className="font-bold text-white text-sm">{formatSymbol(h.symbol)}</div>
                                                                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                                                            {new Date(h.purchaseDate).toLocaleDateString(undefined, {
                                                                                month: 'short',
                                                                                day: 'numeric'
                                                                            })}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-300 font-medium">
                                                                        {h.quantity}
                                                                    </td>
                                                                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-300 font-medium">
                                                                        {formatCurrency(h.buyPrice)}
                                                                    </td>
                                                                    <td className="px-4 py-3.5 text-right font-mono text-xs text-white font-bold flex items-center justify-end gap-1">
                                                                        <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse"></span>
                                                                        {formatCurrency(h.currentPrice)}
                                                                    </td>
                                                                    <td className="px-4 py-3.5 text-right">
                                                                        <div className={cn(
                                                                            "font-mono font-bold text-xs",
                                                                            isPosProfit ? "text-emerald-400" : "text-rose-400"
                                                                        )}>
                                                                            {isPosProfit ? "+" : ""}
                                                                            {formatCurrency(h.unrealizedPnL)}
                                                                        </div>
                                                                        <div className={cn(
                                                                            "text-[9px] font-mono font-semibold mt-0.5",
                                                                            isPosProfit ? "text-emerald-500" : "text-rose-500"
                                                                        )}>
                                                                            {isPosProfit ? "+" : ""}{h.unrealizedPnLPercent.toFixed(2)}%
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Configuration summary */}
                                <div className="mt-8 space-y-4">
                                    <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                        <Settings className="text-indigo-400" size={16} /> Configuration Rules & Targets
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 bg-white/[0.01] border border-white/5 rounded-2xl p-4 sm:p-5 text-xs font-semibold text-slate-400">
                                        <div className="space-y-3">
                                            <div className="flex justify-between border-b border-white/5 pb-2">
                                                <span className="text-slate-500">Allocated Budget:</span>
                                                <span className="text-slate-200 font-mono">₹{detailsBot.allocatedCash.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-white/5 pb-2">
                                                <span className="text-slate-500">Active Deployed Cash:</span>
                                                <span className="text-indigo-400 font-mono">₹{detailsBot.deployedCash.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Trailing Stop Loss:</span>
                                                <span className="text-slate-200 font-mono">{detailsBot.useTrailingStop ? "Enabled" : "Disabled"}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between border-b border-white/5 pb-2">
                                                <span className="text-slate-500">Take Profit:</span>
                                                <span className="text-emerald-400 font-mono">+{detailsBot.takeProfitPercent}%</span>
                                            </div>
                                            <div className="flex justify-between border-b border-white/5 pb-2">
                                                <span className="text-slate-500">Stop Loss:</span>
                                                <span className="text-rose-400 font-mono">-{detailsBot.stopLossPercent}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Confluence:</span>
                                                <span className="text-indigo-400 font-mono">&ge; {detailsBot.minConfluenceScore}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Close Button */}
                            <div className="border-t border-white/5 pt-6 mt-8">
                                <button
                                    onClick={() => setDetailsBot(null)}
                                    className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-all border border-white/10 hover:text-white"
                                >
                                    Close Tracker View
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function BotCard({ 
    bot, 
    onToggleStatus, 
    onDelete, 
    onEdit,
    onShowDetails,
    onOpenTerminal,
    actionLoading 
}: { 
    bot: BotData; 
    onToggleStatus: (id: string, stat: string) => void;
    onDelete: (id: string) => void;
    onEdit: (bot: BotData) => void;
    onShowDetails: (bot: BotData) => void;
    onOpenTerminal: (bot: BotData) => void;
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
                            <h4 
                                onClick={() => onShowDetails(bot)}
                                className="text-lg font-bold text-white tracking-tight hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-1.5 group/title"
                            >
                                {bot.name}
                                <span className="opacity-0 group-hover/title:opacity-100 transition-opacity text-slate-500 text-[10px] font-normal">(View Details)</span>
                            </h4>
                            <span className={cn(
                                "h-2 w-2 rounded-full",
                                bot.status === 'ACTIVE' ? "bg-emerald-500 animate-pulse" : bot.status === 'PAUSED' ? "bg-amber-500" : "bg-rose-500"
                            )}></span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md">
                                {bot.status}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                            Strategy: <span className="text-indigo-400 font-semibold">{bot.strategyName}</span>
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => onEdit(bot)}
                            disabled={actionLoading === bot.id}
                            title="Edit Bot Settings"
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-all"
                        >
                            <Edit3 size={14} />
                        </button>
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
                        <span className="text-slate-500">Budget limit:</span>
                        <span className="text-slate-300 font-mono">₹{bot.allocatedCash.toLocaleString()} <span className="text-[10px] text-slate-500">(Active: ₹{bot.deployedCash.toLocaleString()})</span></span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Execution Filters:</span>
                        <span className="text-indigo-400 font-mono">Score &ge; {bot.minConfluenceScore}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Max Sizing / Trade:</span>
                        <span className="text-slate-300 font-mono">{bot.maxPositionSizePercent}% of budget</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Limits & Presets:</span>
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
                <div className="flex gap-4">
                    <button
                        onClick={() => onShowDetails(bot)}
                        className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                    >
                        <TrendingUp size={12} /> Live Tracker
                    </button>
                    <button
                        onClick={() => onOpenTerminal(bot)}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                    >
                        <TerminalIcon size={12} /> Live Terminal
                    </button>
                </div>
            </div>
        </div>
    );
}
