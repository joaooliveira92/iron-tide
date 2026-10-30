import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { evaluatePackage, formatReport } from "./guard.ts";
import { decodePolicy, type PackageMode } from "./policy.ts";
import { snapshotPackage } from "./snapshot.ts";

const DESKTOP = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const { values } = parseArgs({
  options: {
    mode: { type: "string" },
    package: { type: "string" },
    policy: { type: "string", default: join(DESKTOP, "package-policy", "package-policy.v1.json") },
    json: { type: "string" },
  },
});

function fail(message: string): never {
  process.stderr.write(`package guard: input error: ${message}\n`);
  process.exit(2);
}

const mode = values.mode;
if (mode !== "default" && mode !== "spike" && mode !== "adapter")
  fail("--mode must be 'default', 'spike' or 'adapter'");
if (values.package === undefined)
  fail("--package <directory containing the unpacked app> is required");

try {
  const policy = decodePolicy(JSON.parse(readFileSync(resolve(values.policy as string), "utf8")));
  const report = evaluatePackage(
    snapshotPackage(resolve(values.package)),
    policy,
    mode as PackageMode,
  );
  process.stdout.write(formatReport(report));
  if (values.json !== undefined)
    writeFileSync(resolve(values.json), `${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.passed ? 0 : 1);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
