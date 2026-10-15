import { ARCHETYPE_PRESETS, type ArchetypeAllocation } from "@bluewave/campaign-engine";

export type NationArchetypeAffinity = "strong" | "neutral" | "weak";

export interface NationArchetypeSynergy {
  readonly affinity: NationArchetypeAffinity;
  readonly note: string;
}

/**
 * Presentational (non-authoritative) affinity notes between a nation and each
 * playstyle. This is flavour content shown on the nation-selection step; it never
 * changes campaign authority. Keyed by stable nation id like `uk`.
 */
const NATION_ARCHETYPE_SYNERGY: Record<string, Partial<Record<string, NationArchetypeSynergy>>> = {
  uk: {
    merchant_prince: {
      affinity: "strong",
      note: "The Royal Navy's global commerce fits a treasury-led build-up well.",
    },
    shipyard_baron: {
      affinity: "strong",
      note: "British yards can sustain a large, fast-replacing battlefleet.",
    },
    grand_admiral: {
      affinity: "neutral",
      note: "British doctrine rewards decisive battle, but economy still fuels it.",
    },
  },
  germany: {
    grand_admiral: {
      affinity: "strong",
      note: "A smaller, aggressive High Seas Fleet rewards a combat-focused playstyle.",
    },
    merchant_prince: {
      affinity: "neutral",
      note: "A constrained economy favours spending every appropriation carefully.",
    },
  },
  france: {
    shipyard_baron: {
      affinity: "strong",
      note: "French dockyards pair well with a construction-led strategy.",
    },
  },
  italy: {
    grand_admiral: {
      affinity: "weak",
      note: "Italian battle doctrine is potent but a thin economy can limit follow-on.",
    },
    merchant_prince: {
      affinity: "strong",
      note: "A commerce-minded Italy can stretch a modest treasury further.",
    },
  },
};

export function nationArchetypeSynergy(
  nationId: string,
  allocation: ArchetypeAllocation,
): NationArchetypeSynergy | null {
  const presets = ARCHETYPE_PRESETS.filter(
    (preset) =>
      preset.allocation.economy === allocation.economy &&
      preset.allocation.industry === allocation.industry &&
      preset.allocation.combat === allocation.combat,
  );
  if (presets.length === 0) return null;

  const nationMap = NATION_ARCHETYPE_SYNERGY[nationId];
  if (nationMap === undefined) return null;

  const entry = nationMap[presets[0]!.id];
  return entry ?? null;
}
