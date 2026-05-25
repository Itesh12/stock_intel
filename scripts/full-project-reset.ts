/**
 * full-project-reset.ts
 *
 * Wipes ALL project data from MongoDB and returns the database to a clean
 * fresh-install state. Indexes are preserved. The database itself is NOT dropped.
 *
 * Usage:
 *   Dry-run (safe, default):
 *     npx ts-node -O "{\"module\":\"commonjs\"}" scripts/full-project-reset.ts
 *
 *   Live execution (DESTRUCTIVE - deletes everything):
 *     npx ts-node -O "{\"module\":\"commonjs\"}" scripts/full-project-reset.ts --confirm-reset
 */

import "dotenv/config";
import { MongoClient, Db } from "mongodb";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const DRY_RUN = !process.argv.includes("--confirm-reset");

/**
 * Collections that must be wiped on reset.
 * These are ordered: dependency-free collections first.
 */
const PROJECT_COLLECTIONS_TO_WIPE = [
    // Auth / Users
    "users",
    "accounts",
    "sessions",
    "verification_tokens",

    // Portfolio
    "portfolios",
    "portfolio_snapshots",
    "holdings",

    // Trading engine
    "trades",
    "limit_orders",
    "idempotency_keys",

    // Strategy Assistants (new)
    "strategy_assistants",
    "auto_trade_logs",

    // Legacy bot system
    "auto_trade_bots",

    // Signals / Recommendations
    "strategy_recommendations",

    // Notifications & Alerts
    "notifications",
    "alerts",

    // Watchlists & Journal
    "watchlists",
    "journals",

    // Analytics
    "analytics",
    "leaderboard",
    "news_cache",
    "cache",
    "metrics",
    "logs",
    "scanners",
    "temp",
    "test",
];

/**
 * Collections to KEEP. These hold application configuration, not user data.
 * Also excludes MongoDB internal system collections.
 */
const PRESERVE_PREFIXES = [
    "system.",   // MongoDB internals
];

const PRESERVE_EXACT = [
    "strategies",  // Static strategy definitions — seeded from src/data/strategies.ts
    "stocks",      // Static stock catalog
];

/**
 * Collections to ensure exist after wipe (for clean startup).
 * These are the collections the application reads on first boot.
 */
const REQUIRED_COLLECTIONS = [
    "users",
    "portfolios",
    "trades",
    "limit_orders",
    "strategy_assistants",
    "auto_trade_logs",
    "notifications",
    "watchlists",
    "strategy_recommendations",
    "idempotency_keys",
    "journals",
    "alerts",
    "portfolio_snapshots",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function maskUri(uri: string): string {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
}

function shouldWipe(name: string, knownProjectCollections: Set<string>): boolean {
    // Always preserve system and config collections
    if (PRESERVE_EXACT.includes(name)) return false;
    if (PRESERVE_PREFIXES.some((p) => name.startsWith(p))) return false;

    // Wipe if it's in the explicit wipe list OR if it's an unknown user-created collection
    // (i.e., not in PRESERVE_EXACT — we wipe unknown collections too)
    return true;
}

async function printCollectionCounts(db: Db, label: string): Promise<Record<string, number>> {
    const collections = await db.listCollections().toArray();
    const counts: Record<string, number> = {};

    console.log(`\n=== ${label} ===`);
    console.log(`${"Collection".padEnd(36)} Count`);
    console.log("─".repeat(48));

    for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        counts[col.name] = count;
        console.log(`  ${col.name.padEnd(34)} ${count}`);
    }
    console.log("");
    return counts;
}

async function verifyMongoConnection(db: Db): Promise<boolean> {
    try {
        await db.command({ ping: 1 });
        return true;
    } catch {
        return false;
    }
}

async function verifyApplicationStartup(db: Db): Promise<{ pass: boolean; reason?: string }> {
    // Check required collections all exist
    const existing = await db.listCollections().toArray();
    const existingNames = new Set(existing.map((c) => c.name));

    const missing = REQUIRED_COLLECTIONS.filter((r) => !existingNames.has(r));
    if (missing.length > 0) {
        return { pass: false, reason: `Missing required collections: ${missing.join(", ")}` };
    }
    return { pass: true };
}

