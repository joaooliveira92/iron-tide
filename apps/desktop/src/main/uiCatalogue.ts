import type { UiCatalogueDto } from "../shared/content-contract.js";
import { ContentArtifactError, readContentArtifact } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";

/**
 * The narrow UI-string capability: main decodes the catalogue from the verified
 * artifact and ships the data-only DTO over IPC. Like the presentation-content
 * path it exposes no file path, no generic file read, and no YAML parsing — only
 * already-decoded strings (ADR-0209).
 */
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
