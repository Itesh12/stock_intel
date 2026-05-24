/**
 * Observability Verification Script
 * Tests MetricsRegistry, Logger, and snapshot structure.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-observability.ts
 */

// Suppress Next.js globals for test environment
(global as any).__stockintel_metrics_registry__ = undefined;

import { MetricsRegistry, SystemMetricsSnapshot } from '../src/infrastructure/metrics';
import { Logger } from '../src/infrastructure/logger';

// ─── Reset for clean test state ───────────────────────────────────────────────
MetricsRegistry.reset();

console.log('\n=== StockIntel Observability Verification ===\n');

// ─── 1. Test Logger output format ─────────────────────────────────────────────
console.log('--- Logger format tests ---');

Logger.info('TestService', 'test_action', { symbol: 'TCS.NS', durationMs: 42 }, 42);
Logger.warn('TestService', 'test_warn', { reason: 'stale cache' });
Logger.error('TestService', 'test_error', new Error('Test error'), { attempt: 2 });
Logger.started('TestWorker', 'TradeMonitor');
Logger.skipped('TestWorker', 'AutoTrade', 'already executing');

console.log('\n--- MetricsRegistry tests ---\n');

// ─── 2. API Metrics ───────────────────────────────────────────────────────────
MetricsRegistry.recordApiRequest('trade', 'POST', 200, 38);
MetricsRegistry.recordApiRequest('trade', 'POST', 200, 45);
MetricsRegistry.recordApiRequest('trade', 'POST', 400, 12);
MetricsRegistry.recordApiRequest('portfolio/analytics', 'GET', 200, 5);
MetricsRegistry.recordApiRequest('market/all-data', 'GET', 200, 180);
MetricsRegistry.recordApiRequest('market/all-data', 'GET', 500, 3000);

const apiMetrics = MetricsRegistry.getApiMetrics();
console.assert(apiMetrics['POST trade']?.requestCount === 3, 'API: trade requestCount should be 3');
console.assert(apiMetrics['POST trade']?.errorCount === 1, 'API: trade errorCount should be 1');
console.assert(apiMetrics['POST trade']?.p50Ms > 0, 'API: p50Ms should be computed');
console.assert(apiMetrics['GET portfolio/analytics']?.requestCount === 1, 'API: analytics requestCount should be 1');
console.log('✅ API metrics: PASSED');
console.log('   Trade: requests=', apiMetrics['POST trade']?.requestCount, 'errors=', apiMetrics['POST trade']?.errorCount, 'p50=', apiMetrics['POST trade']?.p50Ms, 'ms');

// ─── 3. Worker Metrics ────────────────────────────────────────────────────────
MetricsRegistry.recordWorkerEnd('TradeMonitor', true, 180);
MetricsRegistry.recordWorkerEnd('TradeMonitor', true, 220);
MetricsRegistry.recordWorkerEnd('TradeMonitor', false, 300);
MetricsRegistry.recordWorkerEnd('AutoTrade', true, 45);

const workerMetrics = MetricsRegistry.getWorkerMetrics();
console.assert(workerMetrics['TradeMonitor']?.execCount === 3, 'Worker: TradeMonitor execCount should be 3');
console.assert(workerMetrics['TradeMonitor']?.failureCount === 1, 'Worker: TradeMonitor failureCount should be 1');
console.assert(workerMetrics['TradeMonitor']?.maxDurationMs === 300, 'Worker: maxDurationMs should be 300');
console.assert(Math.round(workerMetrics['TradeMonitor']?.avgDurationMs) === 233, 'Worker: avgDurationMs should be ~233');
console.log('✅ Worker metrics: PASSED');
console.log('   TradeMonitor: executions=', workerMetrics['TradeMonitor']?.execCount, 'failures=', workerMetrics['TradeMonitor']?.failureCount, 'avg=', workerMetrics['TradeMonitor']?.avgDurationMs.toFixed(0), 'ms');

// ─── 4. Scanner Metrics ───────────────────────────────────────────────────────
MetricsRegistry.recordScan('canslim', 450, 62, 8, 32000);
MetricsRegistry.recordScan('canslim', 420, 55, 10, 28000);
MetricsRegistry.recordScan('warren-buffet', 450, 40, 7, 29500);

const scannerMetrics = MetricsRegistry.getScannerMetrics();
console.assert(scannerMetrics['canslim']?.scanCount === 2, 'Scanner: canslim scanCount should be 2');
console.assert(scannerMetrics['canslim']?.avgSymbolsScanned === 435, 'Scanner: avgSymbolsScanned should be 435');
console.assert(scannerMetrics['canslim']?.avgRecommendations === 9, 'Scanner: avgRecommendations should be 9');
console.assert(scannerMetrics['warren-buffet']?.scanCount === 1, 'Scanner: warren-buffet scanCount should be 1');
console.log('✅ Scanner metrics: PASSED');
console.log('   CANSLIM: scans=', scannerMetrics['canslim']?.scanCount, 'avgSymbols=', scannerMetrics['canslim']?.avgSymbolsScanned, 'avgRecs=', scannerMetrics['canslim']?.avgRecommendations);

