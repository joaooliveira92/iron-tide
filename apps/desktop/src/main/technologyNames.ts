import { TechnologyPrerequisiteChainSchema } from "@bluewave/content-schema";
import { Schema } from "effect";
import { loadContentArtifact } from "./contentArtifact.js";

const decodeTechnologies = Schema.decodeUnknownSync(
  Schema.Array(TechnologyPrerequisiteChainSchema),
  { onExcessProperty: "error" },
);

let cached: ReadonlyMap<string, string> | null = null;

export function technologyNames(): ReadonlyMap<string, string> {
  if (cached !== null) return cached;
  const { bundle } = loadContentArtifact();
  cached = new Map(decodeTechnologies(bundle.technologies).map((t) => [t.id, t.name] as const));
  return cached;
}
