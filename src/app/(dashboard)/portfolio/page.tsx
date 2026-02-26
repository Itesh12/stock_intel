"use client";
import React, { useState, useEffect } from "react";
import { PieChart, Briefcase, TrendingUp, ShieldAlert, Cpu, ArrowUpRight, ArrowDownRight, MoreHorizontal, Database, Wallet, Plus, ShoppingCart, Ban, Loader2, Coins, ArrowRight, History, RotateCcw, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency, formatIndianNumber, cn } from "@/lib/utils";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PortfolioPage() {
    const [portfolio, setPortfolio] = useState<any>(null);
    const [trades, setTrades] = useState<any[]>([]);
    const [limitOrders, setLimitOrders] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPortfolio = async () => {
        setIsLoading(true);
        try {
            const [portRes, tradeRes, analyticsRes, limitRes] = await Promise.all([
                fetch('/api/portfolio/me'),
                fetch('/api/trade/history'),
                fetch('/api/portfolio/analytics'),
                fetch('/api/trade/limit')
            ]);
            const portData = await portRes.json();
            const tradeData = await tradeRes.json();
            const analyticsData = await analyticsRes.json();
            const limitData = await limitRes.json();

            setPortfolio(portData);
            setTrades(tradeData || []);
            setLimitOrders(limitData || []);
            setAnalytics(analyticsData);
        } catch (err) {
            console.error("Failed to fetch dashboard data", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPortfolio();
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <div className="flex items-center justify-center gap-1.5 h-8">
                    <div className="flex flex-col items-center">
                        <div className="candle-wick text-emerald-500/40"></div>
                        <div className="candle-green"></div>
                        <div className="candle-wick text-emerald-500/40"></div>
                    </div>
                    <div className="flex flex-col items-center translate-y-2">
                        <div className="candle-wick text-rose-500/40"></div>
                        <div className="candle-red"></div>
                        <div className="candle-wick text-rose-500/40"></div>
                    </div>
                </div>
                <span className="text-xs font-bold text-slate-500 tracking-[0.4em] uppercase">Hydrating Portfolio Node</span>
            </div>
        );
    }

    const holdings = portfolio?.holdings || [];

    const totalInvested = holdings.reduce((acc: number, h: any) => acc + (h.quantity * h.averagePrice), 0);
    const totalUnrealizedPL = holdings.reduce((acc: number, h: any) => acc + (h.unrealizedPL || 0), 0);
    const totalUnrealizedPLPercent = totalInvested > 0 ? (totalUnrealizedPL / totalInvested) * 100 : 0;
    const isTotalPositive = totalUnrealizedPL >= 0;

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="flex items-end justify-between border-b border-white/5 pb-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Briefcase size={14} className="text-blue-500" />
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em]">Asset Management</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white tracking-tight font-outfit">Portfolio Topology</h1>
                    <p className="text-slate-500 mt-2 text-sm font-medium">Deep-dive into your holdings, risk metrics, and structural allocation.</p>
                </div>

                {portfolio && (
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Available Liquidity</span>
                        <div className="text-2xl font-black text-emerald-400 font-outfit tracking-tighter">
                            ₹{formatIndianNumber(portfolio.cashBalance)}
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                    title="Net Asset Value"
                    value={`₹${formatIndianNumber(portfolio?.totalValue || 0)}`}
                    indicator={`${portfolio?.totalPLPercent?.toFixed(2) || 0}%`}
                    subIndicator={`${(portfolio?.dayPnL || 0) >= 0 ? '+' : ''}${portfolio?.dayPnLPercent?.toFixed(2) || 0}% Today`}
                    color={(portfolio?.totalPL || 0) >= 0 ? "emerald" : "blue"}
                />
                <StatCard
                    title="Buying Power"
                    value={`₹${formatIndianNumber(portfolio?.cashBalance || 0)}`}
                    indicator="READY"
                    color="emerald"
                />
                <StatCard title="Diversification" value={`${holdings.length} Nodes`} indicator="ACTIVE" color="blue" />
                <StatCard
                    title="Risk Intelligence"
                    value={analytics?.sharpeRatio?.toString() || "0.00"}
                    indicator="SHARPE"
                    subIndicator={`DD: ${analytics?.maxDrawdown || 0}%`}
                    color="blue"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-3 space-y-10">
                    <section className="glass-morphic-card rounded-[32px] p-8 border-emerald-500/10 h-[400px]">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Growth Matrix</h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Virtual Capital Trajectory (30D)</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-lg">+{((portfolio?.totalValue / 1000000 - 1) * 100).toFixed(2)}% All-Time</span>
                            </div>
                        </div>
                        <div className="h-[280px] w-full">
                            <PerformanceCurve data={analytics?.history || []} />
                        </div>
                    </section>

                    <section className="glass-morphic-card rounded-[32px] overflow-hidden">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white tracking-tight">Active Holdings</h2>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">Real-Time Sync</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            {holdings.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/[0.02] text-slate-500 text-[10px] uppercase tracking-widest border-b border-white/5">
                                            <th className="px-8 py-5 font-bold">Security</th>
                                            <th className="px-8 py-5 font-bold">Position</th>
                                            <th className="px-8 py-5 font-bold">Entry Basis</th>
                                            <th className="px-8 py-5 font-bold">Current Node</th>
                                            <th className="px-8 py-5 font-bold text-right">Market Valuation</th>
                                            <th className="px-8 py-5 font-bold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {holdings.map((holding: any) => (
                                            <HoldingRow
                                                key={holding.id}
                                                holding={holding}
                                                onTradeSuccess={fetchPortfolio}
                                            />
                                        ))}
                                        {holdings.length > 0 && (
                                            <tr className="bg-white/[0.02] border-t border-white/10 group hover:bg-white/[0.03] transition-colors">
                                                <td colSpan={4} className="px-8 py-6 text-left">
                                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-slate-300 transition-colors">Total Active P/L</span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className={cn(
                                                        "text-base font-black font-outfit tracking-tight",
                                                        isTotalPositive ? "text-emerald-400" : "text-rose-400"
                                                    )}>
                                                        {isTotalPositive ? '+' : '-'}₹{formatIndianNumber(Math.abs(totalUnrealizedPL))}
                                                    </div>
                                                    <div className="flex items-center justify-end gap-3 mt-0.5">
                                                        <div className={cn(
                                                            "text-[10px] font-bold",
                                                            isTotalPositive ? "text-emerald-500" : "text-rose-500"
                                                        )}>
                                                            {isTotalPositive ? '+' : ''}{totalUnrealizedPLPercent.toFixed(2)}%
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                                                            <span className="text-emerald-500 flex items-center gap-0.5"><ArrowUp size={8} />{holdings.filter((h: any) => h.unrealizedPL >= 0).length}</span>
                                                            <span className="text-white/20">|</span>
                                                            <span className="text-rose-500 flex items-center gap-0.5"><ArrowDown size={8} />{holdings.filter((h: any) => h.unrealizedPL < 0).length}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6"></td>
                                            </tr>
                                        )}
                                        {holdings.length > 0 && (
                                            <>
                                                {(() => {
                                                    const validHoldings = holdings.filter((h: any) => typeof h.unrealizedPLPercent === 'number');
                                                    if (validHoldings.length === 0) return null;

                                                    const sorted = [...validHoldings].sort((a: any, b: any) => b.unrealizedPLPercent - a.unrealizedPLPercent);
                                                    const best = sorted[0];
                                                    const worst = sorted[sorted.length - 1];

                                                    return (
                                                        <>
                                                            {best && best.unrealizedPLPercent > 0 && (
                                                                <tr className="bg-emerald-500/[0.02] border-t border-emerald-500/10 group hover:bg-emerald-500/[0.04] transition-colors">
                                                                    <td colSpan={4} className="px-8 py-4 text-left">
                                                                        <div className="flex items-center justify-start gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 group-hover:text-emerald-400 transition-colors">
                                                                            <ArrowUpRight size={14} className="text-emerald-500" />
                                                                            Top Performer ({best.symbol})
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-8 py-4 text-right">
                                                                        <div className="text-sm font-black font-outfit tracking-tight text-emerald-400">
                                                                            +₹{formatIndianNumber(Math.abs(best.unrealizedPL))}
                                                                        </div>
                                                                        <div className="text-[9px] font-bold mt-0.5 text-emerald-500">
                                                                            +{best.unrealizedPLPercent.toFixed(2)}%
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-8 py-4"></td>
                                                                </tr>
                                                            )}
                                                            {worst && worst.unrealizedPLPercent < 0 && (
                                                                <tr className="bg-rose-500/[0.02] border-t border-rose-500/10 group hover:bg-rose-500/[0.04] transition-colors">
                                                                    <td colSpan={4} className="px-8 py-4 text-left">
                                                                        <div className="flex items-center justify-start gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-500/70 group-hover:text-rose-400 transition-colors">
                                                                            <ArrowDownRight size={14} className="text-rose-500" />
                                                                            Max Drawdown ({worst.symbol})
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-8 py-4 text-right">
                                                                        <div className="text-sm font-black font-outfit tracking-tight text-rose-400">
                                                                            -₹{formatIndianNumber(Math.abs(worst.unrealizedPL))}
                                                                        </div>
                                                                        <div className="text-[9px] font-bold mt-0.5 text-rose-500">
                                                                            {worst.unrealizedPLPercent.toFixed(2)}%
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-8 py-4"></td>
                                                                </tr>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </tbody>


                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                                        <Database className="text-slate-600" size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-400 font-outfit mb-2">Portfolio Empty</h3>
                                    <p className="text-sm text-slate-600 max-w-sm">No active holdings detected. Your portfolio positions will appear here once trades are executed in the marketplace.</p>
                                    <Link href="/market" className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm transition-all">
                                        Exploration Hub
                                    </Link>
                                </div>
                            )}
                        </div>
                    </section>

                    {limitOrders.filter(o => o.status === 'PENDING').length > 0 && (
                        <section className="glass-morphic-card rounded-[32px] overflow-hidden border-amber-500/10">
                            <div className="p-8 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Cpu size={20} className="text-amber-500" />
                                    <h2 className="text-xl font-bold text-white tracking-tight">Open Intelligence Orders</h2>
                                </div>
                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/5 px-3 py-1.5 rounded-lg border border-amber-500/20">Pending Trigger</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/[0.02] text-slate-500 text-[10px] uppercase tracking-widest border-b border-white/5">
                                            <th className="px-8 py-5 font-bold">Type</th>
                                            <th className="px-8 py-5 font-bold">Security</th>
                                            <th className="px-8 py-5 font-bold">Target Strike</th>
                                            <th className="px-8 py-5 font-bold text-center">Quantity</th>
                                            <th className="px-8 py-5 font-bold text-right">Requirement</th>
                                            <th className="px-8 py-5 font-bold text-right">Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {limitOrders.filter(o => o.status === 'PENDING').map((order: any) => (
                                            <tr key={order.id} className="hover:bg-amber-500/[0.02] transition-all group">
                                                <td className="px-8 py-5">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-tight border",
                                                        order.type === 'BUY'
                                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                                    )}>
                                                        {order.type} LIMIT
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="font-bold text-white text-sm tracking-tight">{order.symbol}</span>
                                                </td>
                                                <td className="px-8 py-5 text-amber-500 font-mono text-sm tracking-tighter">
                                                    ₹{order.targetPrice.toFixed(2)}
                                                </td>
                                                <td className="px-8 py-5 text-center text-slate-300 font-bold font-mono text-sm">
                                                    {order.quantity}
                                                </td>
                                                <td className="px-8 py-5 text-right font-bold text-white">
                                                    ₹{formatIndianNumber(order.targetPrice * order.quantity)}
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                                                            {new Date(order.timestamp).toLocaleDateString()}
                                                        </span>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm('Cancel this intelligence order?')) {
                                                                    const res = await fetch(`/api/trade/limit?id=${order.id}`, { method: 'DELETE' });
                                                                    if (res.ok) fetchPortfolio();
                                                                }
                                                            }}
                                                            className="p-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                                        >
                                                            <Ban size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    <section className="glass-morphic-card rounded-[32px] overflow-hidden">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <History size={20} className="text-slate-400" />
                                <h2 className="text-xl font-bold text-white tracking-tight">Transaction Ledger</h2>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">{trades.length} Records</span>
                        </div>
                        <div className="overflow-x-auto">
                            {trades.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white/[0.02] text-slate-500 text-[10px] uppercase tracking-widest border-b border-white/5">
                                            <th className="px-8 py-5 font-bold text-center">Type</th>
                                            <th className="px-8 py-5 font-bold">Security</th>
                                            <th className="px-8 py-5 font-bold">Execution Price</th>
                                            <th className="px-8 py-5 font-bold text-center">Quantity</th>
                                            <th className="px-8 py-5 font-bold text-right">Total Flow</th>
                                            <th className="px-8 py-5 font-bold text-right">Timestamp</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {trades.map((trade: any) => (
                                            <tr key={trade.id} className="hover:bg-white/[0.03] transition-all group">
                                                <td className="px-8 py-5 text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-tight border",
                                                        trade.type === 'BUY'
                                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                                    )}>
                                                        {trade.type === 'BUY' ? <ArrowDown size={10} /> : <ArrowUp size={10} />}
                                                        {trade.type}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="font-bold text-white text-sm tracking-tight">{trade.symbol}</span>
                                                </td>
                                                <td className="px-8 py-5 text-slate-400 font-mono text-sm tracking-tighter">
                                                    ₹{trade.price.toFixed(2)}
                                                </td>
                                                <td className="px-8 py-5 text-center text-slate-300 font-bold font-mono text-sm">
                                                    {trade.quantity}
                                                </td>
                                                <td className="px-8 py-5 text-right font-bold text-white">
                                                    ₹{formatIndianNumber(trade.totalValue)}
                                                </td>
                                                <td className="px-8 py-5 text-right text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                                                    {new Date(trade.timestamp).toLocaleDateString()} {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center opacity-40">
                                    <History size={40} className="text-slate-600 mb-4" />
                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">No historical transactions detected</span>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="space-y-10">
                    <section className="glass-morphic-card rounded-[32px] p-8 border-blue-500/10 mb-10">
                        <FinanceManagement onDepositSuccess={fetchPortfolio} />
                    </section>

                    <section className="glass-morphic-card rounded-[32px] p-8 border-indigo-500/10">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <ShieldAlert size={20} className="text-indigo-500" />
                                <h2 className="text-lg font-bold text-white tracking-tight">Risk Intelligence</h2>
                            </div>
                            <ResetPortfolioButton onReset={fetchPortfolio} />
                        </div>

                        <div className="space-y-8">
                            <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                                <div className="flex justify-between items-end mb-4">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">Composite Risk Score</span>
                                    <span className="text-2xl font-black text-emerald-400 font-mono leading-none tracking-tighter">24<span className="text-[10px] text-slate-600 ml-1">/100</span></span>
                                </div>
                                <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 w-[24%] shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Sector Concentration</div>
                                <div className="space-y-4">
                                    {Object.entries(portfolio?.sectorExposure || {}).length > 0 ? (
                                        Object.entries(portfolio.sectorExposure).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([sector, percent]: any, idx) => (
                                            <ExposureBar
                                                key={sector}
                                                label={sector}
                                                percent={Math.round(percent)}
                                                color={idx === 0 ? 'blue' : idx === 1 ? 'indigo' : 'slate'}
                                            />
                                        ))
                                    ) : (
                                        <div className="py-10 text-center opacity-20">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">No sector data</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, indicator, subIndicator, color }: { title: string; value: string; indicator: string; subIndicator?: string; color: 'emerald' | 'blue' }) {
    const colorClass = color === 'emerald' ? 'text-emerald-400 bg-emerald-400/10' : 'text-blue-400 bg-blue-400/10';
    return (
        <div className="glass-morphic-card rounded-[24px] p-6 group">
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">{title}</div>
            <div className="flex items-baseline justify-between gap-4">
                <div className="text-2xl font-black text-white font-outfit tracking-tighter">{value}</div>
                <div className="flex flex-col items-end gap-1">
                    <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-tight ${colorClass}`}>{indicator}</div>
                    {subIndicator && (
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{subIndicator}</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ResetPortfolioButton({ onReset }: { onReset: () => void }) {
    const [isResetting, setIsResetting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleReset = async () => {
        setIsResetting(true);
        try {
            const res = await fetch('/api/portfolio/reset', { method: 'POST' });
            if (res.ok) {
                onReset();
                setShowConfirm(false);
            }
        } catch (err) {
            console.error("Reset failed", err);
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowConfirm(!showConfirm)}
                className="p-2 rounded-xl bg-white/5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-all border border-white/10"
                title="Reset Portfolio"
            >
                <RotateCcw size={16} />
            </button>

            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute right-0 top-12 bg-[#121214] border border-rose-500/20 rounded-2xl p-4 shadow-2xl z-50 w-56 text-left"
                    >
                        <h4 className="text-[10px] font-bold text-white uppercase tracking-widest mb-2">Nuclear Reset?</h4>
                        <p className="text-[9px] text-slate-500 leading-relaxed mb-4">This will wipe all holdings and history, resetting balance to 10 Lakhs. This cannot be undone.</p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleReset}
                                disabled={isResetting}
                                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                {isResetting ? <Loader2 size={10} className="animate-spin" /> : "Reset"}
                            </button>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg text-[9px] font-bold uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function HoldingRow({ holding, onTradeSuccess }: any) {
    const { symbol, quantity: qty, averagePrice: avg, currentPrice: cur, marketValue: val, unrealizedPL: pl } = holding;
    const isPositive = pl >= 0;
    const [isSelling, setIsSelling] = useState(false);
    const [sellQty, setSellQty] = useState(1);
    const [showSellAction, setShowSellAction] = useState(false);

    const handleSell = async () => {
        setIsSelling(true);
        try {
            const res = await fetch('/api/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, quantity: sellQty, type: 'SELL' })
            });
            if (res.ok) {
                onTradeSuccess();
                setShowSellAction(false);
            }
        } catch (err) {
            console.error("Sell failed", err);
        } finally {
            setIsSelling(false);
        }
    };

    return (
        <tr className="hover:bg-white/[0.03] transition-all group border-b border-white/[0.02]">
            <td className="px-8 py-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center font-bold text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm border border-white/5">{symbol[0]}</div>
                    <Link href={`/stock/${symbol}`} className="cursor-pointer">
                        <div className="font-bold text-white text-base tracking-tight leading-none mb-1 group-hover:text-blue-400 transition-colors">{symbol}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Equity Node</div>
                    </Link>
                </div>
            </td>
            <td className="px-8 py-6 text-sm font-bold text-slate-300 font-mono tracking-tighter">{qty}</td>
            <td className="px-8 py-6 text-sm text-slate-600 font-medium">₹{avg.toFixed(2)}</td>
            <td className="px-8 py-6 text-sm text-slate-300 font-bold font-mono tracking-tighter">
                <div>₹{cur.toFixed(2)}</div>
                {holding.dayChange !== undefined && (
                    <div className={`text-[9px] font-bold ${holding.dayChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {holding.dayChange >= 0 ? '+' : ''}{holding.dayChangePercent.toFixed(2)}%
                    </div>
                )}
            </td>
            <td className="px-8 py-6 text-base text-white font-black text-right font-outfit tracking-tight">
                <div>₹{formatIndianNumber(val)}</div>
                {holding.unrealizedPL !== undefined && (
                    <div className={`text-[10px] font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{holding.unrealizedPLPercent.toFixed(2)}%
                    </div>
                )}
            </td>
            <td className="px-8 py-6 text-right relative">
                <div className="flex items-center justify-end gap-2">
                    <Link
                        href={`/stock/${symbol}`}
                        className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20"
                        title="Add More"
                    >
                        <Plus size={16} />
                    </Link>
                    <button
                        onClick={() => setShowSellAction(!showSellAction)}
                        className="p-2 rounded-xl bg-white/5 text-slate-400 hover:bg-rose-600 hover:text-white transition-all border border-white/10"
                        title="Liquidate"
                    >
                        <ShoppingCart size={16} />
                    </button>
                </div>

                <AnimatePresence>
                    {showSellAction && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="absolute right-8 top-16 bg-[#121214] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 w-48 text-left"
                        >
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Liquidate units</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={sellQty}
                                            max={qty}
                                            min={1}
                                            onChange={(e) => setSellQty(Math.min(qty, Math.max(1, parseInt(e.target.value) || 0)))}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                                        />
                                        <button
                                            onClick={() => setSellQty(qty)}
                                            className="text-[9px] font-bold text-blue-400 hover:text-white transition-colors"
                                        >
                                            MAX
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSell}
                                    disabled={isSelling}
                                    className="w-full py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    {isSelling ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                                    Execute Sell
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </td>
        </tr>
    );
}

function FinanceManagement({ onDepositSuccess }: { onDepositSuccess: () => void }) {
    const [amount, setAmount] = useState(100000);
    const [isDepositing, setIsDepositing] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    const presets = [
        { label: '1L', value: 100000 },
        { label: '5L', value: 500000 },
        { label: '10L', value: 1000000 }
    ];

    const handleDeposit = async () => {
        setIsDepositing(true);
        setStatus({ type: null, message: '' });
        try {
            const res = await fetch('/api/portfolio/add-funds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: 'Funds deposited successfully' });
                onDepositSuccess();
                setTimeout(() => setStatus({ type: null, message: '' }), 3000);
            } else {
                setStatus({ type: 'error', message: data.error || 'Deposit failed' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Network error' });
        } finally {
            setIsDepositing(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <Coins size={20} className="text-emerald-500" />
                <h2 className="text-lg font-bold text-white tracking-tight">Finance Management</h2>
            </div>

            <div className="space-y-6">
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Deposit Virtual Capital</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-sm">₹</div>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-8 pr-4 py-4 text-white font-mono font-bold focus:outline-none focus:border-emerald-500 transition-all text-lg"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {presets.map(p => (
                        <button
                            key={p.value}
                            onClick={() => setAmount(p.value)}
                            className={cn(
                                "py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                                amount === p.value
                                    ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-900/40"
                                    : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleDeposit}
                    disabled={isDepositing || amount <= 0}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-emerald-900/20"
                >
                    {isDepositing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Inject Capital Stream
                </button>

                <AnimatePresence>
                    {status.type && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={cn(
                                "p-4 rounded-2xl border text-[10px] font-bold uppercase tracking-widest flex items-center gap-3",
                                status.type === 'success'
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            )}
                        >
                            {status.type === 'success' ? <TrendingUp size={16} /> : <ShieldAlert size={16} />}
                            {status.message}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function PerformanceCurve({ data }: { data: any[] }) {
    if (!data || data.length === 0) return (
        <div className="h-full flex items-center justify-center opacity-20">
            <span className="text-[10px] font-bold uppercase tracking-widest">Awaiting Data Points</span>
        </div>
    );

    const formattedData = [...data].reverse().map(d => ({
        date: new Date(d.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        nav: d.nav
    }));

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData}>
                <defs>
                    <linearGradient id="colorNav" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
                    dy={10}
                />
                <YAxis
                    hide={true}
                    domain={['auto', 'auto']}
                />
                <Tooltip
                    contentStyle={{ backgroundColor: '#121214', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                    itemStyle={{ color: '#10b981', fontWeight: 800 }}
                    labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                    formatter={(value: any) => [`₹${formatIndianNumber(value)}`, 'NAV']}
                />
                <Area
                    type="monotone"
                    dataKey="nav"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorNav)"
                    animationDuration={2000}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function ExposureBar({ label, percent, color }: { label: string; percent: number; color: string }) {
    const colorMap: any = { blue: 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]', indigo: 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]', slate: 'bg-slate-500 shadow-[0_0_10px_rgba(100,116,139,0.3)]' };
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                <span>{label}</span>
                <span className="text-white">{percent}%</span>
            </div>
            <div className="h-1 bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div className={`h-full ${colorMap[color]} rounded-full`} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}
