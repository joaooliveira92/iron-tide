// The compiled-content boundary as a service (INC-1/INC-2; ADR-0159). Wraps the
// raw synchronous content reads and the campaign compiler in `Effect` methods, so
// command programs resolve content through the Layer rather than constructing it
// inline. Raw `node:*` stays inside the service; no platform services are adopted.
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { ShipBuildingContent, ShipBuildingData } from "@bluewave/ship-design";
import { Context, Effect, Layer } from "effect";
import type {
  DrawingBoardContentDto,
  PresentationContentDto,
  UiCatalogueDto,
} from "../../shared/content-contract.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { ContentArtifactError } from "../contentArtifact.js";
import { resolveGeneratedContentDir } from "../contentPack.js";
import { loadPresentationContent } from "../presentationContent.js";
import { loadUiCatalogue } from "../uiCatalogue.js";
import {
  armamentContentHash,
  loadShipBuildingContent,
  loadShipBuildingData,
  shipBuildingContentHash,
} from "../shipBuildingContent.js";
import { CommandFailed } from "./commandError.js";

export type CompiledCampaign = NonNullable<
  ReturnType<typeof compileProductionCampaignFromArtifact>
>;

/** Maps a thrown content-boundary error to a `CommandFailed`, preserving its code. */
function contentUnavailable(error: unknown): CommandFailed {
  if (ContentArtifactError.is(error)) {
    return new CommandFailed({ reason: error.code, diagnostics: [error.message] });
  }
  return new CommandFailed({
    reason: "CONTENT_UNAVAILABLE",
    diagnostics: [error instanceof Error ? error.message : String(error)],
  });
}

export class ContentArtifact extends Context.Service<
  ContentArtifact,
  {
    /**
     * Compiles the production campaign, failing with `COMPILE_FAILED`
     * diagnostics. `campaignStart` stamps the snapshot's authoritative
     * start calendar (B-6/ADR-0025); omitted, the compiler's canonical default
     * applies.
     */
    readonly compileProductionCampaign: (campaignStart?: {
      readonly startYear: number;
      readonly startMonth: number;
    }) => Effect.Effect<CompiledCampaign, CommandFailed>;
    /** Decodes the ship-building catalogue the drawing board reads (fail-closed). */
    readonly loadDrawingBoardCatalogue: () => Effect.Effect<
      DrawingBoardContentDto["catalogue"],
      CommandFailed
    >;
    /** Builds the runtime ship-building content every month executes on (fail-closed). */
    readonly loadShipBuildingContent: () => Effect.Effect<ShipBuildingContent, CommandFailed>;
    /** Decodes the ship-building catalogue data a month input is built from (fail-closed). */
    readonly loadShipBuildingData: () => Effect.Effect<ShipBuildingData, CommandFailed>;
    /** The artifact-derived ship-building content identity a month records (fail-closed). */
    readonly shipBuildingContentHash: () => Effect.Effect<string, CommandFailed>;
    /** The artifact-derived armament content identity a month records (fail-closed). */
    readonly armamentContentHash: () => Effect.Effect<string, CommandFailed>;
    /** Decodes the presentation corpus (fail-closed). */
    readonly loadPresentationContent: () => Effect.Effect<PresentationContentDto, CommandFailed>;
    /** Decodes the UI-string catalogue (fail-closed). */
    readonly loadUiCatalogue: () => Effect.Effect<UiCatalogueDto, CommandFailed>;
  }
>()("bluewave/desktop/ContentArtifact") {}

/** The desktop main content-artifact layer; `artifactDir` defaults to the generated pack. */
export function contentArtifactLayer(
  artifactDir: string = resolveGeneratedContentDir(),
): Layer.Layer<ContentArtifact> {
  return Layer.succeed(ContentArtifact, {
    compileProductionCampaign: (campaignStart) =>
      Effect.gen(function* () {
        const collector = new DiagnosticCollector();
        const signal = new AbortController().signal;
        const output = yield* Effect.try({
          try: () =>
            compileProductionCampaignFromArtifact(artifactDir, signal, collector, campaignStart),
          catch: (error) =>
            new CommandFailed({
              reason: "COMPILE_FAILED",
              diagnostics: [error instanceof Error ? error.message : String(error)],
            }),
        });
        if (!output || collector.hasErrors) {
          return yield* new CommandFailed({
            reason: "COMPILE_FAILED",
            diagnostics: collector.all.map((diagnostic) => diagnostic.message),
          });
        }
        return output;
      }),
    loadDrawingBoardCatalogue: () =>
      Effect.try({ try: () => loadShipBuildingData(), catch: contentUnavailable }),
    loadShipBuildingContent: () =>
      Effect.try({ try: () => loadShipBuildingContent(), catch: contentUnavailable }),
    loadShipBuildingData: () =>
      Effect.try({ try: () => loadShipBuildingData(), catch: contentUnavailable }),
    shipBuildingContentHash: () =>
      Effect.try({ try: () => shipBuildingContentHash(), catch: contentUnavailable }),
    armamentContentHash: () =>
      Effect.try({ try: () => armamentContentHash(), catch: contentUnavailable }),
    loadPresentationContent: () =>
      Effect.try({ try: () => loadPresentationContent(), catch: contentUnavailable }),
    loadUiCatalogue: () => Effect.try({ try: () => loadUiCatalogue(), catch: contentUnavailable }),
  });
}
