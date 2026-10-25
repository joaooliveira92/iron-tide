import type { BattleOfferRules, FleetManagementRules } from "@bluewave/content-schema";
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
  loadBattleOfferRules,
  loadFleetManagementRules,
  loadShipBuildingContent,
  loadShipBuildingData,
  shipBuildingContentHash,
} from "../shipBuildingContent.js";
import { CommandFailed } from "./commandError.js";

export type CompiledCampaign = NonNullable<
  ReturnType<typeof compileProductionCampaignFromArtifact>
>;

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
    readonly compileProductionCampaign: (campaignStart?: {
      readonly startYear: number;
      readonly startMonth: number;
    }) => Effect.Effect<CompiledCampaign, CommandFailed>;
    readonly loadDrawingBoardCatalogue: () => Effect.Effect<
      DrawingBoardContentDto["catalogue"],
      CommandFailed
    >;
    readonly loadShipBuildingContent: () => Effect.Effect<ShipBuildingContent, CommandFailed>;
    readonly loadBattleOfferRules: () => Effect.Effect<BattleOfferRules | undefined, CommandFailed>;
    readonly loadFleetManagementRules: () => Effect.Effect<
      FleetManagementRules | undefined,
      CommandFailed
    >;
    readonly loadShipBuildingData: () => Effect.Effect<ShipBuildingData, CommandFailed>;
    readonly shipBuildingContentHash: () => Effect.Effect<string, CommandFailed>;
    readonly armamentContentHash: () => Effect.Effect<string, CommandFailed>;
    readonly loadPresentationContent: () => Effect.Effect<PresentationContentDto, CommandFailed>;
    readonly loadUiCatalogue: () => Effect.Effect<UiCatalogueDto, CommandFailed>;
  }
>()("bluewave/desktop/ContentArtifact") {}

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
    loadBattleOfferRules: () =>
      Effect.try({ try: () => loadBattleOfferRules(), catch: contentUnavailable }),
    loadFleetManagementRules: () =>
      Effect.try({ try: () => loadFleetManagementRules(), catch: contentUnavailable }),
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
