"use client";

import React, { useState, useEffect } from "react";
import { 
    Check, 
    ArrowRight, 
    ArrowLeft, 
    Loader2, 
    Info, 
    AlertTriangle, 
    AlertCircle, 
    TrendingUp, 
    IndianRupee, 
    Activity,
    Compass,
    Target,
    Clock,
    ShieldCheck,
    Coins,
    Sparkles,
    RefreshCw,
    SlidersHorizontal,
    Percent,
    Layers,
    X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, formatIndianNumber, formatSymbol } from "@/lib/utils";

interface Strategy {
    id: string;
    slug: string;
    name: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    winRate: string;
    objective: string;
    description: string;
    longDescription?: string;
    recommendations: string[];
    liveWinRate?: number | null;
    totalTrades?: number;
    benchmarkWinRate?: string;
}

interface SetupClientProps {
    strategies: Strategy[];
    cashBalance: number;
    reservedCash: number;
    availableCash: number;
}

interface CandidateItem {
    symbol: string;
    fullSymbol: string;
    score: number;
    price: number;
    changePercent: number;
    gapPercent?: number;
    rvol?: number;
    setup?: string;
    timestamp?: string;
}

interface BotMetricsResponse {
    strategyId: string;
    strategySlug: string;
    strategyName: string;
    riskLevel: string;
    benchmarkWinRate: string;
    methodology: {
        stopLossPercent: number;
        takeProfitPercent: number;
        stopLossDesc: string;
        takeProfitDesc: string;
        holdingHorizon: string;
        signalFrequency: string;
        riskPerTradePercent: number;
        executionProtocol: string;
    };
    metrics: {
        hasLiveHistory: boolean;
        totalCompletedTrades: number;
        winningTrades: number;
        losingTrades: number;
        totalRealizedPnL: number;
        realWinRate: number | null;
        realMaxDrawdown: number;
    };
    candidates: CandidateItem[];
    scannedAt: string;
}

// Strategy-specific execution presets
const STRATEGY_PRESETS: Record<string, {
    stopLossPercent: number;
    takeProfitPercent: number;
    useTrailingStop: boolean;
    cooldownPeriodMinutes: number;
    defaultPositions: number;
    holdingHorizon: string;
    signalFrequency: string;
    playbookName: string;
    exitRule: string;
}> = {
    "john-carter-intraday": {
        stopLossPercent: 1.5,
        takeProfitPercent: 4.0,
        useTrailingStop: true,
        cooldownPeriodMinutes: 15,
        defaultPositions: 2,
        holdingHorizon: "Intraday (Auto Square-off 3:15 PM)",
        signalFrequency: "~2 - 5 Setups / Day",
        playbookName: "Carter 4-Step Playbook (Floor Pivots, TTM Squeeze, 3-Target Scaling)",
        exitRule: "Floor Pivot S1 Stop (~1.5%) | 3-Target Scaling (1:1, 2:1, 60-min Runner)"
    },
    "canslim": {
        stopLossPercent: 7.0,
        takeProfitPercent: 20.0,
        useTrailingStop: true,
        cooldownPeriodMinutes: 60,
        defaultPositions: 3,
        holdingHorizon: "Swing / Positional (3 - 8 Weeks)",
        signalFrequency: "~3 - 6 Setups / Month",
        playbookName: "CANSLIM Institutional Momentum & Volume Breakout",
        exitRule: "Hard 7% Stop Loss | 20-25% Profit Target Scaling"
    },
    "intermarket-analysis-india": {
        stopLossPercent: 5.0,
        takeProfitPercent: 15.0,
        useTrailingStop: true,
        cooldownPeriodMinutes: 30,
        defaultPositions: 3,
        holdingHorizon: "Swing Trend (2 - 4 Weeks)",
        signalFrequency: "~2 - 4 Setups / Month",
        playbookName: "Macro Yield & Relative Sector Strength Model",
        exitRule: "5% Regime Stop | 15% Sector Leadership Expansion"
    },
    "warren-buffet": {
        stopLossPercent: 15.0,
        takeProfitPercent: 35.0,
        useTrailingStop: false,
        cooldownPeriodMinutes: 120,
        defaultPositions: 4,
        holdingHorizon: "Long-Term Compounder (1 - 3 Years)",
        signalFrequency: "~1 - 3 Setups / Quarter",
        playbookName: "Indian Value Compounder Formula (IVCF Moat & Quality)",
        exitRule: "15% Structural Moat Stop | Exit on Moat Degradation"
    }
};

