"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Theme = "default" | "crimson" | "ocean" | "amber" | "rose";

export interface ThemeConfig {
    id: Theme;
    label: string;
    desc: string;
    preview: string;
    glow: string;
    vars: Record<string, string>;
}

export const THEMES: ThemeConfig[] = [
    {
        id: "default",
        label: "Obsidian",
        desc: "Pure dark. Classic.",
        preview: "#050505",
        glow: "#3b82f6",
        vars: {
            "--theme-bg":           "#050505",
            "--theme-bg-98":        "rgba(5,5,5,0.98)",
            "--theme-sidebar":      "#08080a",
            "--theme-card":         "#0A0A0B",
            "--theme-card-80":      "rgba(10,10,11,0.80)",
            "--theme-dropdown":     "#0c0c0e",
            "--theme-surface":      "#111111",
            "--theme-accent":       "#3b82f6",
            "--theme-accent-subtle":"rgba(59,130,246,0.1)",
            "--theme-border":       "rgba(255,255,255,0.05)",
            "--theme-border-md":    "rgba(255,255,255,0.10)",
            "--theme-faint":        "rgba(255,255,255,0.03)",
            "--theme-faint-2":      "rgba(255,255,255,0.02)",
            "--theme-faint-5":      "rgba(255,255,255,0.05)",
        }
    },
    {
        id: "crimson",
        label: "Crimson",
        desc: "Deep red noir energy.",
        preview: "#0a0005",
        glow: "#ef4444",
        vars: {
            "--theme-bg":           "#0a0005",
            "--theme-bg-98":        "rgba(10,0,5,0.98)",
            "--theme-sidebar":      "#0d0008",
            "--theme-card":         "#12000a",
            "--theme-card-80":      "rgba(18,0,10,0.80)",
            "--theme-dropdown":     "#0f0007",
            "--theme-surface":      "#0f0007",
            "--theme-accent":       "#ef4444",
            "--theme-accent-subtle":"rgba(239,68,68,0.1)",
            "--theme-border":       "rgba(239,68,68,0.08)",
            "--theme-border-md":    "rgba(239,68,68,0.14)",
            "--theme-faint":        "rgba(239,68,68,0.03)",
            "--theme-faint-2":      "rgba(239,68,68,0.02)",
            "--theme-faint-5":      "rgba(239,68,68,0.05)",
        }
    },
    {
        id: "ocean",
        label: "Ocean",
        desc: "Deep sea intelligence.",
        preview: "#00101a",
        glow: "#06b6d4",
        vars: {
            "--theme-bg":           "#00101a",
            "--theme-bg-98":        "rgba(0,16,26,0.98)",
            "--theme-sidebar":      "#00141f",
            "--theme-card":         "#001824",
            "--theme-card-80":      "rgba(0,24,36,0.80)",
            "--theme-dropdown":     "#000f1a",
            "--theme-surface":      "#001020",
            "--theme-accent":       "#06b6d4",
            "--theme-accent-subtle":"rgba(6,182,212,0.1)",
            "--theme-border":       "rgba(6,182,212,0.08)",
            "--theme-border-md":    "rgba(6,182,212,0.14)",
            "--theme-faint":        "rgba(6,182,212,0.03)",
            "--theme-faint-2":      "rgba(6,182,212,0.02)",
            "--theme-faint-5":      "rgba(6,182,212,0.05)",
        }
    },
    {
        id: "amber",
        label: "Amber",
        desc: "Warm gold precision.",
        preview: "#0a0800",
        glow: "#f59e0b",
        vars: {
            "--theme-bg":           "#080600",
            "--theme-bg-98":        "rgba(8,6,0,0.98)",
            "--theme-sidebar":      "#0a0800",
            "--theme-card":         "#0e0b00",
            "--theme-card-80":      "rgba(14,11,0,0.80)",
            "--theme-dropdown":     "#0b0900",
            "--theme-surface":      "#0c0a00",
            "--theme-accent":       "#f59e0b",
            "--theme-accent-subtle":"rgba(245,158,11,0.1)",
            "--theme-border":       "rgba(245,158,11,0.08)",
            "--theme-border-md":    "rgba(245,158,11,0.14)",
            "--theme-faint":        "rgba(245,158,11,0.03)",
            "--theme-faint-2":      "rgba(245,158,11,0.02)",
            "--theme-faint-5":      "rgba(245,158,11,0.05)",
        }
    },
    {
        id: "rose",
        label: "Rose",
        desc: "Luxury pink noir.",
        preview: "#0d0008",
        glow: "#f43f5e",
        vars: {
            "--theme-bg":           "#0d0008",
            "--theme-bg-98":        "rgba(13,0,8,0.98)",
            "--theme-sidebar":      "#10000b",
            "--theme-card":         "#150010",
            "--theme-card-80":      "rgba(21,0,16,0.80)",
            "--theme-dropdown":     "#110009",
            "--theme-surface":      "#120009",
            "--theme-accent":       "#f43f5e",
            "--theme-accent-subtle":"rgba(244,63,94,0.1)",
            "--theme-border":       "rgba(244,63,94,0.08)",
            "--theme-border-md":    "rgba(244,63,94,0.14)",
            "--theme-faint":        "rgba(244,63,94,0.03)",
            "--theme-faint-2":      "rgba(244,63,94,0.02)",
            "--theme-faint-5":      "rgba(244,63,94,0.05)",
        }
    }
];

interface ThemeContextType {
    theme: Theme;
    setTheme: (t: Theme) => void;
    config: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "default",
    setTheme: () => {},
    config: THEMES[0]
});

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>("default");

    useEffect(() => {
        const saved = localStorage.getItem("si-theme") as Theme | null;
        const validIds = THEMES.map(t => t.id);
        if (saved && validIds.includes(saved)) setTheme(saved);
    }, []);

    useEffect(() => {
        const config = THEMES.find(t => t.id === theme) || THEMES[0];
        const root = document.documentElement;

        // Inject all CSS variables directly onto :root so every element responds
        Object.entries(config.vars).forEach(([k, v]) => {
            root.style.setProperty(k, v);
        });

        // Also set data-theme for any CSS selector rules
        root.setAttribute("data-theme", theme);
        localStorage.setItem("si-theme", theme);
    }, [theme]);

    const config = THEMES.find(t => t.id === theme) || THEMES[0];

    return (
        <ThemeContext.Provider value={{ theme, setTheme, config }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
