import React from 'react';
import { GlobalLoader } from '@/components/ui/global-loader';

export default function DashboardLoading() {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505]/80 backdrop-blur-sm">
            <GlobalLoader 
                title="Loading Intelligence..." 
                steps={[
                    { label: "Establishing Secure Connection", threshold: 20 },
                    { label: "Retrieving Market Data", threshold: 60 },
                    { label: "Processing Algorithms", threshold: 90 }
                ]}
            />
        </div>
    );
}
