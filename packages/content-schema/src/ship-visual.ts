import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

const positive = Schema.Finite.check(Schema.isGreaterThan(0));

const PathDataSchema = Schema.String.check(
  Schema.isPattern(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/),
).annotate({ description: "SVG path data in metres at the 12-inch reference" });

export const SHIP_VISUAL_STYLES = ["A", "B", "F", "G", "I", "J", "Q", "R", "S", "U", "X"] as const;
export const SHIP_VISUAL_ERAS = [
  "VICTORIAN",
  "PRE_DREADNOUGHT",
  "DREADNOUGHT",
  "LATE_DREADNOUGHT",
] as const;
export const SHIP_VISUAL_SIZES = ["SMALL", "MEDIUM", "LARGE"] as const;
export const SHIP_VISUAL_MOUNT_CLASSES = [
  "TURRET",
  "BARBETTE",
  "SHIELDED",
  "OPEN",
  "CASEMATE",
] as const;
export const SHIP_VISUAL_TONES = ["structure", "gun", "void"] as const;
export const SHIP_VISUAL_PLAN_BODIES = ["ROUND", "RING", "SHIELD", "PEDESTAL", "CASEMATE"] as const;

const ShapeSchema = Schema.Struct({
  tone: Schema.Literals(SHIP_VISUAL_TONES),
  d: PathDataSchema,
});

const ShapesSchema = Schema.Array(ShapeSchema).check(Schema.isMinLength(1));

export const ShipVisualMountSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  key: Schema.Struct({
    style: Schema.Literals(SHIP_VISUAL_STYLES),
    era: Schema.Literals(SHIP_VISUAL_ERAS),
    sizes: Schema.Array(Schema.Literals(SHIP_VISUAL_SIZES)).check(Schema.isMinLength(1)),
    mountClass: Schema.Literals(SHIP_VISUAL_MOUNT_CLASSES),
    guns: Schema.optional(Schema.Literals([1, 2, 3, 4])),
  }),
  profile: Schema.Struct({
    widthM: positive,
    shapes: ShapesSchema,
    barrel: Schema.Struct({
      x: Schema.Finite,
      y: Schema.Finite,
      lengthM: positive,
      boreM: positive,
    }),
  }),
  plan: Schema.Struct({
    body: Schema.Literals(SHIP_VISUAL_PLAN_BODIES),
    diameterM: positive,
    barrel: Schema.Struct({ lengthM: positive, boreM: positive, spacingM: positive }),
  }),
  provenance: ProvenanceSchema,
}).annotate({ description: "One gun-mount drawing and the key that selects it" });

export const ShipVisualMastSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  key: Schema.Struct({
    style: Schema.Literals(SHIP_VISUAL_STYLES),
    era: Schema.Literals(SHIP_VISUAL_ERAS),
  }),
  profile: Schema.Struct({ heightM: positive, shapes: ShapesSchema }),
  provenance: ProvenanceSchema,
}).annotate({ description: "One mast drawing and the style/era that selects it" });

export const ShipVisualCatalogSchema = Schema.Struct({
  mounts: Schema.Array(ShipVisualMountSchema),
  masts: Schema.Array(ShipVisualMastSchema),
}).annotate({ description: "The presentation-only ship-visual part catalog (ADR-0148)" });

export type ShipVisualCatalog = typeof ShipVisualCatalogSchema.Type;