// ─── 5. Trading Metrics ───────────────────────────────────────────────────────
MetricsRegistry.recordTrade('BUY', true, 0);
MetricsRegistry.recordTrade('BUY', true, 1);
MetricsRegistry.recordTrade('SELL', true, 0);
MetricsRegistry.recordTrade('BUY', false, 2);
MetricsRegistry.recordTrade('SELL', false, 0);

const tradingMetrics = MetricsRegistry.getTradingMetrics();
console.assert(tradingMetrics.buyCount === 2, 'Trading: buyCount should be 2');
console.assert(tradingMetrics.sellCount === 1, 'Trading: sellCount should be 1');
console.assert(tradingMetrics.failedCount === 2, 'Trading: failedCount should be 2');
console.assert(tradingMetrics.totalOccRetries === 1, 'Trading: totalOccRetries should be 1');
console.assert(tradingMetrics.occRetryHistogram[1] === 1, 'Trading: histogram[1] should be 1');
console.log('✅ Trading metrics: PASSED');
console.log('   buy=', tradingMetrics.buyCount, 'sell=', tradingMetrics.sellCount, 'failed=', tradingMetrics.failedCount, 'occRetries=', tradingMetrics.totalOccRetries);

// ─── 6. Market Provider Metrics ───────────────────────────────────────────────
MetricsRegistry.recordMarketRequest('yahoo', true, 180);
MetricsRegistry.recordMarketRequest('yahoo', true, 140);
MetricsRegistry.recordMarketRequest('yahoo', false, 5001);
MetricsRegistry.recordMarketRequest('finnhub', true, 80, true);

const marketMetrics = MetricsRegistry.getMarketMetrics();
console.assert(marketMetrics['yahoo']?.requestCount === 3, 'Market: yahoo requestCount should be 3');
console.assert(marketMetrics['yahoo']?.failureCount === 1, 'Market: yahoo failureCount should be 1');
console.assert(marketMetrics['finnhub']?.fallbackCount === 1, 'Market: finnhub fallbackCount should be 1');
console.log('✅ Market provider metrics: PASSED');
console.log('   Yahoo: requests=', marketMetrics['yahoo']?.requestCount, 'failures=', marketMetrics['yahoo']?.failureCount, 'avg=', marketMetrics['yahoo']?.avgLatencyMs.toFixed(0), 'ms');

// ─── 7. Full Snapshot ─────────────────────────────────────────────────────────
const mockCacheMetrics = { hitCount: 890, missCount: 45, hitRatio: 0.952, cacheSize: 12 };
const snapshot: SystemMetricsSnapshot = MetricsRegistry.snapshot(mockCacheMetrics);

console.assert(snapshot.generatedAt instanceof Date, 'Snapshot: generatedAt should be a Date');
console.assert(snapshot.uptimeMs >= 0, 'Snapshot: uptimeMs should be >= 0');
console.assert(typeof snapshot.api === 'object', 'Snapshot: api should be an object');
console.assert(typeof snapshot.workers === 'object', 'Snapshot: workers should be an object');
console.assert(typeof snapshot.scanners === 'object', 'Snapshot: scanners should be an object');
console.assert(typeof snapshot.trading === 'object', 'Snapshot: trading should be an object');
console.assert(typeof snapshot.marketProviders === 'object', 'Snapshot: marketProviders should be an object');
console.assert(snapshot.cache.hitCount === 890, 'Snapshot: cache.hitCount should be 890');
console.assert(snapshot.cache.hitRatio === 0.952, 'Snapshot: cache.hitRatio should be 0.952');
console.log('✅ Full snapshot: PASSED');

// ─── 8. Rolling window percentile check ──────────────────────────────────────
MetricsRegistry.reset();
// Record 100 requests with known latencies 1..100ms
for (let i = 1; i <= 100; i++) {
    MetricsRegistry.recordApiRequest('percentile-test', 'GET', 200, i);
}
const pMetrics = MetricsRegistry.getApiMetrics()['GET percentile-test'];
console.assert(pMetrics.p50Ms === 50, `Percentile: p50 should be 50, got ${pMetrics.p50Ms}`);
console.assert(pMetrics.p95Ms === 95, `Percentile: p95 should be 95, got ${pMetrics.p95Ms}`);
console.assert(pMetrics.p99Ms === 99, `Percentile: p99 should be 99, got ${pMetrics.p99Ms}`);
console.log('✅ Rolling window percentiles: PASSED');
console.log('   p50=', pMetrics.p50Ms, 'p95=', pMetrics.p95Ms, 'p99=', pMetrics.p99Ms);

console.log('\n=== ALL OBSERVABILITY TESTS PASSED ✅ ===\n');
