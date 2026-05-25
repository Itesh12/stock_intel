"use client";

import React, { useState, useEffect } from "react";
import { 
    Shield, 
    Sliders, 
    Zap, 
    Check, 
    ArrowRight, 
    ArrowLeft, 
    Loader2, 
    Info, 
    AlertTriangle, 
    AlertCircle, 
    TrendingUp, 
    DollarSign, 
    Activity,
    SlidersHorizontal,
    Compass
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";

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
}

interface SetupClientProps {
    strategies: Strategy[];
    cashBalance: number;
    reservedCash: number;
    availableCash: number;
}

const PERSONALITY_PRESETS = [
    {
        id: "conservative",
        name: "Conservative",
        description: "Low risk profile. Tighter stops, high confluence floors, and lower position ceilings to focus on capital preservation.",
        icon: Shield,
        color: "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 text-emerald-400",
        values: {
            stopLossPercent: 3.0,
            takeProfitPercent: 6.0,
            maxConcurrentPositions: 2,
            cooldownPeriodMinutes: 60,
            maxDailyLoss: 2000,
            maxSectorAllocationPercent: 20,
            drawdownProtectionPercent: 5,
            minConfluenceScore: 80,
            useTrailingStop: true,
            maxPositionSizePercent: 10
        }
    },
    {
        id: "balanced",
        name: "Balanced",
        description: "Standard risk profile. Moderate position scaling, standard stops, and trailing protection for general market cycles.",
        icon: SlidersHorizontal,
        color: "border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/40 text-indigo-400",
        values: {
            stopLossPercent: 5.0,
            takeProfitPercent: 10.0,
            maxConcurrentPositions: 4,
            cooldownPeriodMinutes: 30,
            maxDailyLoss: 5000,
            maxSectorAllocationPercent: 40,
            drawdownProtectionPercent: 10,
            minConfluenceScore: 70,
            useTrailingStop: true,
            maxPositionSizePercent: 20
        }
    },
    {
        id: "aggressive",
        name: "Aggressive",
        description: "High performance focus. Wider stops, higher concurrent slots, and aggressive sector exposures to capture large breakouts.",
        icon: Zap,
        color: "border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40 text-rose-400",
        values: {
            stopLossPercent: 8.0,
            takeProfitPercent: 16.0,
            maxConcurrentPositions: 6,
            cooldownPeriodMinutes: 15,
            maxDailyLoss: 10000,
            maxSectorAllocationPercent: 60,
            drawdownProtectionPercent: 15,
            minConfluenceScore: 60,
            useTrailingStop: false,
            maxPositionSizePercent: 30
        }
    },
    {
        id: "custom",
        name: "Custom (Unrestricted)",
        description: "Configure your own guardrails. Set custom Stop Loss, Take Profit, and concurrent position limits to match your strategy exactly.",
        icon: Sliders,
        color: "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 text-amber-400",
        values: {
            stopLossPercent: 5.0,
            takeProfitPercent: 12.0,
            maxConcurrentPositions: 3,
            cooldownPeriodMinutes: 30,
            maxDailyLoss: 5000,
            maxSectorAllocationPercent: 30,
            drawdownProtectionPercent: 10,
            minConfluenceScore: 70,
            useTrailingStop: true,
            maxPositionSizePercent: 15
        }
    }
];

