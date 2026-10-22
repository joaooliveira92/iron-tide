import type { UiCatalogueDto } from "../shared/content-contract.js";
import { ContentArtifactError, readContentArtifact } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";

export function loadUiCatalogue(): UiCatalogueDto {
  const { bundle } = readContentArtifact(resolveGeneratedContentDir());
  const ui = bundle.ui;
  if (ui === undefined) {
    throw new ContentArtifactError(
      "CONTENT_ARTIFACT_INVALID",
      "The compiled content artifact carries no UI-string catalogue.",
    );
  }
  return ui;
}
