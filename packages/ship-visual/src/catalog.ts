import type { MountClass, NationStyle, SizeBand, VisualEra } from "./vocabulary.js";

export const TONES = ["structure", "gun", "void"] as const;
export type Tone = (typeof TONES)[number];

export interface Shape {
  readonly tone: Tone;
  readonly d: string;
}

export const PLAN_BODIES = ["ROUND", "RING", "SHIELD", "PEDESTAL", "CASEMATE"] as const;
export type PlanBody = (typeof PLAN_BODIES)[number];

export interface MountKey {
  readonly style: NationStyle;
  readonly era: VisualEra;
  readonly sizes: readonly SizeBand[];
  readonly mountClass: MountClass;
  readonly guns?: number;
}

export interface MountPart {
  readonly id: string;
  readonly key: MountKey;
  readonly profile: {
    readonly widthM: number;
    readonly shapes: readonly Shape[];
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
    readonly heightM: number;
    readonly shapes: readonly Shape[];
  };
  readonly provenance: Provenance;
}

export interface PartCatalog {
  readonly mounts: readonly MountPart[];
  readonly masts: readonly MastPart[];
}

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
