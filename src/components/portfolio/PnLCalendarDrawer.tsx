"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
    Calendar as CalendarIcon, 
    ChevronLeft, 
    ChevronRight, 
    X, 
    TrendingUp, 
    TrendingDown, 
    Award, 
    AlertTriangle, 
    Activity, 
    Clock, 
    ArrowUpRight, 
    ArrowDownRight,
    Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatIndianNumber, cn, formatSymbol } from "@/lib/utils";

interface DayTrade {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    totalValue: number;
    realizedPL?: number;
    averagePriceAtSale?: number;
    timestamp: string;
}

interface DayRecord {
    date: string;
    netPL: number;
    totalTrades: number;
    buyCount: number;
    sellCount: number;
    winCount: number;
    lossCount: number;
    trades: DayTrade[];
}

interface PnLCalendarDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function PnLCalendarDrawer({ isOpen, onClose }: PnLCalendarDrawerProps) {
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [dailyData, setDailyData] = useState<Record<string, DayRecord>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string | null>(() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });

    // Fetch daily P&L data when drawer opens
    useEffect(() => {
        if (!isOpen) return;

        let active = true;
        const fetchPnl = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/portfolio/pnl-calendar');
                const data = await res.json();
                if (active && data.dailyPnl) {
                    setDailyData(data.dailyPnl);
                }
            } catch (err) {
                console.error("Failed to load P&L calendar data:", err);
            } finally {
                if (active) setIsLoading(false);
            }
        };

        fetchPnl();

        return () => {
            active = false;
        };
    }, [isOpen]);

    // Month Navigation
    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const handleGoToToday = () => {
        const today = new Date();
        setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        setSelectedDate(`${y}-${m}-${d}`);
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Compute calendar grid days (Monday to Sunday)
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        // getDay() gives 0 for Sunday, 1 for Monday... 6 for Saturday
        // We want Monday = 0, Tuesday = 1, ... Sunday = 6
        const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const cells: Array<{
            dateStr: string;
            dayNumber: number;
            isCurrentMonth: boolean;
            isWeekend: boolean;
        }> = [];

        // Previous month filler days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDayIndex - 1; i >= 0; i--) {
            const d = prevMonthLastDay - i;
            const prevMonthDate = new Date(year, month - 1, d);
            const y = prevMonthDate.getFullYear();
            const m = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
            const dayStr = String(d).padStart(2, '0');
            const dayOfWeek = (prevMonthDate.getDay() + 6) % 7;
            cells.push({
                dateStr: `${y}-${m}-${dayStr}`,
                dayNumber: d,
                isCurrentMonth: false,
                isWeekend: dayOfWeek >= 5
            });
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const thisDate = new Date(year, month, d);
            const m = String(month + 1).padStart(2, '0');
            const dayStr = String(d).padStart(2, '0');
            const dayOfWeek = (thisDate.getDay() + 6) % 7;
            cells.push({
                dateStr: `${year}-${m}-${dayStr}`,
                dayNumber: d,
                isCurrentMonth: true,
                isWeekend: dayOfWeek >= 5
            });
        }

        // Trailing filler days to complete grid (multiples of 7)
        const remaining = (7 - (cells.length % 7)) % 7;
        for (let i = 1; i <= remaining; i++) {
            const nextMonthDate = new Date(year, month + 1, i);
            const y = nextMonthDate.getFullYear();
            const m = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
            const dayStr = String(i).padStart(2, '0');
            const dayOfWeek = (nextMonthDate.getDay() + 6) % 7;
            cells.push({
                dateStr: `${y}-${m}-${dayStr}`,
                dayNumber: i,
                isCurrentMonth: false,
                isWeekend: dayOfWeek >= 5
            });
        }

        return cells;
    }, [year, month]);

    // Monthly Aggregated Stats
    const monthStats = useMemo(() => {
        let netPL = 0;
        let greenDays = 0;
        let redDays = 0;
        let totalTrades = 0;
        let bestDay = { date: '', pl: -Infinity };
        let worstDay = { date: '', pl: Infinity };

        const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

        Object.entries(dailyData).forEach(([dateStr, record]) => {
            if (dateStr.startsWith(prefix)) {
                netPL += record.netPL;
                totalTrades += record.totalTrades;

                if (record.netPL > 0) {
                    greenDays++;
                    if (record.netPL > bestDay.pl) {
                        bestDay = { date: dateStr, pl: record.netPL };
                    }
                } else if (record.netPL < 0) {
                    redDays++;
                    if (record.netPL < worstDay.pl) {
                        worstDay = { date: dateStr, pl: record.netPL };
                    }
                }
            }
        });

        const activeTradingDays = greenDays + redDays;
        const winRate = activeTradingDays > 0 ? (greenDays / activeTradingDays) * 100 : 0;

        return {
            netPL,
            greenDays,
            redDays,
            totalTrades,
            winRate,
            bestDay: bestDay.pl !== -Infinity ? bestDay : null,
            worstDay: worstDay.pl !== Infinity ? worstDay : null
        };
    }, [dailyData, year, month]);

    const activeDayRecord = selectedDate ? dailyData[selectedDate] : null;

    const todayStr = useMemo(() => {
        const t = new Date();
        const y = t.getFullYear();
        const m = String(t.getMonth() + 1).padStart(2, '0');
        const d = String(t.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }, []);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Slide-over Drawer */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 28, stiffness: 220 }}
                        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-2xl bg-[#0a0a0d] border-l border-white/10 shadow-2xl flex flex-col h-full overflow-hidden"
                    >
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <CalendarIcon size={20} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white font-outfit uppercase tracking-tight">
                                        P&L Calendar Ledger
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        Option A: Realized Profit & Loss by Closed Trades
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {/* Month Navigator Bar */}
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handlePrevMonth}
                                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-all"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        onClick={handleNextMonth}
                                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-all"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                    <h4 className="text-base sm:text-lg font-black text-white font-outfit uppercase tracking-tight ml-2">
                                        {monthNames[month]} {year}
                                    </h4>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleGoToToday}
                                        className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-black text-emerald-400 border border-emerald-500/20 uppercase tracking-widest transition-all"
                                    >
                                        Today
                                    </button>
                                    {isLoading && (
                                        <Loader2 size={16} className="animate-spin text-emerald-400" />
                                    )}
                                </div>
                            </div>

                            {/* Monthly Aggregate Highlights Ribbon */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {/* Monthly Net P&L */}
                                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                        Monthly Realized P&L
                                    </div>
                                    <div className={cn(
                                        "text-base sm:text-lg font-black font-mono tracking-tight",
                                        monthStats.netPL >= 0 ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {monthStats.netPL >= 0 ? '+' : ''}₹{formatIndianNumber(Math.round(monthStats.netPL))}
                                    </div>
                                </div>

                                {/* Win Rate / Day Ratio */}
                                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                        Win Days Ratio
                                    </div>
                                    <div className="text-base sm:text-lg font-black text-white font-mono flex items-center gap-1.5">
                                        <span className="text-emerald-400">{monthStats.greenDays}W</span>
                                        <span className="text-slate-600">/</span>
                                        <span className="text-rose-400">{monthStats.redDays}L</span>
                                        <span className="text-[10px] text-slate-500 font-bold ml-1">
                                            ({monthStats.winRate.toFixed(0)}%)
                                        </span>
                                    </div>
                                </div>

                                {/* Best Day */}
                                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        <Award size={10} className="text-emerald-400" /> Best Day
                                    </div>
                                    <div className="text-xs sm:text-sm font-black text-emerald-400 font-mono truncate">
                                        {monthStats.bestDay ? `+₹${formatIndianNumber(Math.round(monthStats.bestDay.pl))}` : '-'}
                                    </div>
                                    {monthStats.bestDay && (
                                        <div className="text-[8px] text-slate-500 font-mono">
                                            {monthStats.bestDay.date}
                                        </div>
                                    )}
                                </div>

                                {/* Worst Day */}
                                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        <AlertTriangle size={10} className="text-rose-400" /> Worst Day
                                    </div>
                                    <div className="text-xs sm:text-sm font-black text-rose-400 font-mono truncate">
                                        {monthStats.worstDay ? `₹${formatIndianNumber(Math.round(monthStats.worstDay.pl))}` : '-'}
                                    </div>
                                    {monthStats.worstDay && (
                                        <div className="text-[8px] text-slate-500 font-mono">
                                            {monthStats.worstDay.date}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Calendar Days of Week Header (Mon to Sun) */}
                            <div className="space-y-2">
                                <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
                                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d, idx) => (
                                        <div 
                                            key={d} 
                                            className={cn(
                                                "text-[9px] font-black uppercase tracking-widest py-1 rounded",
                                                idx >= 5 ? "text-slate-600 bg-white/[0.01]" : "text-slate-400"
                                            )}
                                        >
                                            {d}
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar Day Cells Grid */}
                                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                                    {calendarDays.map((cell) => {
                                        const record = dailyData[cell.dateStr];
                                        const isSelected = selectedDate === cell.dateStr;
                                        const isToday = todayStr === cell.dateStr;

                                        const hasTrades = record && record.totalTrades > 0;
                                        const hasRealized = record && record.sellCount > 0;
                                        const isGreen = hasRealized && record.netPL > 0;
                                        const isRed = hasRealized && record.netPL < 0;
                                        const isBreakeven = hasRealized && record.netPL === 0;

                                        return (
                                            <button
                                                key={cell.dateStr}
                                                onClick={() => setSelectedDate(cell.dateStr)}
                                                className={cn(
                                                    "relative min-h-[58px] sm:min-h-[68px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl flex flex-col justify-between text-left transition-all border",
                                                    !cell.isCurrentMonth && "opacity-25 pointer-events-none",
                                                    cell.isWeekend && !hasTrades && "bg-black/30 border-white/[0.03]",
                                                    !cell.isWeekend && !hasTrades && "bg-white/[0.02] border-white/5 hover:border-white/20",
                                                    isGreen && "bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 hover:border-emerald-400 shadow-sm",
                                                    isRed && "bg-gradient-to-br from-rose-500/15 to-rose-500/5 border-rose-500/30 hover:border-rose-400 shadow-sm",
                                                    isBreakeven && "bg-white/5 border-white/20",
                                                    hasTrades && !hasRealized && "bg-blue-500/10 border-blue-500/20 text-blue-400",
                                                    isSelected && "ring-2 ring-emerald-400 border-emerald-400 z-10 scale-[1.02]",
                                                    isToday && !isSelected && "border-amber-400/40"
                                                )}
                                            >
                                                {/* Day Number and Today Marker */}
                                                <div className="flex items-center justify-between w-full">
                                                    <span className={cn(
                                                        "text-[10px] sm:text-xs font-black font-mono",
                                                        cell.isWeekend ? "text-slate-500" : "text-slate-300"
                                                    )}>
                                                        {cell.dayNumber}
                                                    </span>
                                                    {isToday && (
                                                        <span className="text-[7px] font-black text-amber-400 bg-amber-400/10 px-1 rounded uppercase tracking-tighter">
                                                            Today
                                                        </span>
                                                    )}
                                                </div>

                                                {/* P&L or Trade Badge */}
                                                <div className="mt-1">
                                                    {hasRealized ? (
                                                        <div>
                                                            <div className={cn(
                                                                "text-[9px] sm:text-[11px] font-black font-mono leading-none truncate",
                                                                isGreen ? "text-emerald-400" : isRed ? "text-rose-400" : "text-slate-300"
                                                            )}>
                                                                {record.netPL >= 0 ? '+' : ''}₹{formatIndianNumber(Math.abs(Math.round(record.netPL)))}
                                                            </div>
                                                            <div className="text-[7px] font-bold text-slate-500 uppercase mt-0.5 tracking-tight">
                                                                {record.totalTrades} trade{record.totalTrades > 1 ? 's' : ''}
                                                            </div>
                                                        </div>
                                                    ) : hasTrades ? (
                                                        <div>
                                                            <div className="text-[8px] sm:text-[9px] font-black text-blue-400 font-mono leading-none">
                                                                {record.buyCount} Buy{record.buyCount > 1 ? 's' : ''}
                                                            </div>
                                                            <div className="text-[7px] font-bold text-slate-500 uppercase mt-0.5">
                                                                Open
                                                            </div>
                                                        </div>
                                                    ) : cell.isWeekend ? (
                                                        <span className="text-[7px] font-bold text-slate-700 uppercase tracking-widest block">
                                                            WKND
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-slate-700 block">
                                                            -
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Selected Day Drilldown Ledger */}
                            <div className="pt-2">
                                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Activity size={16} className="text-emerald-400" />
                                            <h5 className="text-xs sm:text-sm font-black text-white font-outfit uppercase tracking-wider">
                                                Trades on {selectedDate || 'Selected Day'}
                                            </h5>
                                        </div>

                                        {activeDayRecord && activeDayRecord.sellCount > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    Day P&L:
                                                </span>
                                                <span className={cn(
                                                    "text-xs sm:text-sm font-black font-mono",
                                                    activeDayRecord.netPL >= 0 ? "text-emerald-400" : "text-rose-400"
                                                )}>
                                                    {activeDayRecord.netPL >= 0 ? '+' : ''}₹{formatIndianNumber(Math.round(activeDayRecord.netPL))}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Trade Items for this Day */}
                                    {activeDayRecord && activeDayRecord.trades.length > 0 ? (
                                        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                                            {activeDayRecord.trades.map((t) => {
                                                const isSell = t.type === 'SELL';
                                                const hasPL = typeof t.realizedPL === 'number';
                                                const timeStr = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                                return (
                                                    <div 
                                                        key={t.id}
                                                        className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 flex items-center justify-between gap-3 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black uppercase border shrink-0",
                                                                isSell 
                                                                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400" 
                                                                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                            )}>
                                                                {isSell ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-white text-xs uppercase tracking-tight flex items-center gap-2">
                                                                    {formatSymbol(t.symbol)}
                                                                    <span className={cn(
                                                                        "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                                                                        isSell ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
                                                                    )}>
                                                                        {t.type}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                    {t.quantity} shares @ ₹{t.price.toFixed(1)}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="text-right shrink-0">
                                                            <div className="text-xs font-black text-white font-mono">
                                                                ₹{formatIndianNumber(t.totalValue)}
                                                            </div>
                                                            {hasPL ? (
                                                                <div className={cn(
                                                                    "text-[10px] font-black font-mono",
                                                                    (t.realizedPL || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                                                                )}>
                                                                    {(t.realizedPL || 0) >= 0 ? '+' : ''}₹{formatIndianNumber(Math.round(t.realizedPL || 0))}
                                                                </div>
                                                            ) : (
                                                                <div className="text-[9px] text-slate-500 font-mono flex items-center justify-end gap-1">
                                                                    <Clock size={10} /> {timeStr}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-slate-500 space-y-1">
                                            <CalendarIcon size={24} className="mx-auto opacity-30 mb-2" />
                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                No Trades Executed
                                            </div>
                                            <p className="text-[10px] text-slate-600">
                                                There were no buy or sell orders recorded for {selectedDate}.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-4 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Live Ledger Synchronized
                            </span>
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
