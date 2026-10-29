import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { buildContentBundleArtifact, buildFullSurfaceInput } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";

const PACK = JSON.stringify({
  name: "locale-fixture",
  version: "0.1.0",
  type: "fixture",
  files: { areas: ["areas.json"] },
});

const AREAS = `
[
  {
    "id": "Z",
    "name": "Zeta",
    "type": "land"
  },
  {
    "id": "a",
    "name": "alpha",
    "type": "land"
  },
  {
    "id": "I",
    "name": "Iota",
    "type": "land"
  },
  {
    "id": "i",
    "name": "iota",
    "type": "land"
  }
]
`;

function run(): void {
  const dir = resolve(tmpdir(), `bw-locale-${String(process.pid)}-${String(Date.now())}`);
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(resolve(dir, "pack.json"), PACK, "utf8");
    writeFileSync(resolve(dir, "areas.json"), AREAS, "utf8");
    const collector = new DiagnosticCollector();
    const surfaceInput = buildFullSurfaceInput(resolve(dir, "pack.json"), dir);
    if (!surfaceInput) throw new Error("content surface input failed");
    const artifact = buildContentBundleArtifact(
      surfaceInput,
      new AbortController().signal,
      collector,
    );
    if (!artifact || collector.hasErrors) {
      throw new Error("content bundle build failed");
    }
    process.stdout.write(JSON.stringify({ contentBundleHash: artifact.envelope.bodyHash }) + "\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

run();
