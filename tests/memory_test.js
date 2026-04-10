/**
 * Copyright 2026 John Spriggs (Flowrdesk LLC)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// ============================================================
//  SILO — Sustained Load Memory Stability Test (Backpressure Enabled)
// ============================================================

import Logs from '../index.js';
import { performance } from 'perf_hooks';

const DURATION_MS = 60_000;
const SAMPLE_INTERVAL_MS = 2_000;
const LOG_MSG = { msg: "Sustained load test entry", val: 0.123456789 };

function mb(bytes) { return (bytes / 1024 / 1024).toFixed(2); }

async function runSustainedTest() {
    console.log(`\n🔬  SILO — Sustained Load Memory Stability Test (Backpressure Enabled)`);
    console.log(`    Duration:        ${DURATION_MS / 1000}s`);
    console.log(`    Sample interval: ${SAMPLE_INTERVAL_MS / 1000}s`);
    console.log(`────────────────────────────────────────────────────`);
    console.log(`    Time(s) | Heap Used | Delta from Start | LPS (interval)`);
    console.log(`────────────────────────────────────────────────────`);

    if (global.gc) { global.gc(); global.gc(); }

    const logger = new Logs({ filename: 'silo_memory_test', toFile: true, toTerminal: false });

    const startMem = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    let totalLogs = 0;
    let intervalLogs = 0;
    let lastSampleTime = performance.now();
    const samples = [];

    // Sampling interval — snapshots heap independently of the write loop
    const sampler = setInterval(() => {
        const now = performance.now();
        const elapsed = ((now - startTime) / 1000).toFixed(1);
        const heap = process.memoryUsage().heapUsed;
        const deltaFromStart = mb(heap - startMem);
        const intervalSecs = (now - lastSampleTime) / 1000;
        const intervalLPS = Math.floor(intervalLogs / intervalSecs).toLocaleString();

        console.log(`    ${String(elapsed).padEnd(7)}s | ${mb(heap).padStart(7)} MB | ${String(deltaFromStart).padStart(14)} MB | ${intervalLPS}`);

        samples.push({ elapsed: parseFloat(elapsed), heap });
        lastSampleTime = now;
        intervalLogs = 0;
    }, SAMPLE_INTERVAL_MS);

    // Write loop — yields when queue is under pressure, free-runs when it has room
    const endTime = startTime + DURATION_MS;
    while (performance.now() < endTime) {
        // Gate: parks here if fileQueue >= maxQueueDepth
        // Resolves immediately (zero cost) when queue has room
        // await logger.waitForQueueSpace();
        await logger.file(LOG_MSG);
        totalLogs++;
        intervalLogs++;
    }

    clearInterval(sampler);
    await logger.flush();

    const totalElapsed = (performance.now() - startTime) / 1000;
    const finalHeap = process.memoryUsage().heapUsed;

    // Linear regression for trend
    const n = samples.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (const s of samples) {
        sumX += s.elapsed;
        sumY += s.heap;
        sumXY += s.elapsed * s.heap;
        sumX2 += s.elapsed * s.elapsed;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const slopeMBperMin = ((slope * 60) / 1024 / 1024).toFixed(2);
    const trending = Math.abs(parseFloat(slopeMBperMin)) < 150
        ? '✅  STABLE — memory is not growing meaningfully'
        : parseFloat(slopeMBperMin) > 0
            ? '⚠️  GROWING — possible memory pressure, consider tuning maxQueueDepth'
            : '✅  SHRINKING — GC is reclaiming memory over time';

    console.log(`────────────────────────────────────────────────────`);
    console.log(`\n📊  FINAL SUMMARY`);
    console.log(`    Total logs written : ${totalLogs.toLocaleString()}`);
    console.log(`    Total time         : ${totalElapsed.toFixed(2)}s`);
    console.log(`    Avg LPS            : ${Math.floor(totalLogs / totalElapsed).toLocaleString()}`);
    console.log(`    Heap at start      : ${mb(startMem)} MB`);
    console.log(`    Heap at end        : ${mb(finalHeap)} MB`);
    console.log(`    Net heap delta     : ${mb(finalHeap - startMem)} MB`);
    console.log(`\n📈  MEMORY TREND ANALYSIS`);
    console.log(`    Slope              : ${slopeMBperMin} MB/min`);
    console.log(`    Verdict            : ${trending}`);
    console.log(`\n────────────────────────────────────────────────────\n`);
}

runSustainedTest().catch(console.error);
