import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        const entries = await infra.journal.findByUserId(userId);
        return NextResponse.json(entries);
    } catch (err) {
        return NextResponse.json({ error: "Failed to fetch journal" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;
        const body = await req.json();

        const entry = {
            id: uuidv4(),
            userId,
            symbol: body.symbol,
            content: body.content,
            tags: body.tags || [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await infra.journal.save(entry);
        return NextResponse.json(entry);
    } catch (err) {
        return NextResponse.json({ error: "Failed to save entry" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        const infra = await getInfrastructure();
        const userId = (session.user as any).id;

        await infra.journal.delete(id, userId);
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
    }
}
