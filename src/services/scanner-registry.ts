import { Infrastructure } from "../infrastructure/container";
import {
    BaseScanner,
    CanslimScanner,
    IntermarketScanner,
    BuffetScanner,
    IntradayScanner,
    SwingScanner,
} from "./quant-scanner";

// ─────────────────────────────────────────────────────────────────────────────
// Scanner Registry
//
// Maps strategy slugs to their scanner implementations.
// To add a new strategy: add its scanner class and register its slug here.
// No other file needs to change.
// ─────────────────────────────────────────────────────────────────────────────

type ScannerConstructor = new (infra: Infrastructure) => BaseScanner;

const SCANNER_REGISTRY: Record<string, ScannerConstructor> = {
    'canslim': CanslimScanner,
    'warren-buffet': BuffetScanner,
    'intermarket-analysis-india': IntermarketScanner,
    'intraday-strategy': IntradayScanner,
    'swing-strategy': SwingScanner,
};

/**
 * Returns the appropriate scanner for a given strategy slug.
 * Falls back to IntermarketScanner if the slug is not registered.
 */
export function getScannerForSlug(slug: string, infra: Infrastructure): BaseScanner {
    const ScannerClass = SCANNER_REGISTRY[slug] ?? IntermarketScanner;
    return new ScannerClass(infra);
}

/** Returns all registered strategy slugs (useful for batch scans). */
export function getRegisteredSlugs(): string[] {
    return Object.keys(SCANNER_REGISTRY);
}
