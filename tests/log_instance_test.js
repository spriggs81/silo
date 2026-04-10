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


import Logs from '../index.js';
import { execSync } from 'child_process';

const args = process.argv.slice(2)
const totalLogInstances = parseInt(args[0]) || 30
const logsPerInstance = parseInt(args[1]) || 10_000

async function runMegaStressTest(targetInstances, loggingEachInstance) {
    let maxLoopLag = 0;
    const startLagMonitor = () => {
        let lastTime = Date.now();
        const interval = setInterval(() => {
            const now = Date.now();
            const lag = now - lastTime - 100; // 100ms is the interval
            if (lag > maxLoopLag) maxLoopLag = Math.max(0, lag);
            lastTime = now;
        }, 100);
        return () => clearInterval(interval);
    };
    const instances = [];
    const logsPerInstance = loggingEachInstance;
    
    console.log(`\n========================================================================`);
    console.log(`   SILO ENGINE MULTI-INSTANCE STRESS TEST: ${targetInstances} INSTANCES`);
    console.log(`========================================================================`);

    // 1. OS PRE-CHECK
    try {
        const limit = execSync('ulimit -n').toString().trim();
        console.log(`ℹ️  Current OS File Limit: ${limit}`);
        if (parseInt(limit) < targetInstances + 100) {
            console.log(`⚠️  WARNING: Your limit is lower than your target instances.`);
        }
    } catch (e) {
        console.log(`ℹ️  Could not check ulimit (likely Windows). Ensure stability.`);
    }

    const initialMem = process.memoryUsage().heapUsed;
    console.time('🚀 Boot Time');
    
    for (let i = 0; i < targetInstances; i++) {
        try {
            const logger = new Logs({
                filename: `silo_log_instance_test_${i + 1}`,
                benchmark: true,
                toTerminal: false, // Keep terminal quiet so we can see logic speed
                toFile: true
            });
            instances.push(logger);
        } catch (err) {
            console.error(`❌ FAILED at instance ${i}: ${err.message}`);
            break;
        }
    }
    console.timeEnd('🚀 Boot Time');
    const stopLag = startLagMonitor(); // Start monitoring right before hammering

    // 3. THE HAMMER PHASE (Simultaneous Batching)
    console.log(`🔨 Hammering ${instances.length} instances with ${logsPerInstance} logs each...`);
    const startHammer = Date.now();
    
    // We send all logs as fast as the CPU allows
    await Promise.all(instances.map(async (logger) => {
        for (let j = 0; j < logsPerInstance; j++) {
            await logger.file({ msg: `Stress test log ${j}`, val: j * 32 });
        }
    }));

    // 4. THE FLUSH (Wait for all Gatekeepers to finish)
    console.log(`⏳ Waiting for all file queues to flush to disk...`);
    await Promise.all(instances.map(inst => inst.flush()));
    stopLag(); // Stop monitoring once queues are flushed

    if (global.gc) { global.gc(); global.gc(); }

    
    const memGrowthMB = (process.memoryUsage().heapUsed - initialMem) / 1024 / 1024;
    const totalLogsCount = instances.length * logsPerInstance; // Use .length here
    const finalDurationSec = (Date.now() - startHammer) / 1000; // Time from start of logs to flush

    console.log(`\n========================================================================`);
    console.log(`   FINAL STRESS REPORT: THE "WINDOWS WALL" EDITION`);
    console.log(`========================================================================`);
    console.log(`✅ Successful Instances:   ${instances.length}`);
    console.log(`📈 Total Logs Written:     ${totalLogsCount.toLocaleString()}`);
    console.log(`⏱️  Execution Time:         ${finalDurationSec.toFixed(3)}s`);
    console.log(`🚀 Throughput:             ${Math.floor(totalLogsCount / finalDurationSec).toLocaleString()} LPS`);
    console.log(`🧠 Mem Growth:             +${memGrowthMB.toFixed(2)} MB`);
    console.log(`💎 Avg Mem Per Instance:   ${(memGrowthMB / instances.length).toFixed(3)} MB`);
    console.log(`⚡ Max Event Loop Lag:     ${maxLoopLag}ms`);
    console.log(`📊 Density:                ${Math.floor(totalLogsCount / memGrowthMB).toLocaleString()} Logs per 1MB RAM`);
    console.log(`========================================================================`);
}

runMegaStressTest(totalLogInstances, logsPerInstance);