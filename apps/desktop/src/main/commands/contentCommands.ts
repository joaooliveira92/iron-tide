import { Effect } from "effect";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  DrawingBoardContentDto,
  PresentationContentDto,
} from "../../shared/content-contract.js";
import type { CommandError } from "../runtime/commandError.js";
import { ContentArtifact } from "../runtime/contentArtifact.js";

/**
 * The narrow content-query capability the drawing board uses, as an Effect
 * program (INC-2; ADR-0159): main decodes the ship-building catalogue from the
 * verified artifact through the `ContentArtifact` service and ships the
 * data-only DTO over IPC. It exposes no file path, no generic file read, and no
 * YAML parsing — only already-decoded game content (ADR-0008/0105, `MIG-EXCL-1`).
 */
export const inspectDrawingBoardContentProgram: Effect.Effect<
  BridgeResult<DrawingBoardContentDto>,
  CommandError,
  ContentArtifact
> = Effect.gen(function* () {
  const contentArtifact = yield* ContentArtifact;
  const catalogue = yield* contentArtifact.loadDrawingBoardCatalogue();
  return { outcome: "success", value: { catalogue }, diagnostics: [] };
});

/**
 * Serves the decoded presentation corpus over the narrow content-query IPC
 * (INC-2; CAH-PRES-3). Same fail-closed behaviour as the drawing-board path.
 */
export const inspectPresentationContentProgram: Effect.Effect<
  BridgeResult<PresentationContentDto>,
  CommandError,
  ContentArtifact
> = Effect.gen(function* () {
  const contentArtifact = yield* ContentArtifact;
  const value = yield* contentArtifact.loadPresentationContent();
  return { outcome: "success", value, diagnostics: [] };
});
