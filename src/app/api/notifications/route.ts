import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;
        
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "20");
        
        const notifications = await infra.notification.findByUserId(userId, limit);
        return NextResponse.json(notifications);
    } catch (err) {
        return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;
        const body = await req.json();

        if (body.all) {
            await infra.notification.markAllAsRead(userId);
        } else if (body.id) {
            await infra.notification.markAsRead(body.id, userId);
        } else {
            return NextResponse.json({ error: "Notification ID or 'all' required" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
    }
}
