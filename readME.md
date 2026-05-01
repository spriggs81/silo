# @flowrdesk/silo

**The high-performance, zero-dependency logging engine built for Node.js.**  
Part of the [Flowrdesk Silo Series](https://flowrdesk.com).

[![npm version](https://img.shields.io/npm/v/@flowrdesk/silo)](https://www.npmjs.com/package/@flowrdesk/silo)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)]()

---

## Why Silo

Most Node.js loggers make you choose between speed and stability. Silo doesn't make that tradeoff.

**Zero dependencies.** No `node_modules` risk, no supply chain vulnerabilities, no version conflicts. The entire engine is built on Node.js core APIs only.

**Per-instance architecture.** Every `new Logs()` call is a fully independent, self-contained logging instance. Each instance manages its own queue, its own write stream, its own rotation cycle, and its own backpressure. There is no global state. Instances never interfere with each other.

**Built-in backpressure.** Silo's engine automatically gates writes when the internal queue reaches capacity, then releases when it drains. Your application never runs out of memory from a logging spike. No configuration required — it works out of the box.

**Automatic file rotation.** Log files rotate automatically at a configurable size threshold (default 250MB). Rotated files are indexed sequentially. Your disk never fills up from runaway log growth.

**Proven at scale.** The only Node.js logger publicly benchmarked at 1 billion logs with documented memory stability.

---

## Install

```bash
npm install @flowrdesk/silo
```

---

## Quick Start

```js
import Logs from "@flowrdesk/silo";

const logger = new Logs({
  filename: "app",
  toFile: true,
  toTerminal: false,
});

await logger.file({ event: "server_start", port: 3000 });
await logger.file({
  event: "request",
  method: "GET",
  path: "/api/users",
  status: 200,
});

// Flush before process exit to ensure all logs are written
await logger.flush();
```

Logs are written to a `.logs/` folder in your project root by default.

---

## Configuration

### Constructor Options

```js
const logger = new Logs({
  filename, // Required. Base name for log files. e.g. 'app' → app_2026-01-01.log
  level, // Optional. String or number. Added to every log entry as "level".
  maxSize, // Optional. Max log file size in MB before rotation. Default: 250
  txtColor, // Optional. Terminal text color. See color options below.
  bgColor, // Optional. Terminal background color. See color options below.
  benchmark, // Optional. Boolean. Strips metadata for raw throughput testing. Default: false
  toFile, // Optional. Boolean. Write logs to file when using the 'logg' function. Default: true
  toTerminal, // Optional. Boolean. Write logs to terminal when using the 'logg' function. Default: true
  terminalRaw, // Optional. Boolean. Use raw terminal output (no ANSI formatting) when using the 'logg' function. Default: false
  maxQueueDepth, // Optional. Max items in write queue before backpressure activates. Default: 50_000
});
```

### Global Configuration

```js
import Logs, { configuration, bufferAutoTune } from "@flowrdesk/silo";

// Set a custom log directory (must be called before creating instances)
configuration({ setDir: "my_logs" });

// Set a custom write buffer size in KB (must be called before creating instances)
configuration({ setBufferSize: 512 });

// Auto-detect CPU and set optimal buffer size automatically
bufferAutoTune(); // Sets 64KB, 128KB, or 256KB based on detected CPU tier
```

> **Important:** Call `configuration()` and `bufferAutoTune()` before creating any logger instances. These settings apply globally and do not retroactively affect instances that have already been created.

---

## API

### `logger.logg(data)`

The unified logging method. Writes to file and/or terminal based on constructor settings. Accepts any object or value.

```js
logger.logg({ event: "purchase", userId: "u_123", amount: 49.99 });
```

### `logger.file(data)`

Write directly to file only, bypassing terminal output. Async — await it in high-volume loops.

```js
await logger.file({ event: "batch_process", item: "SKU-9981" });
```

### `logger.terminal(data)`

Write directly to terminal only, bypassing file output. This is a human readable output that uses ANSI color formatting

### `logger.terminal_raw(data)`

Write to terminal without ANSI color formatting. Used for benchmarking and raw output scenarios.

### `await logger.flush()`

Waits for all queued logs to be written to disk and closes the write stream cleanly. Always call this before process exit.

```js
process.on("SIGTERM", async () => {
  await logger.flush();
  process.exit(0);
});
```

### `await logger.terminalFlush()`

Flushes the terminal output queue.

### `await logger.rawTerminalFlush()`

Flushes the raw terminal output queue.

---

## Benchmark and Results

All benchmarks run on Windows, Node.js with `--expose-gc`, GC forced before each measurement. Tests are included in the package — run them yourself to verify on your own hardware.

### Run The Tests Yourself

> **Note:** Always run test files with `node --expose-gc your_file.js` for consistent memory readings.
> For large instance stress tests, add `--max-old-space-size=12288` to increase available heap. - (12GB shown)

### Core Throughput Benchmark Test

The `Benchmark Test`:

```javascript
import { benchmark } from "@flowrdesk/silo/tests";
// Benchmark — Silo (time, lps, cpu, mem)
// Default: 1,000,000 Logs Created
benchmark();
```

```javascript
import { benchmark } from "@flowrdesk/silo/tests";
// Custom Benchmark Logs Creation
// Warning: 1B log run takes approximately up to 40 minutes and use up to 140GB of space
benchmark(1_000_000_000);
```

`Why use this test?`<br>
This test measures the raw, peak velocity of the Silo engine under a specific load (Default: 1,000,000 logs). It is designed to provide a high-resolution snapshot of how the engine handles massive bursts of data, allowing you to quantify the immediate impact of logging on your system's resources.

Use this test to:

- **Measure Peak LPS:** Determine the maximum "Logs Per Second" your current hardware and Node.js environment can support.

- **Analyze CPU Intensity:** Understand the "CPU tax" associated with high-speed logging. Because Silo prioritizes flushing the queue quickly, it uses a short burst of CPU power to minimize the total time your application is held up by I/O.

- **Monitor Memory Ceiling:** Identify the peak heap usage required to process a specific volume of logs, ensuring it fits within your container or server limits.

- **Validate Optimizations:** Confirm the performance gains from Silo's internal refactors—such as the transition to template literals and optimized array construction—which reduce total execution time.

Understanding the Output

- **Time:** The total seconds taken to clear the queue from the first log to the final disk write.

- **LPS:** The average throughput velocity maintained during the run.

- **CPU:** The peak processing load. A higher percentage here indicates Silo is "sprinting" to finish the task faster.

- **Mem:** The highest memory delta reached, demonstrating Silo's adaptive batching in action.

#### Results of benchmark

| Number of Log    | Completion Time  | LPS     | Peak CPU | Memory    |
| ---------------- | ---------------- | ------- | -------- | --------- |
| **100 Thousand** | 0.32 seconds     | 305,514 | 191%     | 87.63 MB  |
| **1 Million**    | 2.30 seconds     | 435,491 | 173%     | 165.17 MB |
| **5 Million**    | 11.79 seconds    | 424,069 | 175%     | 137.74 MB |
| **10 Million**   | 22.74 seconds    | 439,780 | 168%     | 250.63 MB |
| **25 Million**   | 55.79 seconds    | 448,097 | 168%     | 254.98 MB |
| **50 Million**   | 111.33 seconds   | 449,108 | 168%     | 162.59 MB |
| **100 Million**  | 213.78 seconds   | 467,763 | 171%     | 253.79 MB |
| **1 Billion**    | 2,394.93 seconds | 417,550 | 173%     | 219.01 MB |

<hr>

### Sustained Load Memory Stability Test (60 seconds)

The `Memory Test`:

```javascript
import { memory_test } from "@flowrdesk/silo/tests";
// Sustained memory stability test (60 seconds)
memory_test();
```

`Why use this test?`<br>
Standard benchmarks often measure "sprints"—short bursts of speed that don't reveal how a logger behaves over time. This test is a marathon designed to simulate high-traffic production environments where logging is constant and heavy.

Use this test to:

- **Verify Backpressure:** Ensure that the internal batching logic correctly signals the system to "breathe," allowing the Node.js Garbage Collector to reclaim memory during heavy I/O.

- **Identify Memory Leaks:** Confirm that the engine maintains a stable "sawtooth" memory profile rather than a linear upward climb, which leads to fatal Out-Of-Memory (OOM) crashes.

- **Benchmark Long-Term Velocity:** Measure if the Logs Per Second (LPS) remains consistent or if the engine "chokes" as the heap grows over several minutes of sustained load.

- **Production Simulation:** Test Silo against your specific hardware constraints to find the perfect balance between high-speed throughput and stable resource consumption.

#### Results of Memory Test

```
🔬  SILO — Sustained Load Memory Stability Test (Backpressure Enabled)
    Duration:        60s
    Sample interval: 2s
────────────────────────────────────────────────────
    Time(s) | Heap Used | Delta from Start | LPS (interval)
────────────────────────────────────────────────────
    2.0    s |  175.43 MB |         170.66 MB | 461,612
    4.0    s |  206.57 MB |         201.80 MB | 434,819
    6.0    s |  235.68 MB |         230.92 MB | 511,038
    8.0    s |  248.97 MB |         244.21 MB | 507,339
    10.1   s |  200.25 MB |         195.48 MB | 428,521
    12.1   s |  235.94 MB |         231.17 MB | 486,364
    14.1   s |  240.17 MB |         235.40 MB | 462,011
    16.1   s |  138.82 MB |         134.05 MB | 433,451
    18.1   s |  171.25 MB |         166.48 MB | 469,823
    20.2   s |  161.85 MB |         157.08 MB | 443,941
    22.2   s |  165.01 MB |         160.24 MB | 470,354
    24.2   s |  186.66 MB |         181.89 MB | 474,814
    26.2   s |  170.18 MB |         165.42 MB | 446,187
    28.2   s |  177.55 MB |         172.78 MB | 449,809
    30.2   s |  153.39 MB |         148.62 MB | 412,073
    32.2   s |   88.77 MB |          84.00 MB | 400,010
    34.2   s |  115.03 MB |         110.26 MB | 473,468
    36.2   s |  146.50 MB |         141.73 MB | 499,741
    38.2   s |  237.60 MB |         232.84 MB | 560,364
    40.3   s |  265.14 MB |         260.38 MB | 488,694
    42.3   s |  230.91 MB |         226.14 MB | 421,690
    44.3   s |   97.57 MB |          92.80 MB | 486,974
    46.3   s |  115.53 MB |         110.76 MB | 486,405
    48.3   s |   98.14 MB |          93.37 MB | 462,291
    50.3   s |  285.88 MB |         281.11 MB | 424,929
    52.3   s |  133.11 MB |         128.35 MB | 510,092
    54.3   s |  186.05 MB |         181.29 MB | 532,532
    56.3   s |  203.85 MB |         199.08 MB | 499,899
    58.3   s |  202.86 MB |         198.09 MB | 474,865
────────────────────────────────────────────────────

📊  FINAL SUMMARY
    Total logs written : 28,150,000
    Total time         : 60.03s
    Avg LPS            : 468,934
    Heap at start      : 4.77 MB
    Heap at end        : 119.20 MB
    Net heap delta     : 114.44 MB

📈  MEMORY TREND ANALYSIS
    Slope              : -34.53 MB/min
    Verdict            : ✅  STABLE — memory is not growing meaningfully

────────────────────────────────────────────────────
```

<hr>

### Multi-Instance Stress Test

The `Log Instance Stress Test`:

```javascript
import { instance_stress } from "@flowrdesk/silo/tests";
// Multi-instance stress test
// Default: 30 instances, 10,000 logs each
instance_stress();
```

```javascript
import { instance_stress } from "@flowrdesk/silo/tests";
// Custom instance count and logs per instance
instance_stress(500, 20000);
```

`Why use this test?`<br>
In modern microservices or large-scale applications, you rarely have just one logging instance. This test simulates a "High-Density" environment by spinning up 30 independent Silo instances and hammering them all at once. It’s designed to find the breaking point of the system’s I/O and event loop when multiple loggers are fighting for the same resources.

Use this test to:

- **Validate Concurrency:** Ensure that Silo’s zero-dependency architecture doesn't cause race conditions or file locks when dozens of instances write to the disk simultaneously.

- **Measure "Event Loop Lag":** Monitor the responsiveness of your application. High-speed logging is useless if it blocks the Node.js event loop; this test tracks the maximum lag to ensure your app stays snappy even during an I/O "hammering" event.

- **Calculate Resource Density:** See exactly how little RAM it takes to run multiple instances. With an average memory growth of +-0.05 MB for 30 instances, this test proves Silo is lean enough for edge computing and high-density container environments.

- **Test System Limits:** Identify OS-level constraints (like the "Windows Wall" or ulimit on Linux) to help you tune your production environment for maximum stability.

Key Metrics Explained:<br>

- **Boot Time:** How fast 30 instances can initialize and be ready to log.

- **Throughput (Combined):** The total aggregate velocity of all instances working in parallel (hitting over 618k LPS in v1.0.4).

- **Event Loop Lag:** A critical health metric; lower is better. It measures the delay in the Node.js execution cycle caused by the logging load. **Note:** The lag reported here is a `"worst-case scenario" metric`; because this test intentionally hammers the event loop to find its breaking point, these numbers reflect extreme stress rather than standard, day-to-day logging behavior.

- **Density:** A "fun" but meaningful stat showing how many millions of logs Silo can process per every 1MB of RAM consumed.

#### The Results of Instance Stress Test:

```
========================================================================
   SILO ENGINE MULTI-INSTANCE STRESS TEST: 30 INSTANCES
========================================================================
'ulimit' is not recognized as an internal or external command,
operable program or batch file.
ℹ️  Could not check ulimit (likely Windows). Ensure stability.
🚀 Boot Time: 11.563ms
🔨 Hammering 30 instances with 10000 logs each...
⏳ Waiting for all file queues to flush to disk...

========================================================================
   FINAL STRESS REPORT: THE "WINDOWS WALL" EDITION
========================================================================
✅ Successful Instances:   30
📈 Total Logs Written:     300,000
⏱️  Execution Time:         0.485s
🚀 Throughput:             618,556 LPS
🧠 Mem Growth:             +-0.05 MB
💎 Avg Mem Per Instance:   -0.002 MB
⚡ Max Event Loop Lag:     281ms
📊 Density:                -5,539,034 Logs per 1MB RAM
========================================================================
```

## Multi-Instance Usage

Each instance is fully independent. You can run hundreds of instances simultaneously with different configurations:

```js
import Logs, { configuration } from "@flowrdesk/silo";

// Service-level loggers — each with its own file, rotation, and queue
const appLogger = new Logs({
  filename: "app",
  toFile: true,
  toTerminal: false,
});
const errorLogger = new Logs({
  filename: "errors",
  toFile: true,
  toTerminal: true,
  level: "error",
});
const auditLogger = new Logs({
  filename: "audit",
  toFile: true,
  toTerminal: false,
  maxSize: 500,
});

appLogger.logg({ event: "request", path: "/checkout" });
errorLogger.logg({ event: "unhandled_exception", stack: err.stack });
auditLogger.logg({ event: "payment_processed", userId: "u_882", amount: 99.0 });
```

---

## Production Usage Pattern

```js
import Logs from "@flowrdesk/silo";

const logger = new Logs({
  filename: "api",
  level: "info",
  toFile: true,
  toTerminal: process.env.NODE_ENV !== "production",
});

// In an Express route
app.get("/users/:id", async (req, res) => {
  logger.logg({
    event: "request",
    method: "GET",
    path: req.path,
    userId: req.params.id,
  });

  try {
    const user = await db.getUser(req.params.id);
    logger.logg({ event: "response", status: 200, userId: req.params.id });
    res.json(user);
  } catch (err) {
    logger.logg({ event: "error", status: 500, message: err.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await logger.flush();
  process.exit(0);
});
```

---

## Part of the Silo Series

Silo Free is the open-source core engine. The Flowrdesk Silo Series builds on this foundation:

| Product        | Description                                        | Availability   |
| -------------- | -------------------------------------------------- | -------------- |
| **Silo Free**  | Core engine — what you're using now                | ✅ Available   |
| **Silo Basic** | PII scrubbing + automated log lifecycle management | 🔜 Coming Soon |

Learn more at [flowrdesk.com](https://flowrdesk.com)

---

## License

Apache-2.0 — see [LICENSE](./LICENSE) for full text.
Copyright 2026 John Spriggs (Flowrdesk LLC) — see [NOTICE](./NOTICE).
