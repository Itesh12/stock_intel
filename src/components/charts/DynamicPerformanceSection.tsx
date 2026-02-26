"use client";

import React, { useState, useEffect } from 'react';
import InteractiveChart from './InteractiveChart';
import { CandleLoader } from '../ui/candle-loader';

interface DynamicPerformanceSectionProps {
    initialData: any[];
    symbol: string;
    isPositive: boolean;
    low: number;
    high: number;
    current: number;
}

export default function DynamicPerformanceSection({
    initialData,
    symbol,
    isPositive,
    low,
    high,
    current
}: DynamicPerformanceSectionProps) {
    const [period, setPeriod] = useState('1mo');
    const [data, setData] = useState(initialData);
    const [isLoading, setIsLoading] = useState(false);
    const [periodStats, setPeriodStats] = useState({ low: low, high: high });

    const formatCurrency = (amount: number, minimumFractionDigits = 2) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits,
            maximumFractionDigits: minimumFractionDigits
        }).format(amount);
    };

    const timeframes = [
        { label: '1D', value: '1d' },
        { label: '1M', value: '1mo' },
        { label: '3M', value: '3mo' },
        { label: '6M', value: '6mo' },
        { label: '1Y', value: '1y' },
        { label: '5Y', value: '5y' },
        { label: 'YTD', value: 'ytd' },
        { label: 'ALL', value: 'all' }
    ];

    useEffect(() => {
        if (period === '1mo' && data === initialData) {
            updateStats(initialData);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/stock/history?symbol=${encodeURIComponent(symbol)}&period=${period}&_t=${Date.now()}`, {
                    cache: 'no-store'
                });
                const historicalData = await res.json();
                setData(historicalData);
                updateStats(historicalData);
            } catch (err) {
                console.error("Failed to fetch historical data", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [period, symbol, initialData]);

    const updateStats = (history: any[]) => {
        if (!history || history.length === 0) return;
        const prices = history.map(d => d.close).filter(p => typeof p === 'number');
        if (prices.length > 0) {
            setPeriodStats({
                low: Math.min(...prices, current),
                high: Math.max(...prices, current)
            });
        }
    };

    const rangePercent = Math.min(Math.max(((current - low) / (high - low)) * 100, 0), 100);

    return (
        <div className="glass-card p-8 lg:col-span-3 min-h-[500px] flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-600/10 transition-colors"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 relative z-10">
                <div>
                    <h2 className="text-xl font-black text-white font-outfit tracking-tight">Asset Drift Analysis</h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1">
                        {timeframes.find(t => t.value === period)?.label} Predictive Trajectory
                    </p>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                        {timeframes.map((tf) => (
                            <button
                                key={tf.value}
                                onClick={() => setPeriod(tf.value)}
                                disabled={isLoading}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${period === tf.value
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40'
                                    : 'text-slate-500 hover:text-white'
                                    }`}
                            >
                                {tf.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 relative h-[400px] min-h-[400px] z-10">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-sm rounded-3xl z-20">
                        <CandleLoader />
                    </div>
                ) : null}
                <InteractiveChart data={data} isPositive={isPositive} />
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                <div className="lg:col-span-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Period Range ({timeframes.find(t => t.value === period)?.label})</span>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-black text-white">{formatCurrency(periodStats.low)}</span>
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full relative overflow-hidden">
                            <div
                                className={`absolute inset-y-0 left-0 bg-gradient-to-r ${isPositive ? 'from-emerald-500/20 to-emerald-500' : 'from-rose-500/20 to-rose-500'} opacity-30`}
                                style={{ width: '100%' }}
                            ></div>
                        </div>
                        <span className="text-xs font-black text-white">{formatCurrency(periodStats.high)}</span>
                    </div>
                </div>
                <div className="lg:col-span-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">52W Range Accuracy</span>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-black text-white group-hover:text-rose-400 transition-colors">{formatCurrency(low, 0)}</span>
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full relative">
                            <div
                                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-blue-600 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)] z-10 transition-all duration-500"
                                style={{ left: `${rangePercent}%` }}
                            ></div>
                            <div className="h-full bg-gradient-to-r from-rose-500/30 via-blue-500/50 to-emerald-500/30 rounded-full"></div>
                        </div>
                        <span className="text-xs font-black text-white group-hover:text-emerald-400 transition-colors">{formatCurrency(high, 0)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
