# @flowrdesk/silo

**The high-performance, zero-dependency logging engine built for Node.js.**  
Part of the [Flowrdesk Silo Series](https://flowrdesk.com).

[![npm version](https://img.shields.io/npm/v/@flowrdesk/silo)](https://www.npmjs.com/package/@flowrdesk/silo)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)]()

---

## Why Silo

Most Node.js loggers make you choose between speed and stability. Silo doesn't make that tradeoff.

**Zero dependencies:** No `node_modules` risk, no supply chain vulnerabilities, no version conflicts. The entire engine is built on Node.js core APIs only.

**Per-instance architecture:** Every `new Logs()` call is a fully independent, self-contained logging instance. Each instance manages its own queue, its own write stream, its own rotation cycle, and its own backpressure. There is no global state. Instances never interfere with each other.

**Built-in backpressure:** Silo's engine automatically gates writes when the internal queue reaches capacity, then releases when it drains. Your application never runs out of memory from a logging spike. No configuration required — it works out of the box.

**Automatic daily file rotation:** Never lose track of time. Silo automatically archives active logs at midnight, starting every day with a fresh file. Keeping your active logs relevant and your archives organized by date. _Zero configuration required_.

**Automatic file rotation:** Log files rotate automatically at a configurable size threshold (default 250MB). Rotated files are indexed sequentially. _Your files never fill up from runaway log growth_.

**Proven at scale:** The only Node.js logger publicly benchmarked at 1 billion logs with documented memory stability.

---

## 🏆 **The Billion Log Challenge**

Most loggers fail or fragment under extreme, sustained volume. In our stress tests, Silo processed **1,000,000,000 logs** consecutively in a Dockerized Linux environment.

- **Zero Leak Architecture:** Memory remained stable at ~102MB from log #1 to log #1,000,000,000.

- **Sustained Performance:** Maintained an average of 416k+ LPS over a 40-minute continuous write cycle.

- **Production Ready:** Proof that Silo can handle the most demanding enterprise workloads without exhausting system resources.

| 1 Billion Log Test        | Silo version 1.0.3            | Silo version 1.0.4            |
| ------------------------- | ----------------------------- | ----------------------------- |
| **Time Of Completion:**   | 2,655.73 seconds (44.42 mins) | 2,402.77 seconds (40.04 mins) |
| **Log Per Second (LPS):** | 376,544                       | 416,187                       |
| **CPU%:**                 | 196%                          | 179%                          |
| **Peak Memory:**          | 78.42 MB                      | 102.59 MB                     |

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

- **Mem:** The highest RSS (Resident Set Size) memory delta reached, measuring total process memory rather than heap alone, demonstrating Silo's adaptive batching in action.

#### Results of benchmark (by version)

_Note: Initial benchmarks were performed on Windows environments. All current and future testing is conducted within Docker containers (Linux) to better simulate real-world production server performance._

<details>
<summary>1 Million Log Test Run</summary>

|                           | Silo version 1.0.3 | Silo version 1.0.4 |
| ------------------------- | ------------------ | ------------------ |
| **Time Of Completion:**   | 3.15 seconds       | 2.46 seconds       |
| **Log Per Second (LPS):** | 317,505            | 406,084            |
| **CPU%:**                 | 200%               | 184%               |
| **Peak Memory:**          | 39.41 MB           | 96.96 MB           |

</details>
<br>
<details>
<summary>5 Million Log Test Run</summary>

|                           | Silo version 1.0.3 | Silo version 1.0.4 |
| ------------------------- | ------------------ | ------------------ |
| **Time Of Completion:**   | 11.87 seconds      | 10.84 seconds      |
| **Log Per Second (LPS):** | 421,255            | 461,105            |
| **CPU%:**                 | 192%               | 178%               |
| **Peak Memory:**          | 123.10 MB          | 44.83 MB           |

</details>
<br>
<details>
<summary>10 Million Log Test Run</summary>

|                           | Silo version 1.0.3 | Silo version 1.0.4 |
| ------------------------- | ------------------ | ------------------ |
| **Time Of Completion:**   | 26.39 seconds      | 19.80 seconds      |
| **Log Per Second (LPS):** | 378,924            | 505,004            |
| **CPU%:**                 | 187%               | 181%               |
| **Peak Memory:**          | 156.88 MB          | 95.22 MB           |

</details>
<br>
<details>
<summary>100 Million Log Test Run</summary>

|                           | Silo version 1.0.3         | Silo version 1.0.4         |
| ------------------------- | -------------------------- | -------------------------- |
| **Time Of Completion:**   | 246.60 seconds (4.11 mins) | 212.71 seconds (3.55 mins) |
| **Log Per Second (LPS):** | 405,514                    | 470,118                    |
| **CPU%:**                 | 189%                       | 182%                       |
| **Peak Memory:**          | 171.68 MB                  | 63.80 MB                   |

</details>
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

_Note: Initial benchmarks were performed on Windows environments. All current and future testing is conducted within Docker containers (Linux) to better simulate real-world production server performance._

<details>
<summary>1 Minute Memory Test</summary>

|                         | Silo version 1.0.3 | Silo version 1.0.4 |
| ----------------------- | ------------------ | ------------------ |
| **Total logs written:** | 23,310,306         | 34,467,474         |
| **Total time:**         | 60.03 seconds      | 60.03 seconds      |
| **Avg LPS**             | 388,340            | 574,156            |
| **Heap at start:**      | 4.55 MB            | 4.63 MB            |
| **Heap at end:**        | 153.65 MB          | 53.63 MB           |
| **Net heap delta:**     | 149.10 MB          | 49.01 MB           |
| **Slope**               | 2.22 MB/min        | 20.34 MB/min       |
| **Verdict:**            | STABLE             | STABLE             |

</details>
<br>
<details>
<summary>3 Minute Memory Test</summary>

|                         | Silo version 1.0.3 | Silo version 1.0.4 |
| ----------------------- | ------------------ | ------------------ |
| **Total logs written:** | 67,425,000         | 93,914,422         |
| **Total time:**         | 180.07 seconds     | 180.03 seconds     |
| **Avg LPS**             | 374,444            | 521,652            |
| **Heap at start:**      | 4.55 MB            | 4.62 MB            |
| **Heap at end:**        | 58.59 MB           | 85.82 MB           |
| **Net heap delta:**     | 54.04 MB           | 81.20 MB           |
| **Slope**               | -5.02 MB/min       | 5.08 MB/min        |
| **Verdict:**            | STABLE             | STABLE             |

</details>
<br>
<details>
<summary>6 Minute Memory Test</summary>

|                         | Silo version 1.0.3 | Silo version 1.0.4 |
| ----------------------- | ------------------ | ------------------ |
| **Total logs written:** | 133,530,830        | 167,372,917        |
| **Total time:**         | 360.07 seconds     | 360.03 seconds     |
| **Avg LPS**             | 370,851            | 464,887            |
| **Heap at start:**      | 4.55 MB            | 4.62 MB            |
| **Heap at end:**        | 161.41 MB          | 122.23 MB          |
| **Net heap delta:**     | 156.86 MB          | 117.61 MB          |
| **Slope**               | -1.81 MB/min       | -0.81 MB/min       |
| **Verdict:**            | STABLE             | STABLE             |

</details>
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

- **Density:** Measures how many logs Silo processes per MB of RAM consumed. Useful for capacity planning in high-density container environments.

#### The Results of Instance Stress Test:

_Note: Initial benchmarks were performed on Windows environments. All current and future testing is conducted within Docker containers (Linux) to better simulate real-world production server performance._
<br>

_⚠️ Disclaimer: The Instance Stress Test is a deliberate system hammer — it intentionally pushes Node.js, the file system, and the event loop to their breaking point by running multiple aggressive instances simultaneously. The metrics here, especially event loop lag, reflect an extreme pathological scenario and are not representative of Silo's behavior in a normal production environment. Real-world production logging operates at a fraction of this intensity._

<details>
<summary>The "Standard Load" (3 Instances)</summary>

|                           | Silo version 1.0.3         | Silo version 1.0.4         |
| ------------------------- | -------------------------- | -------------------------- |
| **Successful Instances:** | 3                          | 3                          |
| **Logs per Instance:**    | 1,000,000                  | 1,000,000                  |
| **Total Logs Written**    | 3,000,000                  | 3,000,000                  |
| **Boot Time:**            | 2.041 ms                   | 2.57 ms                    |
| **Execution Time:**       | 4.720 seconds              | 4.054 seconds              |
| **Throughput:**           | 635,593 LPS                | 740,009 LPS                |
| **Mem Growth**            | +-0.65 MB                  | +-0.69 MB                  |
| **Avg Mem Per Instance:** | -0.217 MB                  | -0.229 MB                  |
| **Max Event Loop Lag**    | 164 ms                     | 156 ms                     |
| **Density:**              | 4,604,673 logs per 1MB RAM | 4,367,805 Logs per 1MB RAM |

</details>
<br>
<details>
<summary>The "Microservice Mesh" (15 Instances)</summary>

|                           | Silo version 1.0.3          | Silo version 1.0.4          |
| ------------------------- | --------------------------- | --------------------------- |
| **Successful Instances:** | 15                          | 15                          |
| **Logs per Instance:**    | 500,000                     | 500,000                     |
| **Total Logs Written**    | 7,500,000                   | 7,500,000                   |
| **Boot Time:**            | 4.653 ms                    | 2.167 ms                    |
| **Execution Time:**       | 11.032 seconds              | 11.106 seconds              |
| **Throughput:**           | 679,840 LPS                 | 675,310 LPS                 |
| **Mem Growth**            | +0.32 MB                    | +-0.51 MB                   |
| **Avg Mem Per Instance:** | 0.021 MB                    | -0.034 MB                   |
| **Max Event Loop Lag**    | 935 ms                      | 1102 ms                     |
| **Density:**              | 23,569,013 Logs per 1MB RAM | 14,809,727 Logs per 1MB RAM |

</details>
<br>
<details>
<summary>The "Hammer Test" (30+ Instances)</summary>

|                           | Silo version 1.0.3          | Silo version 1.0.4          |
| ------------------------- | --------------------------- | --------------------------- |
| **Successful Instances:** | 30                          | 30                          |
| **Logs per Instance:**    | 1,000,000                   | 1,000,000                   |
| **Total Logs Written**    | 30,000,000                  | 30,000,000                  |
| **Boot Time:**            | 3.064 ms                    | 4.138 ms                    |
| **Execution Time:**       | 47.793 seconds              | 46.645 seconds              |
| **Throughput:**           | 627,706 LPS                 | 642,645 LPS                 |
| **Mem Growth**            | +-0.38 MB                   | +-0.46 MB                   |
| **Avg Mem Per Instance:** | -0.013 MB                   | -0.015 MB                   |
| **Max Event Loop Lag**    | 1863 ms                     | 2890 ms                     |
| **Density:**              | 78,876,675 Logs per 1MB RAM | 65,597,225 Logs per 1MB RAM |

</details>

_Note: The increased event loop lag in 1.0.4 is a direct result of the more aggressive write throughput — the engine is doing more work per cycle. Under normal production loads this difference is not observable._

<hr>

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

| Product         | Description                         | Availability   |
| --------------- | ----------------------------------- | -------------- |
| **Silo Free**   | Core engine — what you're using now | ✅ Available   |
| **Silo Basic**  | Automated log lifecycle management  | 🔜 Coming Soon |
| **Silo Shield** | PII scrubbing                       | 🔜 Coming Soon |

Learn more at [flowrdesk.com](https://flowrdesk.com)

---

## License

Apache-2.0 — see [LICENSE](./LICENSE) for full text.
Copyright 2026 John Spriggs (Flowrdesk LLC) — see [NOTICE](./NOTICE).

<hr>

## Changelog

### 1.0.4

- Improved write throughput — 10.5% LPS increase over 1.0.3
- Reduced CPU usage — 179% vs 196% at 1B logs

### 1.0.3

- Initial public release
<hr>

## 🛠️ Testing Environment

To ensure the validity of these benchmarks, all tests were conducted in a containerized environment to isolate resource usage and simulate production-grade deployment.

| Component       | Specification                                  |
| --------------- | ---------------------------------------------- |
| **Processor**   | 13th Gen Intel® Core™ i7-1360P (Up to 5.0 GHz) |
| **Memory**      | 16GB LPDDR5 RAM                                |
| **Storage**     | NVMe PCIe Gen4 SSD                             |
| **OS Host**     | Windows 11 Home (64-bit)                       |
| **Runtime Env** | Runtime Env WSL2 (Ubuntu) / Docker Engine      |
| **Node.js**     | v22                                            |