async function verifyStrategiesSeeded(db: Db): Promise<{ pass: boolean; reason?: string }> {
    const count = await db.collection("strategies").countDocuments();
    if (count === 0) {
        return {
            pass: false,
            reason: "strategies collection is empty. Run: npx ts-node scripts/seed-strategies.ts",
        };
    }
    return { pass: true };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
    const mongoUri = process.env.MONGO_URI;
    const mongoDb = process.env.MONGO_DB || "market";

    if (!mongoUri) {
        console.error("❌ MONGO_URI is missing from environment variables.");
        process.exit(1);
    }

    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║          STOCKINTEL — FULL PROJECT RESET UTILITY        ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log(`  Database  : ${mongoDb}`);
    console.log(`  URI       : ${maskUri(mongoUri)}`);
    console.log(`  Mode      : ${DRY_RUN ? "🟡 DRY RUN (no changes will be made)" : "🔴 LIVE EXECUTION — DATA WILL BE DELETED"}`);
    console.log("");

    if (DRY_RUN) {
        console.log("  ⚠️  To perform actual deletion, rerun with: --confirm-reset");
        console.log("  ⚠️  This will permanently delete ALL user and application data.");
        console.log("");
    } else {
        console.log("  ⚠️  WARNING: This will permanently delete ALL data in the project.");
        console.log("  ⚠️  Proceeding in 3 seconds... (Ctrl+C to abort)");
        await new Promise((r) => setTimeout(r, 3000));
    }

    // Connect
    const client = await MongoClient.connect(mongoUri);
    const db = client.db(mongoDb);

    // ── BEFORE snapshot ──────────────────────────────────────────────────────
    const beforeCounts = await printCollectionCounts(db, "BEFORE RESET");

    // Identify collections to wipe (explicit list + any unknown project collections)
    const allCollections = await db.listCollections().toArray();
    const allNames = allCollections.map((c) => c.name);

    const toWipe = allNames.filter((name) => shouldWipe(name, new Set(PROJECT_COLLECTIONS_TO_WIPE)));
    const toSkip = allNames.filter((name) => !shouldWipe(name, new Set(PROJECT_COLLECTIONS_TO_WIPE)));

    console.log("=== WIPE PLAN ===");
    console.log(`  Collections to wipe (${toWipe.length}):`);
    toWipe.forEach((n) => console.log(`    🗑  ${n} (${beforeCounts[n] ?? 0} documents)`));
    console.log(`  Collections to preserve (${toSkip.length}):`);
    toSkip.forEach((n) => console.log(`    ✅  ${n}`));
    console.log("");

    // ── EXECUTE ──────────────────────────────────────────────────────────────
    const deletedSummary: { collection: string; deleted: number }[] = [];
    let totalDeleted = 0;

    for (const colName of toWipe) {
        const count = beforeCounts[colName] ?? 0;

        if (DRY_RUN) {
            console.log(`  [DRY RUN] Would delete ${count} documents from: ${colName}`);
            deletedSummary.push({ collection: colName, deleted: count });
            totalDeleted += count;
        } else {
            try {
                const result = await db.collection(colName).deleteMany({});
                const deleted = result.deletedCount ?? 0;
                console.log(`  🗑  Deleted ${deleted} documents from: ${colName}`);
                deletedSummary.push({ collection: colName, deleted });
                totalDeleted += deleted;
            } catch (err: any) {
                console.error(`  ❌ Failed to delete from ${colName}: ${err.message}`);
                await client.close();
                process.exit(1);
            }
        }
    }

    // ── RECREATE REQUIRED COLLECTIONS ────────────────────────────────────────
    if (!DRY_RUN) {
        console.log("\n=== RECREATING REQUIRED EMPTY COLLECTIONS ===");
        const afterCollections = await db.listCollections().toArray();
        const afterNames = new Set(afterCollections.map((c) => c.name));

        for (const required of REQUIRED_COLLECTIONS) {
            if (!afterNames.has(required)) {
                await db.createCollection(required);
                console.log(`  ✅ Created empty collection: ${required}`);
            } else {
                console.log(`  ✅ Exists: ${required}`);
            }
        }
    }

    // ── AFTER snapshot ───────────────────────────────────────────────────────
    if (!DRY_RUN) {
        await printCollectionCounts(db, "AFTER RESET");
    }

    // ── VERIFICATION ─────────────────────────────────────────────────────────
    console.log("=== VERIFICATION ===");

    const checks: { name: string; pass: boolean; reason?: string }[] = [];

    // 1. Mongo connection
    const connOk = await verifyMongoConnection(db);
    checks.push({ name: "Mongo Connection", pass: connOk, reason: connOk ? undefined : "ping failed" });

    // 2. Application startup readiness (required collections present)
    if (!DRY_RUN) {
        const startupResult = await verifyApplicationStartup(db);
        checks.push({ name: "Application Startup (collections)", ...startupResult });

        // 3. Strategies seeded
        const strategiesResult = await verifyStrategiesSeeded(db);
        checks.push({ name: "Strategies Seeded", ...strategiesResult });

        // 4. No user data remaining
        const usersCount = await db.collection("users").countDocuments();
        checks.push({
            name: "Users Wiped",
            pass: usersCount === 0,
            reason: usersCount > 0 ? `${usersCount} users still present` : undefined,
        });

        const portfoliosCount = await db.collection("portfolios").countDocuments();
        checks.push({
            name: "Portfolios Wiped",
            pass: portfoliosCount === 0,
            reason: portfoliosCount > 0 ? `${portfoliosCount} portfolios still present` : undefined,
        });

        const assistantsCount = await db.collection("strategy_assistants").countDocuments();
        checks.push({
            name: "Strategy Assistants Wiped",
            pass: assistantsCount === 0,
            reason: assistantsCount > 0 ? `${assistantsCount} assistants still present` : undefined,
        });
    } else {
        checks.push({ name: "Application Startup (collections)", pass: true, reason: "Skipped in dry-run mode" });
        checks.push({ name: "Strategies Seeded", pass: true, reason: "Skipped in dry-run mode" });
        checks.push({ name: "Data Wipe Verification", pass: true, reason: "Skipped in dry-run mode" });
    }

    console.log("");
    let allPassed = true;
    for (const check of checks) {
        const icon = check.pass ? "✅" : "❌";
        const detail = check.reason ? `  → ${check.reason}` : "";
        console.log(`  ${icon} ${check.name.padEnd(40)} ${check.pass ? "PASS" : "FAIL"}${detail}`);
        if (!check.pass) allPassed = false;
    }

    // ── SUMMARY ──────────────────────────────────────────────────────────────
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║                    RESET SUMMARY                        ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log(`  Mode              : ${DRY_RUN ? "DRY RUN" : "LIVE EXECUTION"}`);
    console.log(`  Collections wiped : ${toWipe.length}`);
    console.log(`  Documents deleted : ${totalDeleted}${DRY_RUN ? " (estimated)" : ""}`);
    console.log(`  Collections kept  : ${toSkip.length} (${toSkip.join(", ")})`);
    console.log("");

    if (deletedSummary.length > 0) {
        console.log("  Per-collection breakdown:");
        deletedSummary.forEach(({ collection, deleted }) => {
            if (deleted > 0) {
                console.log(`    - ${collection.padEnd(34)} ${deleted}`);
            }
        });
    }

    console.log("");
    if (!allPassed) {
        console.error("  ❌ VERIFICATION FAILED — See details above.");
        console.error("  ❌ DO NOT deploy until issues are resolved.");
        await client.close();
        process.exit(1);
    }

    console.log(`  ${DRY_RUN ? "🟡 Dry-run complete." : "✅ Reset complete. Database is clean."}`);

    if (!DRY_RUN && checks.find(c => c.name === "Strategies Seeded" && !c.pass)) {
        console.log("");
        console.log("  ⚠️  IMPORTANT: Strategies are not seeded.");
        console.log("  Run this now:");
        console.log("    npx ts-node -O \"{\\\"module\\\":\\\"commonjs\\\"}\" scripts/seed-strategies.ts");
    }

    if (DRY_RUN) {
        console.log("");
        console.log("  To execute the actual reset, run:");
        console.log(`    npx ts-node -O "{\\\"module\\\":\\\"commonjs\\\"}" scripts/full-project-reset.ts --confirm-reset`);
    }

    console.log("");
    await client.close();
}

main().catch((err) => {
    console.error("\n❌ FATAL ERROR:", err.message);
    process.exit(1);
});
