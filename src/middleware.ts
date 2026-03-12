import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Explicitly bypass middleware for auth, API, and static routes
    if (
        pathname.startsWith('/api/') ||
        pathname.startsWith('/auth/') ||
        pathname.startsWith('/_next/') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }

    // Check for both the standard and secure NextAuth session cookies
    const secureCookie = request.cookies.get('__Secure-next-auth.session-token');
    const standardCookie = request.cookies.get('next-auth.session-token');

    // If neither cookie exists, redirect to the login page
    if (!secureCookie && !standardCookie) {
        const loginUrl = new URL('/auth/login', request.url);
        // Save the original requested URL to redirect back after login
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Allow the request to proceed if a session cookie exists
    return NextResponse.next();
}

export const config = {
    // Match all routes except auth routes, API endpoints, and static files
    matcher: ['/((?!api/auth|api/register|auth|_next/static|_next/image|favicon.ico).*)'],
};
