import { CampaignCompiler } from "@bluewave/campaign/compiler";
import type { CampaignState } from "@bluewave/campaign";
import { buildContentBundleArtifact, buildFullSurfaceInput } from "@bluewave/content-compiler";
import { DiagnosticCollector, type Diagnostic } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";
import { resolve } from "node:path";
import { PRODUCTION_PACK_DIR } from "../src/production-pack.js";

export function compileProductionCampaign(): {
  state: CampaignState;
  diagnostics: readonly Diagnostic[];
} {
  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const input = buildFullSurfaceInput(
    resolve(PRODUCTION_PACK_DIR, "pack.json"),
    PRODUCTION_PACK_DIR,
    collector,
  );
  const artifact = input ? buildContentBundleArtifact(input, signal, collector) : undefined;
  if (!artifact) throw new Error("production pack failed to build");
  const output = new CampaignCompiler().compile(
    {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    },
    signal,
    collector,
  );
  if (!output) throw new Error("campaign compile failed");
  return { state: output.state, diagnostics: collector.all };
}
