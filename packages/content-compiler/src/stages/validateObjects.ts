import {
  PresentationContentSchema,
  UiCatalogueSchema,
  validateAgainstSchema,
} from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

import type { ParseOutput } from "./parse.js";

export function validatePresentation(input: ParseOutput, collector: DiagnosticCollector): unknown {
  const raw = input.objectDocs.get("presentation");
  if (raw === undefined) return undefined;
  const sourcePath = input.objectSourcePaths.get("presentation") ?? "presentation.ts";
  return validateAgainstSchema(
    raw,
    PresentationContentSchema,
    "PresentationContent",
    sourcePath,
    collector,
  );
}

export function validateUi(input: ParseOutput, collector: DiagnosticCollector): unknown {
  const raw = input.objectDocs.get("ui");
  if (raw === undefined) return undefined;
  const sourcePath = input.objectSourcePaths.get("ui") ?? "ui/en-US.json";
  return validateAgainstSchema(raw, UiCatalogueSchema, "UiCatalogue", sourcePath, collector);
}
