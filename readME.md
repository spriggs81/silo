# @flowrdesk/silo

**The high-performance, zero-dependency logging engine built for Node.js.**  
Part of the [Flowrdesk Silo Series](https://flowrdesk.com).

[![npm version](https://img.shields.io/npm/v/@flowrdesk/silo)](https://www.npmjs.com/package/@flowrdesk/silo)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)]()

---

## Why Silo

Most Node.js loggers make you choose between speed and stability. Pino is fast but consumes memory aggressively at scale. Winston is stable but too slow for high-throughput environments. Silo doesn't make that tradeoff.

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

logger.logg({ event: "server_start", port: 3000 });
logger.logg({
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
  toFile, // Optional. Boolean. Write logs to file. Default: true
  toTerminal, // Optional. Boolean. Write logs to terminal. Default: true
  terminalRaw, // Optional. Boolean. Use raw terminal output (no ANSI formatting). Default: false
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

Write directly to terminal only, bypassing file output.

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

### `await logger.waitForQueueSpace()`

Parks the caller until the internal queue drains below 50% capacity. Available for power users running high-volume batch scenarios who want explicit backpressure control. Regular usage does not require this — the engine self-regulates.

```js
// High-volume batch scenario
for (const record of massiveDataset) {
  await logger.waitForQueueSpace();
  logger.file(record);
}
```

### `await logger.terminalFlush()`

Flushes the terminal output queue.

### `await logger.rawTerminalFlush()`

Flushes the raw terminal output queue.

---

## Benchmark Results

All benchmarks run on Windows, Node.js with `--expose-gc`, GC forced before each measurement. Tests are included in the package — run them yourself to verify on your own hardware.

### Fair Fight: 1,000,000 Logs (File Output)

| Engine   | LPS           | Memory       |
| -------- | ------------- | ------------ |
| **Silo** | **1,535,373** | **13.58 MB** |
| Pino     | 1,559,696     | 298.23 MB    |
| Winston  | 117,211       | 1,403.01 MB  |

Silo matches Pino's throughput at **22x less memory**. Winston uses over 100x more memory at 13x slower speed.

### Scale Test: Where Others Drop Out

| Engine   | 25M Logs                      | 100M Logs            | 1B Logs      |
| -------- | ----------------------------- | -------------------- | ------------ |
| **Silo** | ✅ 91.16 MB                   | ✅ 115.96 MB         | ✅ 125.53 MB |
| Pino     | ❌ 11,063 MB — heap exhausted | ❌                   | ❌           |
| Winston  | ⚠️ 111 MB / 51K LPS           | ❌ estimated 60+ min | ❌           |

### 1 Billion Log Run

```
Total logs written  : 1,000,000,000
File rotations      : 255 (automatic, zero logs dropped)
Throughput          : 1,084,801 LPS sustained
Memory overhead     : 125.53 MB
CPU usage           : 1.61%
```

Pino and Winston cannot complete a 25 million log run without exhausting available heap. Silo ran 1 billion logs — 40x further — with 126MB of memory.

### Sustained Load Memory Stability (60 seconds)

```
Total logs written  : 34,557,603
Avg LPS             : 575,557
Memory behavior     : Stable — normal GC oscillation under sustained load
Memory slope        : 75.29 MB/min (oscillating, not accumulating)
```

## Run The Tests Yourself

> **Note:** Always run test files with `node --expose-gc your_file.js` for consistent memory readings.
> For large instance stress tests, add `--max-old-space-size=12288` to increase available heap. - (12GB shown)

```javascript
import { benchmark } from "@flowrdesk/silo/tests";
// Benchmark — Silo (time, lps, cpu, mem)
// Default: 1,000,000 Logs Created
benchmark();
```

```javascript
import { benchmark } from "@flowrdesk/silo/tests";
// Custom Benchmark Logs Creation
// Warning: 1B log run takes approximately 15-28 minutes
benchmark(1_000_000_000);
```

```javascript
import { battleRoyale } from "@flowrdesk/silo/tests";
// Silo vs Pino vs Winston — default 1,000,000 logs / 5 times provides avg
// Requires: npm install pino winston
battleRoyale();
```

```javascript
import { battleRoyale } from "@flowrdesk/silo/tests";
// Silo vs Pino vs Winston — custom entry log amount / 5 times provides avg
// Requires: npm install pino winston
battleRoyale(10_000_000);
```

```javascript
import { memory_test } from "@flowrdesk/silo/tests";
// Sustained memory stability test (60 seconds)
memory_test();
```

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
| **Silo Guard** | Enterprise compliance tier                         | 🔜 Coming Soon |

Learn more at [flowrdesk.com](https://flowrdesk.com)

---

## License

Apache-2.0 — see [LICENSE](./LICENSE) for full text.  
Copyright 2026 John Spriggs (Flowrdesk LLC) — see [NOTICE](./NOTICE).
