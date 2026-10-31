import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

export const PackManifestSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString,
  type: Schema.Literals(["production", "fixture", "mod"]),
  files: Schema.optional(Schema.Record(Schema.String, Schema.Array(Schema.String))),
  shipBuilding: Schema.optional(Schema.Record(Schema.String, Schema.Array(Schema.String))),
  dependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

export const RulesetManifestSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString,
  prestige: Schema.optional(Schema.Unknown),
  presence: Schema.optional(Schema.Unknown),
  battleOffers: Schema.optional(Schema.Unknown),
  fleetManagement: Schema.optional(Schema.Unknown),
  gunnery: Schema.optional(Schema.Unknown),
  missiles: Schema.optional(Schema.Unknown),
  tensionDrift: Schema.optional(Schema.Unknown),
  eventResolution: Schema.optional(Schema.Unknown),
  provenance: Schema.optional(ProvenanceSchema),
});

export interface ContentPack {
  manifest: PackManifest;
  rulesets: RulesetManifest[];
  nations: Nation[];
  areas: Area[];
  routes: RouteEdge[];
  possessions: Possession[];
  ports: Port[];
  technologies: TechnologyPrerequisite[];
}

export type PackManifest = typeof PackManifestSchema.Type;
export type RulesetManifest = typeof RulesetManifestSchema.Type;

import type { Nation } from "./nation.js";
import type { Area } from "./area.js";
import type { RouteEdge } from "./route.js";
import type { Possession } from "./possession.js";
import type { Port } from "./port.js";
import type { TechnologyPrerequisite } from "./technology.js";
