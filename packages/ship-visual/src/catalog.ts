import type { MountClass, NationStyle, SizeBand, VisualEra } from "./vocabulary.js";

/**
 * The part catalog's runtime shape (ADR-0148). Authored in `content/ship-visual/parts.yaml`, decoded by
 * `ShipVisualCatalogSchema` in `@bluewave/content-schema`, and generated into `catalog.generated.ts`. The sync test
 * pins the generated VALUES to the decoded YAML, and the generated module is typed `PartCatalog`, so a decoded field
 * this shape lacks fails the typecheck; keep the two vocabularies in step by hand when adding a literal.
 *
 * Drawings are SVG path data in METRES AT THE 12-INCH REFERENCE (manual p142): origin at the seat centre, y down, the
 * bow to the left (barrels point to −x). The renderer places them with a transform, so path strings are never parsed.
 */

/** How a shape is filled; the renderer maps each tone to theme tokens. A damage `state` modifier is reserved. */
export const TONES = ["structure", "gun", "void"] as const;
export type Tone = (typeof TONES)[number];

export interface Shape {
  readonly tone: Tone;
  readonly d: string;
}

/** Top-down body outlines, drawn procedurally at `diameterM`. */
export const PLAN_BODIES = ["ROUND", "RING", "SHIELD", "PEDESTAL", "CASEMATE"] as const;
export type PlanBody = (typeof PLAN_BODIES)[number];

export interface MountKey {
  readonly style: NationStyle;
  readonly era: VisualEra;
  /** The size bands this drawing serves (non-empty); the calibre resize distinguishes them. */
  readonly sizes: readonly SizeBand[];
  readonly mountClass: MountClass;
  /** Absent: the drawing serves any gun count. */
  readonly guns?: number;
}

export interface MountPart {
  readonly id: string;
  readonly key: MountKey;
  readonly profile: {
    /** Body width, for row pitch and the minimum drawn size. */
    readonly widthM: number;
    readonly shapes: readonly Shape[];
    /** The barrel as seen from the side: breech end at (x, y), running toward −x for `lengthM` (foreshortened if abeam). */
    readonly barrel: {
      readonly x: number;
      readonly y: number;
      readonly lengthM: number;
      readonly boreM: number;
    };
  };
  readonly plan: {
    readonly body: PlanBody;
    readonly diameterM: number;
    /** Side-by-side barrels from the body centre, `spacingM` apart centre to centre. */
    readonly barrel: {
      readonly lengthM: number;
      readonly boreM: number;
      readonly spacingM: number;
    };
  };
  readonly provenance: Provenance;
}

export interface MastPart {
  readonly id: string;
  readonly key: { readonly style: NationStyle; readonly era: VisualEra };
  readonly profile: {
    /** Height above the seat, for the clamp to the drawing's top. */
    readonly heightM: number;
    readonly shapes: readonly Shape[];
  };
  readonly provenance: Provenance;
}

export interface PartCatalog {
  readonly mounts: readonly MountPart[];
  readonly masts: readonly MastPart[];
}

/** Mirrors `ProvenanceSchema` (content-schema) without importing it, so this package stays dependency-free. */
export interface Provenance {
  readonly sourceStatus: "VERIFIED" | "DERIVED" | "ESTIMATE" | "BALANCE_TARGET" | "PLACEHOLDER";
  readonly confidence: "HIGH" | "MEDIUM" | "LOW";
  readonly kind: "historical_fact" | "game_conversion" | "balance_adjustment";
  readonly sources: readonly {
    readonly sourceId?: string;
    readonly title: string;
    readonly author?: string;
    readonly year?: number;
    readonly page?: string;
    readonly section?: string;
    readonly archiveOrUrl?: string;
    readonly accessedAt?: string;
  }[];
  readonly derivation?: {
    readonly sourceValue: string;
    readonly sourceUnit: string;
    readonly conversion: string;
    readonly gameValue: string;
    readonly roundingRule?: string;
    readonly originalValue?: string;
    readonly originalUnit?: string;
    readonly convertedValue?: string;
    readonly convertedUnit?: string;
  };
  readonly note?: string;
}
