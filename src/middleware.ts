import { withAuth } from "next-auth/middleware";

export default withAuth({
    pages: {
        signIn: "/auth/login",
    },
    secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_development_only",
});

export const config = {
    matcher: [
        "/((?!api/auth|api/register|auth|_next/static|_next/image|favicon.ico).*)",
    ],
};