export default function SetupClient({ strategies, cashBalance, reservedCash, availableCash }: SetupClientProps) {
    const router = useRouter();
    
    // 4-Step Flow:
    // Step 1: Strategy Selection & Bot Name
    // Step 2: Budget & Position Sizing (in ₹)
    // Step 3: Strategy Intelligence & Real Live Signals
    // Step 4: Review & Deploy Assistant
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [assistantName, setAssistantName] = useState("");
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(() => strategies[0] || null);

    // Budget & Simultaneous Positions
    const [allocatedCapital, setAllocatedCapital] = useState<number>(() => Math.min(10000, Math.max(5000, availableCash)));
    const [maxConcurrentPositions, setMaxConcurrentPositions] = useState<number>(2);

    // Dynamic Strategy Rules
    const currentPreset = selectedStrategy ? STRATEGY_PRESETS[selectedStrategy.slug] || STRATEGY_PRESETS["john-carter-intraday"] : STRATEGY_PRESETS["john-carter-intraday"];
    const [stopLossPercent, setStopLossPercent] = useState<number>(currentPreset.stopLossPercent);
    const [takeProfitPercent, setTakeProfitPercent] = useState<number>(currentPreset.takeProfitPercent);
    const [useTrailingStop, setUseTrailingStop] = useState<boolean>(currentPreset.useTrailingStop);

    // Live Metrics & Real Candidates State
    const [botMetrics, setBotMetrics] = useState<BotMetricsResponse | null>(null);
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [isRescanning, setIsRescanning] = useState(false);

    // Validation Errors
    const [nameError, setNameError] = useState("");
    const [capitalError, setCapitalError] = useState("");

    // Fetch live bot metrics & candidates when strategy changes or Step 3 is reached
    const fetchStrategyMetrics = async (slug: string, rescan: boolean = false) => {
        try {
            if (rescan) setIsRescanning(true);
            else setMetricsLoading(true);

            const res = await fetch(`/api/strategy/${slug}/bot-metrics${rescan ? "?rescan=true" : ""}`);
            if (res.ok) {
                const data: BotMetricsResponse = await res.json();
                setBotMetrics(data);
                if (data.methodology) {
                    setStopLossPercent(data.methodology.stopLossPercent);
                    setTakeProfitPercent(data.methodology.takeProfitPercent);
                }
            }
        } catch (err) {
            console.error("Failed to fetch live strategy metrics:", err);
        } finally {
            setMetricsLoading(false);
            setIsRescanning(false);
        }
    };

    // Auto-fetch on mount for default strategy
    useEffect(() => {
        if (selectedStrategy) {
            fetchStrategyMetrics(selectedStrategy.slug);
        }
    }, [selectedStrategy?.slug]);

    // When strategy changes, automatically apply its authentic risk parameters
    const selectStrategyHandler = (strat: Strategy) => {
        setSelectedStrategy(strat);
        setAssistantName(`${strat.name.split(" ")[0]} Assistant`);
        setNameError("");

        const preset = STRATEGY_PRESETS[strat.slug] || STRATEGY_PRESETS["john-carter-intraday"];
        setStopLossPercent(preset.stopLossPercent);
        setTakeProfitPercent(preset.takeProfitPercent);
        setUseTrailingStop(preset.useTrailingStop);
        setMaxConcurrentPositions(preset.defaultPositions);
    };

    // Calculate dynamic budget allocation metrics with transparent simultaneous positions
    const maxPositionSizePercent = Math.round(100 / maxConcurrentPositions);
    const maxTradeSize = Math.floor(allocatedCapital / maxConcurrentPositions);
    const maxRiskPerTrade = Math.floor(maxTradeSize * (stopLossPercent / 100));

    const goToStep2 = () => {
        if (!assistantName.trim()) {
            setNameError("Please provide a name for this assistant.");
            return;
        }
        setStep(2);
    };

    const goToStep3 = () => {
        if (allocatedCapital < 5000) {
            setCapitalError("Minimum ₹5,000 capital is required for safe position sizing.");
            return;
        }
        if (allocatedCapital > availableCash) {
            setCapitalError(`Allocated capital exceeds available balance (${formatCurrency(availableCash)}).`);
            return;
        }
        setStep(3);
        if (selectedStrategy && !botMetrics) {
            fetchStrategyMetrics(selectedStrategy.slug);
        }
    };

    const goToStep4 = () => {
        setStep(4);
    };

    const handleDeploy = async () => {
        if (!selectedStrategy) return;

        setLoading(true);
        setError(null);

        try {
            // Proportional daily circuit breaker: 10% of allocated budget
            const maxDailyLoss = Math.floor(allocatedCapital * 0.1);

            const payload = {
                name: assistantName,
                strategySlug: selectedStrategy.slug,
                allocatedCapital,
                maxPositionSizePercent,
                stopLossPercent,
                takeProfitPercent,
                useTrailingStop,
                minConfluenceScore: 65,
                maxDailyLoss,
                maxConcurrentPositions,
                cooldownPeriodMinutes: currentPreset.cooldownPeriodMinutes,
                maxSectorAllocationPercent: 40,
                drawdownProtectionPercent: 15,
            };

            const res = await fetch("/api/strategy-assistants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to create assistant");
            }

            router.push(`/auto-trade/assistant/${data.id}`);
        } catch (err: any) {
            setError(err.message || "Failed to deploy assistant");
            setLoading(false);
        }
    };

    const variants = {
        enter: { opacity: 0, x: 20 },
        center: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div>
                    <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Compass className="w-4 h-4" />
                        Strategy Assistant Setup
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white">Deploy Automated Trading Bot</h1>
                </div>

                <div className="flex items-center gap-3">
                    {/* 4-Step Indicator Bar */}
                    <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 p-2 rounded-2xl">
                        {[
                            { num: 1, label: "Strategy" },
                            { num: 2, label: "Budget (₹)" },
                            { num: 3, label: "Intelligence" },
                            { num: 4, label: "Deploy" }
                        ].map((s, idx) => (
                            <React.Fragment key={s.num}>
                                <div className="flex items-center gap-2">
                                    <div
                                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                                            step === s.num
                                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-500/30"
                                                : step > s.num
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : "bg-slate-800 text-slate-500"
                                        }`}
                                    >
                                        {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                                    </div>
                                    <span className={`text-xs font-semibold hidden sm:inline ${
                                        step === s.num ? "text-white" : step > s.num ? "text-slate-300" : "text-slate-600"
                                    }`}>
                                        {s.label}
                                    </span>
                                </div>
                                {idx < 3 && <div className="w-6 h-[1px] bg-slate-800" />}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Close / Exit Button */}
                    <Link
                        href="/auto-trade"
                        className="w-10 h-10 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all shadow-sm group"
                        title="Close setup and return to Auto Trade"
                    >
                        <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </Link>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Wizard Steps */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
                <AnimatePresence mode="wait">
                    {/* STEP 1: STRATEGY SELECTION & BOT NAME */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial="enter"
                            animate="center"
                            exit="exit"
                            variants={variants}
                            className="space-y-6"
                        >
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2">Step 1: Choose Quantitative Strategy</h2>
                                <p className="text-sm text-slate-400">Select the trading logic that will continuously scan the NSE market and generate buy/sell signals.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {strategies.map((strat) => {
                                    const isSelected = selectedStrategy?.slug === strat.slug;
                                    return (
                                        <div
                                            key={strat.id}
                                            onClick={() => selectStrategyHandler(strat)}
                                            className={`cursor-pointer rounded-2xl p-5 border transition-all flex flex-col justify-between gap-4 ${
                                                isSelected
                                                    ? "bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/10"
                                                    : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/70"
                                            }`}
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-white text-base">{strat.name}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        strat.riskLevel === "HIGH" 
                                                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                                                            : strat.riskLevel === "MEDIUM"
                                                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                    }`}>
                                                        {strat.riskLevel} Risk
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{strat.description}</p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-800/80 pt-3 text-[11px] text-slate-500 gap-1.5">
                                                <span className="font-medium text-slate-400">Horizon: {STRATEGY_PRESETS[strat.slug]?.holdingHorizon || "Swing"}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-slate-500 font-medium">Live Win:</span>
                                                    {strat.liveWinRate !== undefined && strat.liveWinRate !== null ? (
                                                        <span className="font-bold text-emerald-400 font-mono">{strat.liveWinRate}% ({strat.totalTrades} Trades)</span>
                                                    ) : (
                                                        <span className="font-semibold text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px] border border-amber-500/20">
                                                            0 Trades Yet
                                                        </span>
                                                    )}
                                                    <span className="text-slate-500 text-[10px]" title="Theoretical strategy backtest benchmark">
                                                        (Benchmark: {strat.winRate})
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="space-y-2 pt-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assistant Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Carter Intraday Bot"
                                    value={assistantName}
                                    onChange={(e) => {
                                        setAssistantName(e.target.value);
                                        setNameError("");
                                    }}
                                    className={`w-full bg-slate-950 border ${
                                        nameError ? "border-rose-500" : "border-slate-800 focus:border-indigo-500"
                                    } focus:ring-1 focus:ring-indigo-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 transition-all outline-none`}
                                />
                                {nameError && <div className="text-rose-500 text-xs font-semibold">{nameError}</div>}
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                                <Link
                                    href="/auto-trade"
                                    className="text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Cancel & Exit
                                </Link>

                                <button
                                    onClick={goToStep2}
                                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm shadow-md shadow-indigo-500/10 group active:scale-[0.98] transition-all"
                                >
                                    Configure Budget & Sizing
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: BUDGET & POSITION SIZING (IN ₹ WITH DIRECT POSITIONS CONTROL) */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial="enter"
                            animate="center"
                            exit="exit"
                            variants={variants}
                            className="space-y-6"
                        >
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2">Step 2: Budget & Position Sizing</h2>
                                <p className="text-sm text-slate-400">Allocate Indian Rupee (₹) capital and choose how many stocks this assistant can hold simultaneously.</p>
                            </div>

                            {/* Portfolio Cash Breakdown */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-950/60 border border-slate-800/85 p-4 rounded-2xl flex flex-col justify-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Portfolio Cash</span>
                                    <span className="text-lg font-bold text-white">{formatCurrency(cashBalance)}</span>
                                </div>
                                <div className="bg-slate-950/60 border border-slate-800/85 p-4 rounded-2xl flex flex-col justify-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Already Reserved</span>
                                    <span className="text-lg font-bold text-amber-500">{formatCurrency(reservedCash)}</span>
                                </div>
                                <div className="bg-gradient-to-br from-indigo-950/30 to-purple-950/30 border border-indigo-500/20 p-4 rounded-2xl flex flex-col justify-center">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">Available for Allocation</span>
                                    <span className="text-lg font-extrabold text-emerald-400">{formatCurrency(availableCash)}</span>
                                </div>
                            </div>

                            <div className="space-y-6 bg-slate-950/40 border border-slate-800 rounded-2xl p-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Capital Allocated Input */}
                                    <div className="space-y-2.5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capital Allocated to Assistant (₹)</label>
                                            <span className="text-[10px] font-bold text-slate-500">Min: ₹5,000</span>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute left-4 top-3 text-slate-400 font-bold text-sm select-none">
                                                ₹
                                            </div>
                                            <input
                                                type="number"
                                                placeholder="10,000"
                                                value={allocatedCapital || ""}
                                                onChange={(e) => {
                                                    setAllocatedCapital(parseInt(e.target.value) || 0);
                                                    setCapitalError("");
                                                }}
                                                className={`w-full bg-slate-950 border ${
                                                    capitalError ? "border-rose-500" : "border-slate-800 focus:border-indigo-500"
                                                } focus:ring-1 focus:ring-indigo-500/50 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-slate-700 outline-none font-mono font-bold`}
                                            />
                                        </div>
                                        {capitalError && <div className="text-rose-500 text-xs font-semibold">{capitalError}</div>}

                                        {/* Quick-Pick Budget Buttons */}
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {[5000, 10000, 25000, 50000].map((amt) => (
                                                <button
                                                    key={amt}
                                                    type="button"
                                                    onClick={() => {
                                                        setAllocatedCapital(amt);
                                                        setCapitalError("");
                                                    }}
                                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-all"
                                                >
                                                    ₹{amt.toLocaleString()}
                                                </button>
                                            ))}
                                            {availableCash > 5000 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAllocatedCapital(Math.floor(availableCash));
                                                        setCapitalError("");
                                                    }}
                                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-all"
                                                >
                                                    Max Available
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Direct Simultaneous Positions Choice */}
                                    <div className="space-y-2.5">
                                        <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                                            <span className="text-slate-400">Max Simultaneous Positions</span>
                                            <span className="text-indigo-400 font-mono font-bold">
                                                {maxConcurrentPositions} {maxConcurrentPositions === 1 ? "Stock" : "Stocks"} Max
                                            </span>
                                        </div>

                                        {/* Transparent Position Selector Buttons */}
                                        <div className="grid grid-cols-5 gap-2 pt-1">
                                            {[1, 2, 3, 4, 5].map((count) => {
                                                const isCurrent = maxConcurrentPositions === count;
                                                return (
                                                    <button
                                                        key={count}
                                                        type="button"
                                                        onClick={() => setMaxConcurrentPositions(count)}
                                                        className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                                                            isCurrent
                                                                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20"
                                                                : "bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-800"
                                                        }`}
                                                    >
                                                        {count} {count === 1 ? "Pos" : "Pos"}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <span className="text-[10px] text-slate-500 block leading-relaxed pt-1">
                                            Divides allocated capital equally into {maxConcurrentPositions} slots. Each trade is strictly capped at {formatCurrency(maxTradeSize)} ({maxPositionSizePercent}% of budget).
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Sizing Allocation Preview Card */}
                            <div className="bg-gradient-to-r from-indigo-950/20 to-purple-950/20 border border-slate-800 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3">
                                    <Activity className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs font-bold text-white uppercase tracking-wider">Transparent Sizing Breakdown</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-xs text-slate-400">Max Cash per Stock</span>
                                        <div className="text-base font-extrabold text-white font-mono">{formatCurrency(maxTradeSize)}</div>
                                        <span className="text-[9px] text-slate-500 block">₹{allocatedCapital.toLocaleString()} ÷ {maxConcurrentPositions} slots</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-slate-400">Max Risk per Trade</span>
                                        <div className="text-base font-extrabold text-rose-400 font-mono">{formatCurrency(maxRiskPerTrade)}</div>
                                        <span className="text-[9px] text-slate-500 block">At {stopLossPercent}% strategy stop loss</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-slate-400">Concurrent Positions</span>
                                        <div className="text-base font-extrabold text-indigo-400 font-mono">{maxConcurrentPositions} Positions</div>
                                        <span className="text-[9px] text-slate-500 block">Strict portfolio exposure ceiling</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                                <button
                                    onClick={() => setStep(1)}
                                    className="border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>

                                <button
                                    onClick={goToStep3}
                                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm shadow-md shadow-indigo-500/10 group active:scale-[0.98] transition-all"
                                >
                                    Strategy Intelligence
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: STRATEGY INTELLIGENCE & REAL LIVE SIGNALS */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial="enter"
                            animate="center"
                            exit="exit"
                            variants={variants}
                            className="space-y-6"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-1">Step 3: Strategy Intelligence & Real Live Signals</h2>
                                    <p className="text-sm text-slate-400">Live quantitative scan and verifiable trade performance for <strong>{selectedStrategy?.name}</strong>.</p>
                                </div>

                                <button
                                    onClick={() => selectedStrategy && fetchStrategyMetrics(selectedStrategy.slug, true)}
                                    disabled={isRescanning}
                                    className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-xs font-bold transition-all disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isRescanning ? "animate-spin" : ""}`} />
                                    {isRescanning ? "Scanning NSE..." : "Rescan Market"}
                                </button>
                            </div>

                            {metricsLoading ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-4">
                                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                                    <span className="text-xs text-indigo-400 font-semibold tracking-wider animate-pulse">Running live quantitative scanner against NSE universe...</span>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-fade-in">
                                    {/* 4 Dynamic Strategy Performance & Expectation Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Card 1: Win Probability */}
                                        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-400 font-medium">Win Probability</span>
                                                {botMetrics?.metrics.hasLiveHistory ? (
                                                    <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                        Live Bot Trades
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                                                        New Bot Deployment
                                                    </span>
                                                )}
                                            </div>

                                            {botMetrics?.metrics.hasLiveHistory ? (
                                                <div>
                                                    <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                                                        {botMetrics.metrics.realWinRate}%
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 block mt-1">
                                                        Calculated from {botMetrics.metrics.totalCompletedTrades} completed bot trades ({botMetrics.metrics.winningTrades}W / {botMetrics.metrics.losingTrades}L).
                                                    </span>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="text-lg font-bold text-slate-200">
                                                        Awaiting Live Trades
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 block mt-1">
                                                        0 live trades executed yet. Strategy benchmark: <strong className="text-emerald-400">{selectedStrategy?.winRate}</strong>. Real win rate will calculate dynamically as trades close.
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Card 2: Strategy Drawdown */}
                                        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-400 font-medium">Maximum Drawdown</span>
                                                <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                                                    Equity Risk
                                                </span>
                                            </div>

                                            {botMetrics?.metrics.hasLiveHistory && botMetrics.metrics.realMaxDrawdown < 0 ? (
                                                <div>
                                                    <div className="text-2xl font-extrabold text-rose-400 font-mono">
                                                        -₹{Math.abs(botMetrics.metrics.realMaxDrawdown).toLocaleString()}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 block mt-1">
                                                        Peak-to-trough drop recorded across live bot trade ledger.
                                                    </span>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="text-2xl font-extrabold text-slate-400 font-mono">
                                                        ₹0.00
                                                    </div>
                                                    <span className="text-[10px] text-slate-500 block mt-1">
                                                        No live bot drawdown recorded yet. Safety circuit breaker is set to 10% (₹{Math.floor(allocatedCapital * 0.1).toLocaleString()}).
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Card 3: Signal Frequency */}
                                        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl space-y-1">
                                            <span className="text-xs text-slate-400">Signal Frequency</span>
                                            <div className="text-xl font-extrabold text-white font-mono">
                                                {botMetrics?.methodology.signalFrequency || currentPreset.signalFrequency}
                                            </div>
                                            <span className="text-[10px] text-slate-500 block leading-relaxed">
                                                Expected qualified setups identified during regular market sessions.
                                            </span>
                                        </div>

                                        {/* Card 4: Average Holding Duration */}
                                        <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl space-y-1">
                                            <span className="text-xs text-slate-400">Holding Duration & Horizon</span>
                                            <div className="text-xl font-extrabold text-white font-mono">
                                                {botMetrics?.methodology.holdingHorizon || currentPreset.holdingHorizon}
                                            </div>
                                            <span className="text-[10px] text-slate-500 block leading-relaxed">
                                                Execution timeframe strictly governed by strategy exit parameters.
                                            </span>
                                        </div>
                                    </div>

                                    {/* Strategy-Defined Risk & Exit Protocol Card */}
                                    <div className="bg-gradient-to-r from-slate-950 to-indigo-950/20 border border-slate-800 rounded-2xl p-5 space-y-3">
                                        <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3">
                                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Strategy-Defined Execution & Exit Rules</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                            <div className="space-y-1 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
                                                <span className="text-slate-400 font-semibold block">Stop Loss Protocol:</span>
                                                <p className="text-rose-400 font-bold font-mono">
                                                    {botMetrics?.methodology.stopLossDesc || currentPreset.exitRule}
                                                </p>
                                            </div>

                                            <div className="space-y-1 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
                                                <span className="text-slate-400 font-semibold block">Profit Target Protocol:</span>
                                                <p className="text-emerald-400 font-bold font-mono">
                                                    {botMetrics?.methodology.takeProfitDesc || "Target Scaling Framework"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Real Scanned Candidate Stocks */}
                                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                                            <div className="flex items-center gap-2">
                                                <Target className="w-4 h-4 text-emerald-400" />
                                                <span className="text-xs font-bold text-white uppercase tracking-wider">
                                                    Real Live Scanned Candidates
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                {botMetrics?.candidates.length || 0} Screened Stocks
                                            </span>
                                        </div>

                                        {botMetrics && botMetrics.candidates.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                                                {botMetrics.candidates.map((cand) => (
                                                    <div 
                                                        key={cand.symbol}
                                                        className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 transition-all flex flex-col justify-between"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-black text-white font-mono">{cand.symbol}</span>
                                                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                                                {cand.score}/100
                                                            </span>
                                                        </div>

                                                        <div className="mt-2 flex items-baseline justify-between">
                                                            <span className="text-xs font-bold text-slate-200 font-mono">
                                                                ₹{cand.price > 0 ? cand.price.toLocaleString() : "Live"}
                                                            </span>
                                                            <span className={`text-[10px] font-bold ${
                                                                cand.changePercent >= 0 ? "text-emerald-400" : "text-rose-400"
                                                            }`}>
                                                                {cand.changePercent >= 0 ? "+" : ""}{cand.changePercent.toFixed(2)}%
                                                            </span>
                                                        </div>

                                                        <div className="mt-1 text-[9px] text-slate-400 truncate">
                                                            {cand.setup || "Setup Align"}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-6 text-center text-xs text-slate-500">
                                                No stocks currently pass the strict 4-step quantitative filter at this minute. The assistant monitors the market continuously and enters automatically as setups trigger.
                                            </div>
                                        )}

                                        <p className="text-[10px] text-slate-500 pt-1">
                                            The automated assistant monitors these live setups and executes buy orders when quantitative conditions trigger.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                                <button
                                    onClick={() => setStep(2)}
                                    className="border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>

                                <button
                                    disabled={metricsLoading}
                                    onClick={goToStep4}
                                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm shadow-md shadow-indigo-500/10 group active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    Review & Final Audit
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 4: REVIEW & DEPLOY ASSISTANT */}
                    {step === 4 && (
                        <motion.div
                            key="step4"
                            initial="enter"
                            animate="center"
                            exit="exit"
                            variants={variants}
                            className="space-y-6"
                        >
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2">Step 4: Review & Deploy Assistant</h2>
                                <p className="text-sm text-slate-400">Final audit check of assistant constraints and strategy parameters before initiating automated execution.</p>
                            </div>

                            <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl overflow-hidden text-xs">
                                <div className="grid grid-cols-2 border-b border-slate-800/80 p-3.5 bg-slate-900/40">
                                    <span className="font-bold text-slate-400">Parameter</span>
                                    <span className="font-bold text-white">Configured Value</span>
                                </div>
                                <div className="grid grid-cols-2 border-b border-slate-800/50 p-3">
                                    <span className="text-slate-400 font-semibold">Assistant Name</span>
                                    <span className="text-white font-bold">{assistantName}</span>
                                </div>
                                <div className="grid grid-cols-2 border-b border-slate-800/50 p-3">
                                    <span className="text-slate-400 font-semibold">Active Strategy</span>
                                    <span className="text-white font-bold">{selectedStrategy?.name}</span>
                                </div>
                                <div className="grid grid-cols-2 border-b border-slate-800/50 p-3">
                                    <span className="text-slate-400 font-semibold">Total Capital Allocated</span>
                                    <span className="text-emerald-400 font-bold font-mono">{formatCurrency(allocatedCapital)}</span>
                                </div>
                                <div className="grid grid-cols-2 border-b border-slate-800/50 p-3">
                                    <span className="text-slate-400 font-semibold">Max Simultaneous Positions</span>
                                    <span className="text-white font-bold">{maxConcurrentPositions} Positions ({formatCurrency(maxTradeSize)} max / stock)</span>
                                </div>
                                <div className="grid grid-cols-2 border-b border-slate-800/50 p-3">
                                    <span className="text-slate-400 font-semibold">Strategy Execution Engine</span>
                                    <span className="text-indigo-400 font-medium">
                                        {botMetrics?.methodology.executionProtocol || currentPreset.playbookName}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 border-b border-slate-800/50 p-3">
                                    <span className="text-slate-400 font-semibold">Stop Loss Protocol</span>
                                    <span className="text-rose-400 font-semibold">
                                        {botMetrics?.methodology.stopLossDesc || currentPreset.exitRule}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 border-b border-slate-800/50 p-3">
                                    <span className="text-slate-400 font-semibold">Take Profit Protocol</span>
                                    <span className="text-emerald-400 font-semibold">
                                        {botMetrics?.methodology.takeProfitDesc || "Target Scaling"}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 p-3">
                                    <span className="text-slate-400 font-semibold">Daily Loss Circuit Breaker</span>
                                    <span className="text-rose-400 font-bold font-mono">
                                        {formatCurrency(Math.floor(allocatedCapital * 0.1))} Limit (10% of Budget)
                                    </span>
                                </div>
                            </div>

                            {/* Automated Execution Notice */}
                            <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-300/90 leading-relaxed space-y-1">
                                    <strong className="text-amber-400 block font-semibold">Automated Execution Protocol</strong>
                                    <span>
                                        By deploying this assistant, you authorize StockIntel to monitor live quotes and submit orders on your behalf when strategy triggers align. Positions will be placed with Stop Loss and Take Profit boundary orders. You can pause or liquidate positions at any time from the Cockpit.
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                                <button
                                    onClick={() => setStep(3)}
                                    className="border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>

                                <button
                                    disabled={loading}
                                    onClick={handleDeploy}
                                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-8 py-3 rounded-xl flex items-center gap-2 text-sm shadow-lg shadow-emerald-500/20 group active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Initializing Assistant...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Deploy Assistant
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
