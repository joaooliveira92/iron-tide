import { kg, type DesignDraft } from "@bluewave/ship-design";

export type RebuildAction = "STANDARD" | "REARMAMENT" | "BULGE";

export const REBUILD_ACTIONS: readonly { readonly value: RebuildAction; readonly label: string }[] =
  [
    { value: "STANDARD", label: "Standard rebuild" },
    { value: "REARMAMENT", label: "Armament change" },
    { value: "BULGE", label: "Bulge (add torpedo blister)" },
  ];

export function bulgeMassKg(action: RebuildAction, blisterMassKg: number): number {
  return action === "BULGE" ? Math.max(0, Math.floor(blisterMassKg)) : 0;
}

export function withBulgeMass(draft: DesignDraft, massKg: number): DesignDraft {
  return massKg > 0
    ? {
        ...draft,
        hull: {
          ...draft.hull,
          targetDisplacementKg: kg(draft.hull.targetDisplacementKg + massKg),
        },
      }
    : draft;
}

export function failureText(outcome: {
  readonly diagnostics: readonly string[];
  readonly reason: string;
}): string {
  return (outcome.diagnostics.length > 0 ? outcome.diagnostics : [outcome.reason]).join(" ");
}
