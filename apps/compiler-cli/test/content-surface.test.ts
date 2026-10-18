import { describe, it, expect, afterEach, vi } from "vite-plus/test";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { runContentCheck, runContentBuild, runContentVerify } from "../src/commands.js";
import { runCli } from "./runCli.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const contentDir = resolve(repoRoot, "content", "production", "1880");
const manifest = resolve(contentDir, "pack.json");

const tempDirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(resolve(tmpdir(), "bw-content-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("content:check / content:build over the production pack", () => {
  it("content:check validates the whole surface and writes nothing", async () => {
    const out = tempDir();
    expect(
      await runCli(runContentCheck({ manifest, contentDir, outputDir: out, outputMode: "json" })),
    ).toBe("success");
    expect(readdirSync(out)).toHaveLength(0);
  });

  it("content:check reports per-collection confidence counts (CAH-PROV-2)", async () => {
    const out = tempDir();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      expect(
        await runCli(runContentCheck({ manifest, contentDir, outputDir: out, outputMode: "json" })),
      ).toBe("success");
      const printed = write.mock.calls.map((call) => String(call[0])).join("");
      const payload = JSON.parse(printed.trim().split("\n").pop() ?? "{}") as {
        confidence: Array<{ collection: string; counts: Record<string, number> }>;
        confidenceTotal: Record<string, number>;
      };
      const gunFamilies = payload.confidence.find(
        (entry) => entry.collection === "shipBuilding.armament.gunFamilies",
      );
      expect(gunFamilies?.counts["MEDIUM"]).toBeGreaterThan(0);
      expect(payload.confidenceTotal["total"]).toBeGreaterThan(0);
    } finally {
      write.mockRestore();
    }
  });

  it("content:build emits one hash-pinned artifact covering both surfaces", async () => {
    const out = tempDir();
    expect(
      await runCli(runContentBuild({ manifest, contentDir, outputDir: out, outputMode: "human" })),
    ).toBe("success");

    const artifactPath = resolve(out, "content-artifact.json");
    const manifestPath = resolve(out, "content-manifest.json");
    expect(existsSync(artifactPath)).toBe(true);
    expect(existsSync(manifestPath)).toBe(true);

    const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as Record<string, unknown>;
    expect(Array.isArray(artifact["nations"])).toBe(true);
    expect(Array.isArray(artifact["technologies"])).toBe(true);
    expect(typeof artifact["generatedBy"]).toBe("string");

    const shipBuilding = artifact["shipBuilding"] as Record<string, unknown>;
    expect(shipBuilding).toBeDefined();
    for (const key of ["components", "plants", "hullForms", "navalProfiles", "referenceDesigns"]) {
      expect(Array.isArray(shipBuilding[key])).toBe(true);
      expect((shipBuilding[key] as unknown[]).length).toBeGreaterThan(0);
    }
    const armament = shipBuilding["armament"] as Record<string, unknown>;
    for (const key of ["gunFamilies", "gunModels", "gunMounts", "ammunition"]) {
      expect((armament[key] as unknown[]).length).toBeGreaterThan(0);
    }

    const campaign = artifact["campaign"] as Record<string, unknown>;
    expect(campaign).toBeDefined();
    for (const key of ["fleets", "economies", "constructions", "research", "designs"]) {
      expect(Array.isArray(campaign[key])).toBe(true);
      expect((campaign[key] as unknown[]).length).toBeGreaterThan(0);
    }

    const manifestJson = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    expect(manifestJson["contentVersion"]).toBe("0.5.0");
    expect(typeof manifestJson["doNotEdit"]).toBe("string");
    expect(typeof manifestJson["bodyHash"]).toBe("string");
  });

  it("two builds over unchanged content are byte-identical", async () => {
    const out1 = tempDir();
    const out2 = tempDir();
    await runCli(runContentBuild({ manifest, contentDir, outputDir: out1, outputMode: "json" }));
    await runCli(runContentBuild({ manifest, contentDir, outputDir: out2, outputMode: "json" }));
    expect(readFileSync(resolve(out1, "content-artifact.json"), "utf8")).toBe(
      readFileSync(resolve(out2, "content-artifact.json"), "utf8"),
    );
    expect(readFileSync(resolve(out1, "content-manifest.json"), "utf8")).toBe(
      readFileSync(resolve(out2, "content-manifest.json"), "utf8"),
    );
  });

  it("content:check and content:build reject a broken pack the same way", async () => {
    const broken = tempDir();
    cpSync(contentDir, broken, { recursive: true });
    const brokenManifest = resolve(broken, "pack.json");
    const referenceDir = resolve(broken, "ship-building", "reference-designs", "uk");
    writeFileSync(
      resolve(referenceDir, "starters.yaml"),
      `
designs:
  - id: "rd_broken"
    name: "Broken"
    month: "1880-01"
    draft:
      hull: { hullFormId: "does_not_exist" }
      machinery: { plantId: "does_not_exist" }
`,
      "utf8",
    );
    const checkOut = tempDir();
    expect(
      await runCli(
        runContentCheck({
          manifest: brokenManifest,
          contentDir: broken,
          outputDir: checkOut,
          outputMode: "json",
        }),
      ),
    ).toBe("validation-error");
    expect(
      await runCli(
        runContentBuild({
          manifest: brokenManifest,
          contentDir: broken,
          outputDir: tempDir(),
          outputMode: "json",
        }),
      ),
    ).toBe("validation-error");
  });
});

