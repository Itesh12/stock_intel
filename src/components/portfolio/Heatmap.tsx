"use client";
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { cn, formatIndianNumber } from '@/lib/utils';

interface PortfolioHeatmapProps {
    holdings: any[];
}

export default function PortfolioHeatmap({ holdings }: PortfolioHeatmapProps) {
    const router = useRouter();

    const treemapData = useMemo(() => {
        if (!holdings || holdings.length === 0) return [];
        
        // Sequence requested: Green first (High -> Low) -> Most Red (Most Negative First)
        const validHoldings = holdings
            .filter(h => h.marketValue > 0);

        const greens = validHoldings
            .filter(h => (h.unrealizedPLPercent || 0) >= 0)
            .sort((a, b) => (b.unrealizedPLPercent || 0) - (a.unrealizedPLPercent || 0));
        
        const reds = validHoldings
            .filter(h => (h.unrealizedPLPercent || 0) < 0)
            .sort((a, b) => (a.unrealizedPLPercent || 0) - (b.unrealizedPLPercent || 0));

        const sortedHoldings = [...greens, ...reds];
            
        const totalValue = sortedHoldings.reduce((sum, h) => sum + h.marketValue, 0);
        
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
        
        partition(sortedHoldings, 0, 0, 100, 100);
        return items.map(item => ({
            ...item,
            // Calculate a score for visual importance
            significance: item.marketValue / totalValue
        }));
    }, [holdings]);

    if (!holdings || holdings.length === 0) return null;

    const handleNavigation = (symbol: string) => {
        const cleanSymbol = symbol.split('.')[0];
        router.push(`/stock/${cleanSymbol}`);
    };

    return (
        <div className="w-full h-full relative rounded-none overflow-hidden border border-white/5 bg-[#0a0a0c]/40 backdrop-blur-sm p-1">
            {treemapData.map((item, i) => {
                const pnl = item.unrealizedPLPercent || 0;
                
                // Premium Color System: HSL-based for smoother gradients
                let bgColor = "rgba(30, 41, 59, 0.4)"; // Default slate
                let borderColor = "rgba(255, 255, 255, 0.05)";

                if (pnl > 0.5) {
                    bgColor = "rgba(6, 78, 59, 0.3)";
                    borderColor = "rgba(16, 185, 129, 0.1)";
                }
                if (pnl > 2) {
                    bgColor = "rgba(5, 150, 105, 0.4)";
                    borderColor = "rgba(16, 185, 129, 0.2)";
                }
                if (pnl > 5) {
                    bgColor = "rgba(16, 185, 129, 0.6)";
                    borderColor = "rgba(16, 185, 129, 0.4)";
                }
                
                if (pnl < -0.5) {
                    bgColor = "rgba(159, 18, 57, 0.3)";
                    borderColor = "rgba(244, 63, 94, 0.1)";
                }
                if (pnl < -2) {
                    bgColor = "rgba(225, 29, 72, 0.4)";
                    borderColor = "rgba(244, 63, 94, 0.2)";
                }
                if (pnl < -5) {
                    bgColor = "rgba(244, 63, 94, 0.6)";
                    borderColor = "rgba(244, 63, 94, 0.4)";
                }

                const showFullContent = item.w > 20 && item.h > 20;
                const isTiny = item.w < 8 || item.h < 8;

                return (
                    <motion.div
                        key={item.symbol}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: i * 0.005 }}
                        className="absolute h-full"
                        style={{
                            left: `${item.x}%`,
                            top: `${item.y}%`,
                            width: `${item.w}%`,
                            height: `${item.h}%`,
                            padding: '1px', // Professional tight tiling
                        }}
                        onClick={() => handleNavigation(item.symbol)}
                    >
                        <motion.div 
                            whileHover={{ 
                                scale: 1.05,
                                zIndex: 50,
                                boxShadow: "0 20px 40px rgba(0,0,0,1)" // Darker shadow for sharp edges
                            }}
                            className={cn(
                                "w-full h-full rounded-none border flex flex-col items-center justify-center transition-all duration-300 cursor-pointer overflow-hidden group relative",
                                isTiny ? "opacity-60" : "opacity-100" // Increased base visibility
                            )}
                            style={{
                                backgroundColor: bgColor,
                                borderColor: borderColor,
                            }}
                        >
                            {/* Static Content */}
                            <div className="flex flex-col items-center justify-center w-full px-1">
                                <div className={cn(
                                    "font-black text-white leading-none tracking-tighter truncate w-full text-center transition-all duration-300",
                                    showFullContent ? "text-xs md:text-sm group-hover:text-base" : "text-[8px] md:text-[9px] group-hover:text-[11px]"
                                )}>
                                    {item.symbol.replace(/\.(NS|BO)$/, '')}
                                </div>
                                
                                {(!showFullContent || isTiny) && (
                                    <div className={cn(
                                        "font-bold mt-1 tracking-tighter transition-all duration-300 truncate",
                                        pnl >= 0 ? "text-emerald-400" : "text-rose-400",
                                        "text-[7px] md:text-[8px] group-hover:text-[10px]"
                                    )}>
                                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
                                    </div>
                                )}
                            </div>

                            {/* Expanded Content on Hover/Large */}
                            <div className={cn(
                                "flex flex-col items-center mt-1 transition-all duration-500 w-full overflow-hidden",
                                showFullContent ? "opacity-100 h-auto" : "opacity-0 h-0 group-hover:opacity-100 group-hover:h-auto group-hover:mt-1.5"
                            )}>
                                <div className="text-[9px] font-bold text-white/70 mb-0.5 truncate w-full text-center px-2">
                                    ₹{formatIndianNumber(item.marketValue)}
                                </div>
                                <div className={cn(
                                    "text-[9px] font-black px-1.5 py-0.5 rounded-none border border-white/10 bg-black/40 whitespace-nowrap",
                                    pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                                )}>
                                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                                </div>
                            </div>

                            {/* Bloomberg-style High Contrast Overlay on Hover */}
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/20" />
                        </motion.div>
                    </motion.div>
                );
            })}
        </div>
    );
}
