import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export const formatCurrency = (amount: number, currencyOrDigits: string | number = 'INR', minimumFractionDigits?: number) => {
    if (amount === undefined || amount === null) return "--";

    let currency = 'INR';
    let digits = 2;

    if (typeof currencyOrDigits === 'string') {
        currency = currencyOrDigits;
        digits = minimumFractionDigits ?? 2;
    } else {
        digits = currencyOrDigits;
    }

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    }).format(amount);
};

export const formatIndianNumber = (num: number) => {
    if (num === undefined || num === null) return "--";
    if (num === 0) return "0";
    const absNum = Math.abs(num);
    if (absNum >= 1e12) return (num / 1e12).toFixed(2) + " Lakh Cr";
    if (absNum >= 1e10) return (num / 1e10).toFixed(2) + " Thousand Cr";
    if (absNum >= 1e7) return (num / 1e7).toFixed(2) + " Cr";
    if (absNum >= 1e5) return (num / 1e5).toFixed(2) + " L";
    if (absNum >= 1e3) return (num / 1e3).toFixed(2) + " K";
    return num.toLocaleString('en-IN');
};

export const formatPercent = (val: number) => {
    if (val === undefined || val === null) return "--";
    // If val is like 0.05, it should be 5.00%. If it's already like 5.0, it depends on usage.
    // Usually Yahoo returns decimals (0.05 for 5%)
    return (val * 100).toFixed(2) + "%";
};