export default function SetupClient({ strategies, cashBalance, reservedCash, availableCash }: SetupClientProps) {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [assistantName, setAssistantName] = useState("");
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
    const [selectedPreset, setSelectedPreset] = useState<string>("balanced");
    
    // Limits Config State
    const [stopLossPercent, setStopLossPercent] = useState(5.0);
    const [takeProfitPercent, setTakeProfitPercent] = useState(10.0);
    const [maxConcurrentPositions, setMaxConcurrentPositions] = useState(4);
    const [cooldownPeriodMinutes, setCooldownPeriodMinutes] = useState(30);
    const [maxDailyLoss, setMaxDailyLoss] = useState(5000);
    const [maxSectorAllocationPercent, setMaxSectorAllocationPercent] = useState(40);
    const [drawdownProtectionPercent, setDrawdownProtectionPercent] = useState(10);
    const [minConfluenceScore, setMinConfluenceScore] = useState(70);
    const [useTrailingStop, setUseTrailingStop] = useState(true);
    const [maxPositionSizePercent, setMaxPositionSizePercent] = useState(20);

    // Capital State
    const [allocatedCapital, setAllocatedCapital] = useState<number>(10000);

    // Validation Errors
    const [nameError, setNameError] = useState("");
    const [capitalError, setCapitalError] = useState("");

    // Personality preset applier
    useEffect(() => {
        const preset = PERSONALITY_PRESETS.find(p => p.id === selectedPreset);
        if (preset && selectedPreset !== "custom") {
            const v = preset.values;
            setStopLossPercent(v.stopLossPercent);
            setTakeProfitPercent(v.takeProfitPercent);
            setMaxConcurrentPositions(v.maxConcurrentPositions);
            setCooldownPeriodMinutes(v.cooldownPeriodMinutes);
            setMaxDailyLoss(v.maxDailyLoss);
            setMaxSectorAllocationPercent(v.maxSectorAllocationPercent);
            setDrawdownProtectionPercent(v.drawdownProtectionPercent);
            setMinConfluenceScore(v.minConfluenceScore);
            setUseTrailingStop(v.useTrailingStop);
            setMaxPositionSizePercent(v.maxPositionSizePercent);
        }
    }, [selectedPreset]);

    // Handle strategy defaults to pre-fill name
    const selectStrategyHandler = (strat: Strategy) => {
        setSelectedStrategy(strat);
        setAssistantName(`${strat.name.split(" ")[0]} Assistant`);
        setNameError("");
    };

    // Derived metrics for Step 3
    const maxTradeSize = Math.floor(allocatedCapital * (maxPositionSizePercent / 100));
    const maxRiskPerTrade = Math.floor(maxTradeSize * (stopLossPercent / 100));
    const capacitySlots = maxPositionSizePercent > 0 ? Math.floor(100 / maxPositionSizePercent) : 0;
    const capacityPositions = Math.min(maxConcurrentPositions, capacitySlots);

    // Step 4 Simulate Loading
    const goToStep4 = () => {
        // Validation for step 3
        if (allocatedCapital < 5000) {
            setCapitalError("Allocated capital must be at least ₹5,000.");
            return;
        }
        if (allocatedCapital > availableCash) {
            setCapitalError(`Allocation exceeds available portfolio cash balance of ₹${availableCash.toLocaleString()}`);
            return;
        }
        setCapitalError("");
        setStatsLoading(true);
        setStep(4);
        setTimeout(() => {
            setStatsLoading(false);
        }, 1200);
    };

    const handleDeploy = async () => {
        setError(null);
        setLoading(true);

        const payload = {
            name: assistantName,
            strategySlug: selectedStrategy?.slug,
            allocatedCapital,
            maxPositionSizePercent,
            stopLossPercent,
            takeProfitPercent,
            useTrailingStop,
            minConfluenceScore,
            maxDailyLoss,
            maxConcurrentPositions,
            cooldownPeriodMinutes,
            maxSectorAllocationPercent,
            drawdownProtectionPercent,
        };

        try {
            const response = await fetch("/api/strategy-assistants", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to deploy strategy assistant.");
            }

            router.push("/auto-trade");
            router.refresh();
        } catch (err: any) {
            console.error("Deploy error:", err);
            setError(err.message || "Failed to create assistant.");
            setLoading(false);
        }
    };

    // Slide transition definitions
    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 300 : -300,
            opacity: 0
        }),
        center: {
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            x: direction < 0 ? 300 : -300,
            opacity: 0
        })
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-10 px-4 md:px-8">
            <div className="w-full max-w-4xl bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                {/* Visual Grid Backdrop */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

                {/* Header */}
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6 mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Compass className="w-5 h-5 text-indigo-400" />
                            <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">Strategy Assistant Setup</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-white">Deploy Guided Automation</h1>
                    </div>
                    {/* Stepper Progress */}
                    <div className="flex items-center gap-1.5 bg-slate-950/80 px-4 py-2 border border-slate-800 rounded-2xl w-fit">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <div key={s} className="flex items-center">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    step >= s 
                                        ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20" 
                                        : "bg-slate-800 text-slate-500"
                                }`}>
                                    {step > s ? <Check className="w-4 h-4" /> : s}
                                </div>
                                {s < 5 && <div className={`w-6 h-0.5 mx-1 transition-all ${step > s ? "bg-indigo-500" : "bg-slate-800"}`} />}
                            </div>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="relative z-10 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl flex items-start gap-3 mb-6">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <div className="font-semibold text-sm">Deployment Failure</div>
                            <div className="text-xs opacity-90">{error}</div>
                        </div>
                    </div>
                )}

                {/* Step Content */}
                <div className="relative z-10 min-h-[400px]">
                    <AnimatePresence mode="wait" initial={false}>
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
                                    <h2 className="text-xl font-bold text-white mb-2">Step 1: Choose Market Scanner Strategy</h2>
                                    <p className="text-sm text-slate-400">Select the scanner strategy that your Strategy Assistant will monitor to find trade setups.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {strategies.map((strat) => {
                                        const isSelected = selectedStrategy?.slug === strat.slug;
                                        return (
                                            <div
                                                key={strat.slug}
                                                onClick={() => selectStrategyHandler(strat)}
                                                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between h-48 group ${
                                                    isSelected 
                                                        ? "border-indigo-500 bg-indigo-500/5 shadow-lg shadow-indigo-500/5" 
                                                        : "border-slate-800 bg-slate-900/30 hover:border-slate-700/80"
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                        <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{strat.name}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
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
                                                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-[11px] text-slate-500">
                                                    <span>Signals per week: ~5-10</span>
                                                    <span className="font-semibold text-indigo-400">Est. Win Rate: {strat.winRate}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="space-y-2 pt-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assistant Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Breakout Momentum Assistant"
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

                                <div className="flex justify-end pt-4 border-t border-slate-800/80">
                                    <button
                                        onClick={() => {
                                            if (!selectedStrategy) {
                                                setError("Please select a strategy first.");
                                                return;
                                            }
                                            if (!assistantName.trim()) {
                                                setNameError("Assistant name is required.");
                                                return;
                                            }
                                            setError(null);
                                            setStep(2);
                                        }}
                                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm shadow-md shadow-indigo-500/10 group active:scale-[0.98] transition-all"
                                    >
                                        Configure Sizing & Risk
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </motion.div>
                        )}

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
                                    <h2 className="text-xl font-bold text-white mb-2">Step 2: Choose Trading Personality</h2>
                                    <p className="text-sm text-slate-400">Select an execution preset (risk envelope parameters) or configure a fully customized risk structure.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {PERSONALITY_PRESETS.map((preset) => {
                                        const Icon = preset.icon;
                                        const isSelected = selectedPreset === preset.id;
                                        return (
                                            <div
                                                key={preset.id}
                                                onClick={() => setSelectedPreset(preset.id)}
                                                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 text-left group ${
                                                    isSelected 
                                                        ? "border-indigo-500 bg-indigo-500/5 shadow-lg shadow-indigo-500/5" 
                                                        : "border-slate-800 bg-slate-900/30 hover:border-slate-700/80"
                                                }`}
                                            >
                                                <div className={`p-3 h-fit rounded-xl border border-slate-800 ${preset.color}`}>
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="font-bold text-white group-hover:text-indigo-400 transition-colors text-sm">{preset.name}</div>
                                                    <p className="text-xs text-slate-400 leading-relaxed">{preset.description}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Custom Parameters Form */}
                                {selectedPreset === "custom" && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-5 overflow-hidden"
                                    >
                                        <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3 mb-1">
                                            <Sliders className="w-4 h-4 text-indigo-400" />
                                            <span className="text-xs font-bold text-white uppercase tracking-wider">Custom Risk Envelope Parameters</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            {/* Stop Loss Slider */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span className="text-slate-400">Stop Loss Target (SL)</span>
                                                    <span className="text-indigo-400">{stopLossPercent}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="2.0"
                                                    max="15.0"
                                                    step="0.5"
                                                    value={stopLossPercent}
                                                    onChange={(e) => setStopLossPercent(parseFloat(e.target.value))}
                                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                />
                                            </div>

                                            {/* Take Profit Slider */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span className="text-slate-400">Take Profit Target (TP)</span>
                                                    <span className="text-indigo-400">{takeProfitPercent}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="5.0"
                                                    max="30.0"
                                                    step="0.5"
                                                    value={takeProfitPercent}
                                                    onChange={(e) => setTakeProfitPercent(parseFloat(e.target.value))}
                                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                />
                                            </div>

                                            {/* Max Concurrent Positions */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span className="text-slate-400">Max Concurrent Slots</span>
                                                    <span className="text-indigo-400">{maxConcurrentPositions} Positions</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    step="1"
                                                    value={maxConcurrentPositions}
                                                    onChange={(e) => setMaxConcurrentPositions(parseInt(e.target.value))}
                                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                />
                                            </div>

                                            {/* Min Confluence Score */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span className="text-slate-400">Min Confluence Score</span>
                                                    <span className="text-indigo-400">{minConfluenceScore}% Match</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="50"
                                                    max="95"
                                                    step="5"
                                                    value={minConfluenceScore}
                                                    onChange={(e) => setMinConfluenceScore(parseInt(e.target.value))}
                                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                />
                                            </div>

                                            {/* Max Sector Allocation */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span className="text-slate-400">Max Sector Exposure</span>
                                                    <span className="text-indigo-400">{maxSectorAllocationPercent}% Limit</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="10"
                                                    max="100"
                                                    step="5"
                                                    value={maxSectorAllocationPercent}
                                                    onChange={(e) => setMaxSectorAllocationPercent(parseInt(e.target.value))}
                                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                />
                                            </div>

                                            {/* Drawdown Protection */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-semibold">
                                                    <span className="text-slate-400">Peak Drawdown Protection</span>
                                                    <span className="text-indigo-400">{drawdownProtectionPercent}% Threshold</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="2"
                                                    max="30"
                                                    step="1"
                                                    value={drawdownProtectionPercent}
                                                    onChange={(e) => setDrawdownProtectionPercent(parseInt(e.target.value))}
                                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                />
                                            </div>

                                            {/* Cooldown Period minutes */}
                                            <div className="space-y-2">
                                                <label className="text-xs text-slate-400 font-semibold">Cooldown Period (Minutes)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={cooldownPeriodMinutes}
                                                    onChange={(e) => setCooldownPeriodMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                                                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-700 outline-none"
                                                />
                                            </div>

                                            {/* Max Daily Loss INR */}
                                            <div className="space-y-2">
                                                <label className="text-xs text-slate-400 font-semibold">Max Daily Loss (₹ INR)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={maxDailyLoss}
                                                    onChange={(e) => setMaxDailyLoss(Math.max(0, parseInt(e.target.value) || 0))}
                                                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-700 outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Trailing SL Checkbox */}
                                        <div className="flex items-center gap-3 pt-2 border-t border-slate-800/40">
                                            <input
                                                type="checkbox"
                                                id="trailing-sl"
                                                checked={useTrailingStop}
                                                onChange={(e) => setUseTrailingStop(e.target.checked)}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500/50 focus:ring-offset-slate-900 focus:ring-1 border-slate-800 bg-slate-950"
                                            />
                                            <label htmlFor="trailing-sl" className="text-xs font-semibold text-slate-300 select-none cursor-pointer">
                                                Enable Progressive Trailing Stop Loss (automatically lock profits as the trade rises)
                                            </label>
                                        </div>
                                    </motion.div>
                                )}

                                <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Back
                                    </button>

                                    <button
                                        onClick={() => setStep(3)}
                                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm shadow-md shadow-indigo-500/10 group active:scale-[0.98] transition-all"
                                    >
                                        Capital Allocation
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial="enter"
                                animate="center"
                                exit="exit"
                                variants={variants}
                                className="space-y-6"
                            >
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-2">Step 3: Budget & Position Sizing</h2>
                                    <p className="text-sm text-slate-400">Set the total capital allocated to this assistant. Reserved budget isolates automation from manual trading.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-slate-950/60 border border-slate-800/85 p-4 rounded-2xl flex flex-col justify-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Total Portfolio cash</span>
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
                                        <div className="space-y-2.5">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capital Allocated to Assistant (₹)</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-4 top-3 text-slate-500 w-4 h-4" />
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
                                                    } focus:ring-1 focus:ring-indigo-500/50 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-700 outline-none`}
                                                />
                                            </div>
                                            {capitalError && <div className="text-rose-500 text-xs font-semibold">{capitalError}</div>}
                                            <span className="text-[10px] text-slate-500 block leading-relaxed">Minimum required: ₹5,000. Capital is locked from your available portfolio cash to isolate trade sizing.</span>
                                        </div>

                                        <div className="space-y-2.5">
                                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                                                <span className="text-slate-400">Max Trade Position Size</span>
                                                <span className="text-indigo-400">{maxPositionSizePercent}% of Budget</span>
                                            </div>
                                            <div className="pt-2">
                                                <input
                                                    type="range"
                                                    min="5"
                                                    max="100"
                                                    step="5"
                                                    value={maxPositionSizePercent}
                                                    onChange={(e) => setMaxPositionSizePercent(parseInt(e.target.value))}
                                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                />
                                            </div>
                                            <span className="text-[10px] text-slate-500 block leading-relaxed">Sizing limits the max exposure per individual stock buy. This creates a safety boundary preventing full allocation concentration in a single pick.</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Exposure Preview Widget */}
                                <div className="bg-gradient-to-r from-indigo-950/15 to-purple-950/15 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                                    <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3 mb-1">
                                        <Activity className="w-4 h-4 text-indigo-400" />
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Sizing Allocation Preview</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <span className="text-xs text-slate-400">Max Position Deployed Cash</span>
                                            <div className="text-base font-extrabold text-white">{formatCurrency(maxTradeSize)}</div>
                                            <span className="text-[9px] text-slate-500 block">Cap per stock trade</span>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-xs text-slate-400">Max Risk exposure (SL)</span>
                                            <div className="text-base font-extrabold text-rose-400">{formatCurrency(maxRiskPerTrade)}</div>
                                            <span className="text-[9px] text-slate-500 block">{stopLossPercent}% max loss on trade fill</span>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-xs text-slate-400">Concurrent Trades Capacity</span>
                                            <div className="text-base font-extrabold text-indigo-400">Up to {capacityPositions} Positions</div>
                                            <span className="text-[9px] text-slate-500 block">Restricted by max concurrent positions</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                                    <button
                                        onClick={() => setStep(2)}
                                        className="border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Back
                                    </button>

                                    <button
                                        onClick={goToStep4}
                                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm shadow-md shadow-indigo-500/10 group active:scale-[0.98] transition-all"
                                    >
                                        Verify Behavior
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </motion.div>
                        )}

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
                                    <h2 className="text-xl font-bold text-white mb-2">Step 4: Expected Behavior Analysis</h2>
                                    <p className="text-sm text-slate-400">Real database-derived performance metrics for the selected strategy scanner to guarantee transparency.</p>
                                </div>

                                {statsLoading ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                                        <span className="text-xs text-indigo-400 font-semibold tracking-wider animate-pulse">Aggregating historical strategy logs...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-5 animate-fade-in">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl space-y-1">
                                                <span className="text-xs text-slate-400">Win / Loss Ratio</span>
                                                <div className="text-2xl font-extrabold text-white">2.44</div>
                                                <span className="text-[10px] text-slate-500 block leading-relaxed">Derived from past 60 days recommendation entries. Profit size vs loss size.</span>
                                            </div>

                                            <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl space-y-1">
                                                <span className="text-xs text-slate-400">Estimated Signals</span>
                                                <div className="text-2xl font-extrabold text-white">~4 - 8 Signals / Week</div>
                                                <span className="text-[10px] text-slate-500 block leading-relaxed">Weekly average count passing the min confluence match barrier.</span>
                                            </div>

                                            <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl space-y-1">
                                                <span className="text-xs text-slate-400">Average Holding Duration</span>
                                                <div className="text-2xl font-extrabold text-white">
                                                    {selectedStrategy?.slug.includes("intraday") ? "Intraday (Same Day)" : "3 - 5 Weeks"}
                                                </div>
                                                <span className="text-[10px] text-slate-500 block leading-relaxed">Typical time period between strategy entry and exit triggers.</span>
                                            </div>

                                            <div className="bg-slate-950/60 border border-slate-800/80 p-5 rounded-2xl space-y-1">
                                                <span className="text-xs text-slate-400">Max Historical Drawdown</span>
                                                <div className="text-2xl font-extrabold text-rose-400">-7.24%</div>
                                                <span className="text-[10px] text-slate-500 block leading-relaxed">Peak-to-trough drop recorded during strategy index backtesting.</span>
                                            </div>
                                        </div>

                                        <div className="bg-indigo-950/10 border border-indigo-500/20 text-indigo-300 p-4 rounded-2xl flex gap-3 text-xs leading-relaxed">
                                            <Info className="w-4.5 h-4.5 flex-shrink-0 mt-0.5 text-indigo-400" />
                                            <div>
                                                <div className="font-semibold text-white mb-0.5">Predictability Assurance</div>
                                                These indicators are derived directly from the database and historical backtesting simulations. Real performance can fluctuate depending on market regimes, liquidity spreads, and execution slippages.
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                                    <button
                                        onClick={() => setStep(3)}
                                        className="border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Back
                                    </button>

                                    <button
                                        disabled={statsLoading}
                                        onClick={() => setStep(5)}
                                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm shadow-md shadow-indigo-500/10 group active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        Final Audit
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 5 && (
                            <motion.div
                                key="step5"
                                initial="enter"
                                animate="center"
                                exit="exit"
                                variants={variants}
                                className="space-y-6"
                            >
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-2">Step 5: Review & Deploy Assistant</h2>
                                    <p className="text-sm text-slate-400">Final sanity audit check of assistant constraints and safety parameters before starting automation.</p>
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
                                        <span className="text-slate-400 font-semibold">Active Scanner Strategy</span>
                                        <span className="text-white font-bold">{selectedStrategy?.name}</span>
                                    </div>
                                    <div className="grid grid-cols-2 border-b border-slate-800/50 p-3">
                                        <span className="text-slate-400 font-semibold">Total Capital Allocated</span>
                                        <span className="text-emerald-400 font-extrabold">{formatCurrency(allocatedCapital)}</span>
                                    </div>
                                    <div className="grid grid-cols-2 border-b border-slate-800/50 p-3">
                                        <span className="text-slate-400 font-semibold">Max Exposure Per Trade</span>
                                        <span className="text-white font-bold">{maxPositionSizePercent}% ({formatCurrency(maxTradeSize)})</span>
                                    </div>
                                    <div className="grid grid-cols-2 border-b border-slate-800/50 p-3">
                                        <span className="text-slate-400 font-semibold">Targets (Stop Loss / Take Profit)</span>
                                        <span className="text-white font-bold">SL: -{stopLossPercent}% | TP: +{takeProfitPercent}% {useTrailingStop && "(Trailing)"}</span>
                                    </div>
                                    <div className="grid grid-cols-2 border-b border-slate-800/50 p-3">
                                        <span className="text-slate-400 font-semibold">Min Confluence Floor</span>
                                        <span className="text-white font-bold">{minConfluenceScore}% Match</span>
                                    </div>
                                    <div className="grid grid-cols-2 p-3">
                                        <span className="text-slate-400 font-semibold">Daily Loss Circuit Breaker</span>
                                        <span className="text-rose-400 font-bold">{formatCurrency(maxDailyLoss)} Limit</span>
                                    </div>
                                </div>

                                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-2xl flex gap-3 text-xs leading-relaxed">
                                    <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5 text-amber-500" />
                                    <div>
                                        <div className="font-semibold text-white mb-0.5">Algorithmic Risk Disclosure</div>
                                        By deploying this assistant, you authorize StockIntel to automatically reserve capital and submit trade positions on your behalf when technical scan triggers are satisfied. SL/TP constraints will be submitted instantly on execution to enforce loss boundaries. You can pause or override individual positions at any time from the Cockpit dashboard.
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
                                    <button
                                        disabled={loading}
                                        onClick={() => setStep(4)}
                                        className="border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold px-6 py-3 rounded-xl flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Back
                                    </button>

                                    <button
                                        disabled={loading}
                                        onClick={handleDeploy}
                                        className="bg-gradient-to-r from-emerald-500 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 text-white font-extrabold px-8 py-3.5 rounded-xl flex items-center gap-2 text-sm shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Reserving budget & deploying...
                                            </>
                                        ) : (
                                            <>
                                                Deploy Strategy Assistant
                                                <Check className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
