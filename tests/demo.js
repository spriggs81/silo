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

const LOG_COUNT = process.argv.slice(2) || 1_000_000; 

const clearMemory = () => {
    if (global.gc) {
        global.gc();
    } else {
        console.warn("Warming: GC not exposed. Run with --expose-gc for consistent results.");
    }
};

const run = async () => {

    console.log(LOG_COUNT)
    const myLogger = new Logs({
        filename: 'silo_demo_log',
        level: 30,
        benchmark: true
    });

    const startUsage = process.cpuUsage();
    const startMem = process.memoryUsage().heapUsed;
    const startTime = process.hrtime.bigint();

    try {
        clearMemory()
        console.log('clearing memory')
        console.log(`🚀 SILO: Executing ${LOG_COUNT.toLocaleString()} logs...`);
        for (let i = 0; i < LOG_COUNT; i++) {
            await myLogger.file({ iteration: (i + 1), mode: 'minimalist' });
        }
        await myLogger.flush();

        const endTime = process.hrtime.bigint();
        const endMem = process.memoryUsage().heapUsed;
        const timeInSecs = Number(endTime - startTime) / 1e9;
        const endUsage = process.cpuUsage(startUsage);

        console.log(`✅ SILO PASSED`);
        console.table({
            time: timeInSecs.toFixed(4),
            lps: Math.round(LOG_COUNT / timeInSecs).toLocaleString(),
            cpu: (((endUsage.user + endUsage.system) / (timeInSecs * 1000000))).toFixed(2) + '%',
            mem: ((endMem - startMem) / 1024 / 1024).toFixed(2) + ' MB'
        });
    } catch (err) {
        console.error(`❌ SILO FAILED`);
        console.table({
            Status: "FAILED",
            Time_Elapsed: timeInSecs.toFixed(4) + "s",
            Mem_at_Failure: ((endMem - startMem) / 1024 / 1024).toFixed(2) + " MB",
            CPU_Usage: (((endUsage.user + endUsage.system) / (timeInSecs * 1000000)) * 100).toFixed(2) + "%"
        });
        console.error(err);
    }
};

run();