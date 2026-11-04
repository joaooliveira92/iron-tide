import { ARCHETYPE_PRESETS } from "@bluewave/campaign-engine";
import { archetypeOptionId } from "./ArchetypeCard.js";
import { customArchetypeOptionId } from "./ArchetypeCustomDeckCard.js";

export type ArchetypeDeckEntry =
  | { readonly kind: "preset"; readonly id: string }
  | { readonly kind: "custom" };

export const ARCHETYPE_DECK_ENTRIES: readonly ArchetypeDeckEntry[] = [
  ...ARCHETYPE_PRESETS.map((preset) => ({ kind: "preset" as const, id: preset.id })),
  { kind: "custom" as const },
];

export function archetypeDeckOptionId(listboxId: string, index: number): string {
  const entry = ARCHETYPE_DECK_ENTRIES[index];
  if (entry === undefined) return "";
  return entry.kind === "custom"
    ? customArchetypeOptionId(listboxId)
    : archetypeOptionId(listboxId, entry.id);
}
