import type { PresentationContentDto } from "../shared/content-contract.js";
import { ContentArtifactError, readContentArtifact } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";

/**
 * The narrow presentation-content capability: main decodes the presentation
 * corpus from the verified artifact and ships the data-only DTO over IPC. Like
 * the drawing-board content path it exposes no file path, no generic file read,
 * and no YAML parsing — only already-decoded presentation content
 * (CAH-PRES-3, ADR-0125).
 */
export function loadPresentationContent(): PresentationContentDto {
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const presentation = bundle.presentation;
  if (presentation === undefined) {
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      "The compiled content artifact carries no presentation corpus.",
    );
  }
  return presentation;
}
