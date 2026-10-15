import { describe, expect, it } from "vite-plus/test";
import { ARCHETYPE_PRESETS } from "@bluewave/campaign-engine";
import { nationArchetypeSynergy } from "./archetypeNationSynergy.js";

describe("nationArchetypeSynergy", () => {
  it("returns a strong affinity for a matching nation and preset", () => {
    const synergy = nationArchetypeSynergy("uk", ARCHETYPE_PRESETS[0]!.allocation);
    expect(synergy?.affinity).toBe("strong");
    expect(synergy?.note.length).toBeGreaterThan(0);
  });

  it("returns a synergy note for a nation with a combat entry", () => {
    const synergy = nationArchetypeSynergy("germany", ARCHETYPE_PRESETS[2]!.allocation);
    expect(synergy?.affinity).toBe("strong");
  });

  it("returns null for a custom allocation with no preset match", () => {
    expect(
      nationArchetypeSynergy("uk", {
        economy: 6,
        industry: 7,
        combat: 7,
      }),
    ).toBeNull();
  });

  it("returns null for an unknown nation", () => {
    expect(nationArchetypeSynergy("nation_zzz", ARCHETYPE_PRESETS[0]!.allocation)).toBeNull();
  });

  it("does not change the allocation it inspects", () => {
    const allocation = { ...ARCHETYPE_PRESETS[0]!.allocation };
    nationArchetypeSynergy("uk", allocation);
    expect(allocation).toEqual(ARCHETYPE_PRESETS[0]!.allocation);
  });
});
