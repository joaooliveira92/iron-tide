import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

export const PackManifestSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString,
  type: Schema.Literals(["production", "fixture", "mod"]),
  files: Schema.optional(Schema.Record(Schema.String, Schema.Array(Schema.String))),
  /**
   * Build-time declaration of the ship-building subtree (components, plants,
   * hull forms, balance, armament, naval profiles, reference designs). The
   * manifest is the single authority for what the compiler loads; these keys are
   * loading declarations, not part of the compiled artifact's content identity.
   */
  shipBuilding: Schema.optional(Schema.Record(Schema.String, Schema.Array(Schema.String))),
  dependencies: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

export const RulesetManifestSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString,
  // S-2: the prestige value set (bounds, sacking threshold and probability, per-source rules;
  // ADR-0239). Opaque here on purpose: the campaign compiler decodes it strictly (excess keys
  // rejected, no defaults) with `decodePrestigeValueSet` and names the offending field.
  prestige: Schema.optional(Schema.Unknown),
  // S-5: the optional presence value set (ADR-0242). Opaque here on purpose, like `prestige`: the compiler
  // decodes it strictly with `decodePresenceRules` and names the offending field. Absent = dormant.
  presence: Schema.optional(Schema.Unknown),
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
