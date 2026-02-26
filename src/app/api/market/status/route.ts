import { NextResponse } from "next/server";
import { getMarketStatus } from "@/lib/market";

export async function GET() {
    const status = getMarketStatus();
    return NextResponse.json(status);
}
