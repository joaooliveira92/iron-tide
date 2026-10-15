#!/usr/bin/env node
// Run the phase-engine heavy simulation suites in isolation with bounded
// concurrency (release-readiness WS4). They are excluded from the default
// per-package suite; this launcher turns them back on in a dedicated process and
// caps vitest workers so a loaded CI box cannot flake them.

import { spawnSync } from "node:child_process";

const result = spawnSync(
  "pnpm",
  ["--filter", "@bluewave/phase-engine", "exec", "vp", "test", "run", "--maxWorkers=2"],
  {
    stdio: "inherit",
    env: { ...process.env, BLUEWAVE_HEAVY: "1" },
  },
);

process.exit(result.status ?? 1);
