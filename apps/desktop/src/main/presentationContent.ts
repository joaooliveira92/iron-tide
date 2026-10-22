import type { PresentationContentDto } from "../shared/content-contract.js";
import { ContentArtifactError, readContentArtifact } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";

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
