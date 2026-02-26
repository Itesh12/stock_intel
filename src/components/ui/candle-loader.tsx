'use client';

import React from 'react';

export const CandleLoader = () => {
    return (
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
            <div className="flex flex-col items-center -translate-y-1">
                <div className="candle-wick text-emerald-500/40"></div>
                <div className="candle-green" style={{ animationDelay: '0.2s' }}></div>
                <div className="candle-wick text-emerald-500/40"></div>
            </div>
        </div>
    );
};
