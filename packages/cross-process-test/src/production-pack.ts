import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CampaignState } from "@bluewave/campaign";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import {
  buildContentBundleArtifact,
  buildFullSurfaceInput,
  type ContentBundleArtifact,
} from "@bluewave/content-compiler";
import {
  ContentBundleSchema,
  validateAgainstSchema,
  type CompiledContentBundle,
} from "@bluewave/content-schema";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";

import type { ProbeReferenceDesign } from "./decision-probes.js";

/** The committed 1880 production pack every N-3 acceptance seam compiles. */
export const PRODUCTION_PACK_DIR = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
  "..",
  "content",
  "production",
  "1880",
);

function buildProductionArtifact(): ContentBundleArtifact {
  const collector = new DiagnosticCollector();
  const input = buildFullSurfaceInput(
    resolve(PRODUCTION_PACK_DIR, "pack.json"),
    PRODUCTION_PACK_DIR,
    collector,
  );
  const artifact = input
    ? buildContentBundleArtifact(input, new AbortController().signal, collector)
    : undefined;
  if (!artifact || collector.hasErrors) {
    throw new Error(
      `Production pack compilation failed: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  return artifact;
}

function decodeBundle(artifact: ContentBundleArtifact): CompiledContentBundle {
  const collector = new DiagnosticCollector();
  const bundle = validateAgainstSchema(
    artifact.bundle,
    ContentBundleSchema,
    "ContentBundle",
    "content-artifact.json",
    collector,
  );
  if (bundle === undefined) {
    throw new Error(
      `Production pack bundle is invalid: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  return bundle;
}

export function compileProductionBundle(): {
  readonly bundle: CompiledContentBundle;
  readonly contentHash: string;
} {
  const artifact = buildProductionArtifact();
  return { bundle: decodeBundle(artifact), contentHash: artifact.envelope.bodyHash };
}

export function compileProductionCampaign(): {
  readonly state: CampaignState;
  readonly contentHash: string;
  readonly bundle: CompiledContentBundle;
} {
  const artifact = buildProductionArtifact();
  const bundle = decodeBundle(artifact);
  const collector = new DiagnosticCollector();
  const output = new CampaignCompiler().compile(
    {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    },
    new AbortController().signal,
    collector,
  );
  if (!output || collector.hasErrors) {
    throw new Error(
      `Production pack compilation failed: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  return { state: output.state, contentHash: output.contentHash, bundle };
}

/** The compiled reference designs projected to the decision probe's minimal shape. */
export function probeReferenceDesigns(
  bundle: CompiledContentBundle,
): readonly ProbeReferenceDesign[] {
  return (bundle.shipBuilding?.referenceDesigns ?? []).map((reference) => ({
    id: reference.id,
    month: reference.month,
    draft: { ...reference.draft },
  }));
}
