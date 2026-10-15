import { CampaignCompiler, type CampaignCompilerOutput } from "@bluewave/campaign/compiler";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { readContentArtifact, type LoadedContentArtifact } from "./contentArtifact.js";

/**
 * Compiles the production campaign from the verified compiled content artifact
 * (ticket 07, CRI-MAIN-2): the content-pack collections and the campaign-file
 * collections come from the bundle exactly as CI validated them — no campaign
 * YAML is read or parsed at runtime. A missing, tampered, or version-mismatched
 * artifact fails closed with a stable diagnostic (never a silent fallback).
 *
 * CAH-LEG-1: this is the only campaign-compile entry point in the main process.
 * The legacy raw-input helper (`runCompilation`/`compileProductionCampaign`) was
 * deleted once every caller migrated to the artifact path; the campaign compiler
 * itself no longer carries a raw-input branch.
 */
export function compileProductionCampaignFromArtifact(
  artifactDir: string,
  signal: AbortSignal,
  collector: DiagnosticCollector,
  campaignStart?: { startYear: number; startMonth: number },
): CampaignCompilerOutput | undefined {
  let loaded: LoadedContentArtifact;
  try {
    loaded = readContentArtifact(artifactDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    collector.addError("CONTENT_ARTIFACT_INVALID", message, { stage: "campaign-compile" });
    return undefined;
  }

  if (signal.aborted) {
    collector.addInfo("ABORT", "Compilation aborted before content compilation");
    return undefined;
  }

  if (loaded.bundle.campaign === undefined) {
    collector.addError(
      "CONTENT_ARTIFACT_INVALID",
      "The compiled content artifact carries no campaign-file collections; rebuild it with `pnpm content:build`.",
      { stage: "campaign-compile" },
    );
    return undefined;
  }

  return new CampaignCompiler().compile(
    {
      contentBundle: loaded.bundle,
      // Artifact-derived identity (ADR-0123): the manifest's SHA-256 body hash.
      contentHash: loaded.manifest.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
      campaignStart,
    },
    signal,
    collector,
  );
}
