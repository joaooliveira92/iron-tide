import { CampaignCompiler, type CampaignCompilerOutput } from "@bluewave/campaign/compiler";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { readContentArtifact, type LoadedContentArtifact } from "./contentArtifact.js";

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
      contentHash: loaded.manifest.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
      campaignStart,
    },
    signal,
    collector,
  );
}
