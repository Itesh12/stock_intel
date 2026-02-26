"use client";

import React from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    ComposedChart,
    Scatter,
    Cell
} from 'recharts';
import { format } from 'date-fns';
import { Trade } from '@/domain/trade';

interface InteractiveChartProps {
    data: any[];
    isPositive: boolean;
    trades?: Trade[];
}

const CustomTooltip = ({ active, payload, label, trades }: any) => {
    if (active && payload && payload.length) {
        const dateStr = format(new Date(label), 'MMM dd, yyyy');
        const price = payload[0].value;
        const tradePoint = payload.find((p: any) => p.name === 'Trade');

        return (
            <div className="bg-[#0a0a0c]/95 border border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    {dateStr}
                </p>
                <div className="space-y-2">
                    <p className="text-lg font-black text-white font-outfit">
                        ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    {tradePoint && (
                        <div className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight ${tradePoint.payload.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                            {tradePoint.payload.type} EXECUTION: {tradePoint.payload.quantity} UNITS @ ₹{tradePoint.payload.price}
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

export default function InteractiveChart({ data, isPositive, trades }: InteractiveChartProps) {
    if (!data || data.length === 0) return null;

    // Map trades to the nearest data points for visualization
    const tradePoints = (trades || []).map(trade => {
        const tradeDate = new Date(trade.timestamp);
        const dateLabel = tradeDate.toISOString().split('T')[0];

        // Find closest point in history data
        // For simplicity, we just use the trade's date and price
        return {
            date: dateLabel,
            price: trade.price,
            type: trade.type,
            quantity: trade.quantity,
            id: trade.id
        };
    });

    return (
        <div className="w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(255,255,255,0.03)"
                    />
                    <XAxis
                        dataKey="date"
                        hide={true}
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        hide={true}
                    />
                    <Tooltip
                        content={<CustomTooltip trades={trades} />}
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                    />
                    <Area
                        type="monotone"
                        dataKey="close"
                        stroke={isPositive ? "#10b981" : "#f43f5e"}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                        animationDuration={1500}
                        activeDot={{
                            r: 6,
                            fill: isPositive ? "#10b981" : "#f43f5e",
                            stroke: '#fff',
                            strokeWidth: 2,
                            className: "shadow-lg"
                        }}
                    />
                    <Scatter
                        name="Trade"
                        data={tradePoints}
                        fill="#8884d8"
                    >
                        {tradePoints.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.type === 'BUY' ? '#10b981' : '#f43f5e'}
                                stroke="#fff"
                                strokeWidth={2}
                                r={5}
                            />
                        ))}
                    </Scatter>
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
