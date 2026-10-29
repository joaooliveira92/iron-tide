import { describe, it, expect, afterEach, vi } from "vite-plus/test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { runContentGate } from "../src/commands.js";
import { runCli } from "./runCli.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const contentDir = resolve(repoRoot, "content", "production", "1880");
const manifest = resolve(contentDir, "pack.json");

const tempDirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(repoRoot, ".tmp", "bw-gate-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const PLACEHOLDER_AREA = `  {
    id: "cah_placeholder_area",
    name: "Placeholder Area",
    type: "land",
    provenance: {
      sourceStatus: "PLACEHOLDER",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [],
    },
  },
`;

function addPlaceholderArea(dir: string): void {
  const areasPath = resolve(dir, "areas.ts");
  const areas = readFileSync(areasPath, "utf8").replaceAll("\r\n", "\n");
  writeFileSync(areasPath, areas.replace(/\n\]\);\n$/u, `\n${PLACEHOLDER_AREA}]);\n`), "utf8");
  const presentationPath = resolve(dir, "presentation.ts");
  const patched = readFileSync(presentationPath, "utf8")
    .replaceAll("\r\n", "\n")
    .replace(
      "    areaRegion: {\n",
      '    areaRegion: {\n      cah_placeholder_area: "northern_europe",\n',
    )
    .replace(
      "    campaignAreaToFixture: {\n",
      '    campaignAreaToFixture: {\n      cah_placeholder_area: "area_north_sea",\n',
    );
  writeFileSync(presentationPath, patched, "utf8");
}

async function captureStdout<T>(fn: () => Promise<T>): Promise<{ result: T; printed: string }> {
  const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  try {
    const result = await fn();
    return { result, printed: write.mock.calls.map((call) => String(call[0])).join("") };
  } finally {
    write.mockRestore();
  }
}

describe("content:gate over the production pack (CAH-PROV-3)", () => {
  it("passes a shipping pack with no unresolved placeholders", async () => {
    const { result } = await captureStdout(() =>
      runCli(runContentGate({ manifest, contentDir, outputDir: tempDir(), outputMode: "json" })),
    );
    expect(result).toBe("success");
  });

  it("skips a non-production pack with a JSON payload", async () => {
    const dir = tempDir();
    writeFileSync(
      resolve(dir, "pack.json"),
      JSON.stringify({ name: "fixture", version: "0.1.0", type: "fixture", files: {} }),
      "utf8",
    );
    const { result, printed } = await captureStdout(() =>
      runCli(
        runContentGate({
          manifest: resolve(dir, "pack.json"),
          contentDir: dir,
          outputDir: tempDir(),
          outputMode: "json",
        }),
      ),
    );
    expect(result).toBe("success");
    expect(JSON.parse(printed.trim().split("\n").pop() ?? "{}")).toEqual({
      skipped: true,
      reason: "not a shipping (production) pack",
    });
  });

  it("fails a shipping pack containing a placeholder, naming collection/record/field", async () => {
    const dir = tempDir();
    cpSync(contentDir, dir, { recursive: true });
    addPlaceholderArea(dir);

    const { result, printed } = await captureStdout(() =>
      runCli(
        runContentGate({
          manifest: resolve(dir, "pack.json"),
          contentDir: dir,
          outputDir: tempDir(),
          outputMode: "json",
        }),
      ),
    );
    expect(result).toBe("validation-error");
    expect(printed).toContain("areas");
    expect(printed).toContain("cah_placeholder_area");
    expect(printed).toContain("provenance");
  });

  it("admits a placeholder on the justified allowlist", async () => {
    const dir = tempDir();
    cpSync(contentDir, dir, { recursive: true });
    addPlaceholderArea(dir);
    const allowlistPath = resolve(dir, "placeholder-allowlist.json");
    const existing = JSON.parse(readFileSync(allowlistPath, "utf8")) as { allow?: unknown[] };
    writeFileSync(
      allowlistPath,
      JSON.stringify({
        allow: [
          ...(existing.allow ?? []),
          {
            collection: "areas",
            recordId: "cah_placeholder_area",
            field: "provenance",
            justification: "area extent pending a survey",
          },
        ],
      }),
      "utf8",
    );

    const { result } = await captureStdout(() =>
      runCli(
        runContentGate({
          manifest: resolve(dir, "pack.json"),
          contentDir: dir,
          outputDir: tempDir(),
          outputMode: "json",
        }),
      ),
    );
    expect(result).toBe("success");
  });

  it("fails when an allowlist entry carries no justification", async () => {
    const dir = tempDir();
    cpSync(contentDir, dir, { recursive: true });
    addPlaceholderArea(dir);
    writeFileSync(
      resolve(dir, "placeholder-allowlist.json"),
      JSON.stringify({
        allow: [{ collection: "areas", recordId: "cah_placeholder_area", field: "provenance" }],
      }),
      "utf8",
    );

    const { result, printed } = await captureStdout(() =>
      runCli(
        runContentGate({
          manifest: resolve(dir, "pack.json"),
          contentDir: dir,
          outputDir: tempDir(),
          outputMode: "json",
        }),
      ),
    );
    expect(result).toBe("validation-error");
    expect(printed).toContain("justification");
  });
});
