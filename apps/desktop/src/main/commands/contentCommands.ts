import { Effect } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  DrawingBoardContentDto,
  PresentationContentDto,
  UiCatalogueDto,
} from "../../shared/content-contract.js";
import type { CommandError } from "../runtime/commandError.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";

export const inspectDrawingBoardContentProgram: Effect.Effect<
  BridgeResult<DrawingBoardContentDto>,
  CommandError,
  ContentArtifact
> = Effect.gen(function* () {
  const contentArtifact = yield* ContentArtifact;
  const catalogue = yield* contentArtifact.loadDrawingBoardCatalogue();
  return { outcome: "success", value: { catalogue }, diagnostics: [] };
});

export const inspectPresentationContentProgram: Effect.Effect<
  BridgeResult<PresentationContentDto>,
  CommandError,
  ContentArtifact
> = Effect.gen(function* () {
  const contentArtifact = yield* ContentArtifact;
  const value = yield* contentArtifact.loadPresentationContent();
  return { outcome: "success", value, diagnostics: [] };
});

export const inspectUiCatalogueProgram: Effect.Effect<
  BridgeResult<UiCatalogueDto>,
  CommandError,
  ContentArtifact
> = Effect.gen(function* () {
  const contentArtifact = yield* ContentArtifact;
  const value = yield* contentArtifact.loadUiCatalogue();
  return { outcome: "success", value, diagnostics: [] };
});
