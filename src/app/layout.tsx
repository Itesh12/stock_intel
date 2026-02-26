import React from "react";
import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
    title: "StockIntel | AI-Driven Financial Intelligence",
    description: "Advanced stock analytics and portfolio intelligence platform.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.variable} ${outfit.variable} font-sans bg-[#050505] text-slate-200 antialiased`}>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
