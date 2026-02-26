import { NextResponse } from "next/server";
import { getInfrastructure } from "@/infrastructure/container";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json();

        if (!name || !email || !password) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const infra = await getInfrastructure();
        const existingUser = await infra.user.findByEmail(email);

        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const userId = uuidv4();
        await infra.user.save({
            id: userId,
            name,
            email,
            password: hashedPassword,
            createdAt: new Date()
        });

        // Initialize Portfolio with 10 Lakhs (1,000,000 INR)
        await infra.portfolio.save({
            id: uuidv4(),
            userId: userId,
            name: "Default Portfolio",
            holdings: [],
            totalValue: 0,
            totalPL: 0,
            totalPLPercent: 0,
            cashBalance: 1000000, // 10 Lakhs
            riskScore: 0,
            sectorExposure: {},
            updatedAt: new Date(),
            createdAt: new Date()
        });

        return NextResponse.json({ message: "User registered successfully" }, { status: 201 });
    } catch (error: any) {
        console.error("Registration error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