describe("production roster is the manual's nine playable nations plus the promoted USA (DR-014 / ADR-0214)", () => {
  it("marks exactly ten nations playable, with the USA promoted", async () => {
    const out = tempDir();
    expect(
      await runCli(runContentBuild({ manifest, contentDir, outputDir: out, outputMode: "json" })),
    ).toBe("success");

    const artifact = JSON.parse(readFileSync(resolve(out, "content-artifact.json"), "utf8")) as {
      nations: Array<{ id: string; isPlayable?: boolean }>;
    };
    const playable = artifact.nations
      .filter((nation) => nation.isPlayable === true)
      .map((nation) => nation.id)
      .sort();

    // Manual p.18 gives the base nine (Great Britain, Germany, France,
    // Austria-Hungary, Russia, Italy, Japan, China, Spain) plus the USA, which
    // DR-014 / ADR-0214 promotes from AI-only to playable.
    expect(playable).toEqual([
      "austria_hungary",
      "france",
      "germany",
      "italy",
      "japan",
      "qing",
      "russia",
      "spain",
      "uk",
      "usa",
    ]);
    expect(playable).toContain("usa");
  });
});

describe("content:verify over the production pack (CAH-LOCK)", () => {
  it("verifies the production pack against the committed content lock", async () => {
    expect(
      await runCli(
        runContentVerify({ manifest, contentDir, outputDir: tempDir(), outputMode: "json" }),
      ),
    ).toBe("success");
  });

  it("fails on content drift naming both hashes, and succeeds once the lock is refreshed", async () => {
    const dir = tempDir();
    cpSync(contentDir, dir, { recursive: true });
    const localManifest = resolve(dir, "pack.json");

    const lockPath = resolve(dir, "content-lock.json");
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as { bodyHash: string };

    // Drift an authored collection without touching the lock.
    const areasPath = resolve(dir, "areas.yaml");
    writeFileSync(
      areasPath,
      `${readFileSync(areasPath, "utf8")}\n- id: "cah_drift_area"\n  name: "Drift Area"\n  type: "land"\n`,
      "utf8",
    );
    // Keep the drift valid under the presentation-coverage invariant (CAH-PRES-2).
    const presentationPath = resolve(dir, "presentation.yaml");
    writeFileSync(
      presentationPath,
      readFileSync(presentationPath, "utf8")
        .replaceAll("\r\n", "\n")
        .replace("  areaRegion:\n", "  areaRegion:\n    cah_drift_area: northern_europe\n")
        .replace(
          "  campaignAreaToFixture:\n",
          "  campaignAreaToFixture:\n    cah_drift_area: area_north_sea\n",
        ),
      "utf8",
    );
    expect(
      await runCli(
        runContentVerify({
          manifest: localManifest,
          contentDir: dir,
          outputDir: tempDir(),
          outputMode: "json",
        }),
      ),
    ).toBe("validation-error");

    // Refresh the lock to the rebuilt hash: verification succeeds.
    const fresh = tempDir();
    await runCli(
      runContentBuild({
        manifest: localManifest,
        contentDir: dir,
        outputDir: fresh,
        outputMode: "json",
      }),
    );
    const manifestJson = JSON.parse(
      readFileSync(resolve(fresh, "content-manifest.json"), "utf8"),
    ) as { bodyHash: string };
    writeFileSync(
      lockPath,
      JSON.stringify({ ...lock, bodyHash: manifestJson.bodyHash }, null, 2),
      "utf8",
    );
    expect(
      await runCli(
        runContentVerify({
          manifest: localManifest,
          contentDir: dir,
          outputDir: tempDir(),
          outputMode: "json",
        }),
      ),
    ).toBe("success");
  });

  it("fails on a tampered lock naming both hashes", async () => {
    const dir = tempDir();
    cpSync(contentDir, dir, { recursive: true });
    const lockPath = resolve(dir, "content-lock.json");
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as Record<string, unknown>;
    writeFileSync(lockPath, JSON.stringify({ ...lock, bodyHash: "0".repeat(64) }, null, 2), "utf8");
    expect(
      await runCli(
        runContentVerify({
          manifest: resolve(dir, "pack.json"),
          contentDir: dir,
          outputDir: tempDir(),
          outputMode: "json",
        }),
      ),
    ).toBe("validation-error");
  });
});
