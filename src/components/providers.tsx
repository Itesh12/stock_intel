'use client';

import React from 'react';
import { AuthProvider } from "./auth-provider";
import { SnackbarProvider } from "./ui/snackbar";
import { LoaderProvider } from "./ui/loader-provider";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <LoaderProvider>
                <SnackbarProvider>
                    {children}
                </SnackbarProvider>
            </LoaderProvider>
        </AuthProvider>
    );
}
