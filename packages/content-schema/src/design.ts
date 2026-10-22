import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

export const MainGunsSchema = Schema.Struct({
  caliber: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  count: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  mounts: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
});

export const TORPEDO_MOUNT_TYPE_VALUES = [
  "ABOVE_WATER_FIXED",
  "ABOVE_WATER_TRAINABLE",
  "UNDERWATER_FIXED",
  "UNDERWATER_TRAINABLE",
  "SUBMARINE_INTERNAL",
] as const;

export const TorpedoMountSchema = Schema.Struct({
  mountType: Schema.Literals(TORPEDO_MOUNT_TYPE_VALUES),
  tubeCount: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  torpedoModelId: Schema.NonEmptyString,
});

export const DesignTemplateSchema = Schema.Struct({
  designId: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  className: Schema.NonEmptyString,
  hullType: Schema.NonEmptyString,
  displacementKg: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0)),
  speedUms: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(1)),
  armorBeltUm: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(1)),
  mainGuns: MainGunsSchema,
  machineryType: Schema.NonEmptyString,
  hitPoints: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0)),
  crewComplement: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0)),
  torpedoArmament: Schema.optional(Schema.Array(TorpedoMountSchema).check(Schema.isMinLength(1))),
  designFamilyId: Schema.optional(Schema.NonEmptyString),
  contentVersion: Schema.optional(Schema.NonEmptyString),
  provenance: Schema.optional(ProvenanceSchema),
});

export type DesignTemplate = typeof DesignTemplateSchema.Type;
