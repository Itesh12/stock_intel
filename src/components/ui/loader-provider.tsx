import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface LoaderContextType {
    showLoader: (message?: string) => void;
    hideLoader: () => void;
}

const LoaderContext = createContext<LoaderContextType | undefined>(undefined);

export const useLoader = () => {
    const context = useContext(LoaderContext);
    if (!context) {
        throw new Error('useLoader must be used within a LoaderProvider');
    }
    return context;
};

export const LoaderProvider = ({ children }: { children: ReactNode }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string>("");
    const pathname = usePathname();

    const showLoader = (msg: string = "Processing Intelligence...") => {
        setMessage(msg);
        setIsLoading(true);
    };

    const hideLoader = () => setIsLoading(false);

    // Failsafe: Hide loader when route changes
    useEffect(() => {
        hideLoader();
    }, [pathname]);

    return (
        <LoaderContext.Provider value={{ showLoader, hideLoader }}>
            {children}
            {isLoading && (
                <div className="global-loader-overlay">
                    <div className="flex flex-col items-center gap-12 animate-in zoom-in-95 duration-500">
                        {/* Redesigned Premium Loader */}
                        <div className="flex items-end justify-center gap-3 h-24">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex flex-col items-center" style={{ animationDelay: `${i * 0.1}s` }}>
                                    <div className={`w-[1px] h-12 ${i % 2 === 0 ? 'text-rose-500' : 'text-emerald-500'} opacity-20`}></div>
                                    <div className={i % 2 === 0 ? 'candle-red' : 'candle-green'} style={{ animationDelay: `${i * 0.15}s` }}></div>
                                    <div className={`w-[1px] h-12 ${i % 2 === 0 ? 'text-rose-500' : 'text-emerald-500'} opacity-20`}></div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col items-center gap-3">
                            <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
                            <span className="text-sm font-bold tracking-[0.2em] text-blue-400 uppercase font-outfit animate-pulse">
                                {message}
                            </span>
                            <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
                        </div>
                    </div>
                </div>
            )}
        </LoaderContext.Provider>
    );
};
