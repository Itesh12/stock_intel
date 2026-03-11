'use client';

import React from 'react';
import { AuthProvider } from "./auth-provider";
import { SnackbarProvider } from "./ui/snackbar";
import { LoaderProvider } from "./ui/loader-provider";
import { ThemeProvider } from "./theme/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <AuthProvider>
                <LoaderProvider>
                    <SnackbarProvider>
                        {children}
                    </SnackbarProvider>
                </LoaderProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
