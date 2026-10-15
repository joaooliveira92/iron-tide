import { describe, it, expect } from "vite-plus/test";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { compileProductionCampaignFromArtifact } from "../src/main/compiler.js";
import { resolveGeneratedContentDir } from "../src/main/contentPack.js";

describe("production pack (content/generated/1880 artifact)", () => {
  it("compiles deterministically through the desktop artifact path with zero diagnostics", () => {
    const signal = new AbortController().signal;
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      resolveGeneratedContentDir(),
      signal,
      collector,
    );

    expect(collector.hasErrors).toBe(false);
    expect(output).toBeDefined();
    expect(output!.state.rawHash).toBeDefined();
    expect(output!.contentHash).toBeDefined();

    const nations = output!.state.snapshot.nations;
    expect(nations.size).toBe(14);
    expect(nations.has("uk")).toBe(true);
    expect(nations.has("france")).toBe(true);
    expect(nations.has("qing")).toBe(true);

    // Determinism: a second compile produces an identical snapshot hash.
    const secondCollector = new DiagnosticCollector();
    const second = compileProductionCampaignFromArtifact(
      resolveGeneratedContentDir(),
      signal,
      secondCollector,
    );
    expect(second!.state.rawHash).toBe(output!.state.rawHash);
    expect(second!.contentHash).toBe(output!.contentHash);
  });

  it("aborts before compiling when the signal is already aborted", () => {
    const controller = new AbortController();
    controller.abort();
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      resolveGeneratedContentDir(),
      controller.signal,
      collector,
    );
    expect(output).toBeUndefined();
  });

  it("fails closed with a stable code when the artifact directory is missing", () => {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      "/nonexistent/content/artifact",
      new AbortController().signal,
      collector,
    );
    expect(output).toBeUndefined();
    expect(collector.all.some((d) => d.code === "CONTENT_ARTIFACT_INVALID")).toBe(true);
  });
});
