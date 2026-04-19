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

import Logs, { configuration } from '../index.js';



export const benchmark = async (LOG_COUNT = 1_000_000) => {
    const callOutAt = Math.max(Math.floor(LOG_COUNT / 10), 1)
    configuration({ setDir: "test_logs" }) 
    const clearMemory = () => {
        if (global.gc) {
            global.gc();
        } else {
            console.warn("Warming: GC not exposed. Run with --expose-gc for consistent results.");
        }
    };
    const myLogger = new Logs({
        filename: 'silo_demo_log',
        level: 30,
        // benchmark: true  //  ***** if true removes metadata *****
    });

    const startUsage = process.cpuUsage();
    const startMem = process.memoryUsage().heapUsed;
    const startTime = process.hrtime.bigint();

    let timeInSecs = 0;
    let endMem = 0;
    let endUsage = { user: 0, system: 0 };

    try {
        console.log('🧹 GC Clearing Memory')
        clearMemory()
        console.log(`🚀 SILO: Executing ${LOG_COUNT.toLocaleString()} logs...`);
        let peakMem = process.memoryUsage().heapUsed
        const checkAt = Math.max(1000, Math.floor(LOG_COUNT / 100))

        for (let i = 0; i < LOG_COUNT; i++) {
            await myLogger.file({ iteration: (i + 1), mode: 'minimalist', val: 0.123456789 });
            if(i % checkAt === 0){
                const currentMem = process.memoryUsage().heapUsed
                if(currentMem > peakMem) peakMem = currentMem
            }
            if((i + 1) % callOutAt === 0){
                process.stdout.write(`\r Logs Proecssed: ${(i + 1).toLocaleString('en-US')}`)
            }
        }
        await myLogger.flush();

        const endTime = process.hrtime.bigint();
        endMem = process.memoryUsage().heapUsed;
        timeInSecs = Number(endTime - startTime) / 1e9;
        endUsage = process.cpuUsage(startUsage);

        console.log(`\n✅ SILO PASSED`);
        console.table({
            time: timeInSecs.toFixed(4),
            lps: Math.round(LOG_COUNT / timeInSecs).toLocaleString(),
            cpu: (((endUsage.user + endUsage.system) / (timeInSecs * 1000000)) * 100).toFixed(0) + '%',
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