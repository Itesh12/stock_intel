"use client";
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn, formatIndianNumber } from '@/lib/utils';

interface PortfolioHeatmapProps {
    holdings: any[];
}

export default function PortfolioHeatmap({ holdings }: PortfolioHeatmapProps) {
    const treemapData = useMemo(() => {
        if (!holdings || holdings.length === 0) return [];
        
        // Filter out zero value holdings and sort by size (market value)
        const validHoldings = holdings
            .filter(h => h.marketValue > 0)
            .sort((a, b) => b.marketValue - a.marketValue);
            
        const totalValue = validHoldings.reduce((sum, h) => sum + h.marketValue, 0);
        
        // Simple recursive bisection treemap algorithm
        const items: any[] = [];
        
        const partition = (data: any[], x: number, y: number, w: number, h: number) => {
            if (data.length === 0) return;
            if (data.length === 1) {
                items.push({
                    ...data[0],
                    x, y, w, h
                });
                return;
            }
            
            // Split data into two groups with roughly equal total value
            const total = data.reduce((sum, d) => sum + d.marketValue, 0);
            let half = 0;
            let splitIndex = 0;
            for (let i = 0; i < data.length; i++) {
                half += data[i].marketValue;
                if (half >= total / 2 || i === data.length - 2) {
                    splitIndex = i + 1;
                    break;
                }
            }
            
            const left = data.slice(0, splitIndex);
            const right = data.slice(splitIndex);
            const leftValue = left.reduce((sum, d) => sum + d.marketValue, 0);
            const ratio = leftValue / total;
            
            if (w > h) {
                // Split vertically
                partition(left, x, y, w * ratio, h);
                partition(right, x + w * ratio, y, w * (1 - ratio), h);
            } else {
                // Split horizontally
                partition(left, x, y, w, h * ratio);
                partition(right, x, y + h * ratio, w, h * (1 - ratio));
            }
        };
        
        partition(validHoldings, 0, 0, 100, 100);
        return items;
    }, [holdings]);

    if (!holdings || holdings.length === 0) return null;

    return (
        <div className="w-full h-full min-h-[300px] relative rounded-3xl overflow-hidden border border-white/5 bg-black/20">
            {treemapData.map((item, i) => {
                const pnl = item.unrealizedPLPercent || 0;
                // Color mapping: -5% (rose-600) to 0% (slate-800) to +5% (emerald-600)
                let bgColor = "bg-slate-800";
                if (pnl > 0.5) bgColor = "bg-emerald-900/40";
                if (pnl > 2) bgColor = "bg-emerald-700/60";
                if (pnl > 5) bgColor = "bg-emerald-500/80";
                if (pnl < -0.5) bgColor = "bg-rose-900/40";
                if (pnl < -2) bgColor = "bg-rose-700/60";
                if (pnl < -5) bgColor = "bg-rose-500/80";

                const isSmall = item.w < 15 || item.h < 15;

                return (
                    <motion.div
                        key={item.symbol}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                        style={{
                            left: `${item.x}%`,
                            top: `${item.y}%`,
                            width: `${item.w}%`,
                            height: `${item.h}%`,
                            position: 'absolute',
                            padding: '1px'
                        }}
                    >
                        <div className={cn(
                            "w-full h-full rounded-lg border border-white/5 flex flex-col items-center justify-center transition-all hover:brightness-125 cursor-pointer overflow-hidden p-2 group",
                            bgColor
                        )}>
                            <div className={cn(
                                "font-black text-white leading-none tracking-tighter group-hover:scale-110 transition-transform",
                                isSmall ? "text-[8px]" : "text-sm"
                            )}>
                                {item.symbol.replace(/\.(NS|BO)$/, '')}
                            </div>
                            {!isSmall && (
                                <>
                                    <div className="text-[10px] font-bold text-white/60 mt-1">
                                        ₹{formatIndianNumber(item.marketValue)}
                                    </div>
                                    <div className={cn(
                                        "text-[9px] font-black mt-0.5 px-1.5 py-0.5 rounded-md",
                                        pnl >= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
                                    )}>
                                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}
