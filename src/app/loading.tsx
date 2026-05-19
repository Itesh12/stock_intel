import React from 'react';
import { GlobalLoader } from '@/components/ui/global-loader';

export default function RootLoading() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-black">
            <GlobalLoader 
                fullScreen={true}
                title="Loading StockIntel..." 
                steps={[
                    { label: "Initializing System", threshold: 30 },
                    { label: "Loading Interface", threshold: 80 }
                ]}
            />
        </div>
    );
}
