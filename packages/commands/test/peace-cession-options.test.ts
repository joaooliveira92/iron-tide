import type { CampaignSnapshot, NationState, WarDeclaration } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { peaceCessionOptions } from "../src/index.js";

type PeaceSnapshot = Pick<CampaignSnapshot, "wars" | "world" | "nations">;

function war(overrides: Partial<WarDeclaration> = {}): WarDeclaration {
  return {
    id: "war-1",
    attackerSideId: "side-GBR",
    defenderSideId: "side-FRA",
    attackerSideMembers: ["GBR", "AUS"],
    defenderSideMembers: ["FRA"],
    attackerWarScore: 10,
    defenderWarScore: 0,
    attackerId: "GBR",
    defenderId: "FRA",
    startDate: "1880-01",
    status: "ACTIVE",
    ...overrides,
  };
}

function homeOf(areaId: string): NationState {
  return { homeAreaId: areaId } as NationState;
}

function snapshotWith(
  options: {
    readonly wars?: WarDeclaration[];
    readonly areas?: PeaceSnapshot["world"]["areas"];
    readonly possessions?: { id: string; nationId: string; areaId: string }[];
  } = {},
): PeaceSnapshot {
  return {
    wars: {
      wars: options.wars ?? [war()],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    world: {
      areas: options.areas ?? [
        {
          id: "fra_home",
          name: "France",
          type: "coastal",
          controller: "FRA",
          cessionCost: SafeInt(1),
        },
        {
          id: "gbr_home",
          name: "Britain",
          type: "coastal",
          controller: "GBR",
          cessionCost: SafeInt(1),
        },
        {
          id: "med_corsica",
          name: "Corsica",
          type: "coastal",
          controller: "FRA",
          cessionCost: SafeInt(4),
        },
        {
          id: "med_malta",
          name: "Malta",
          type: "coastal",
          controller: "FRA",
          cessionCost: SafeInt(6),
        },
        { id: "med_unpriced", name: "Unpriced", type: "coastal", controller: "FRA" },
      ],
      routes: [],
      ports: [],
      possessions: options.possessions ?? [],
    },
    nations: new Map([
      ["FRA", homeOf("fra_home")],
      ["GBR", homeOf("gbr_home")],
    ]),
  };
}

describe("peaceCessionOptions", () => {
  it("lists the priced, non-home areas the opponent controls, in area order", () => {
    expect(peaceCessionOptions(snapshotWith(), "war-1", "GBR")).toEqual([
      { areaId: "med_corsica", name: "Corsica", cost: 4 },
      { areaId: "med_malta", name: "Malta", cost: 6 },
    ]);
  });

  it("lists the attacker's areas when the defender proposes", () => {
    const snapshot = snapshotWith({
      wars: [war({ defenderWarScore: 5 })],
      areas: [
        {
          id: "gbr_home",
          name: "Britain",
          type: "coastal",
          controller: "GBR",
          cessionCost: SafeInt(1),
        },
        {
          id: "gbr_gib",
          name: "Gibraltar",
          type: "coastal",
          controller: "GBR",
          cessionCost: SafeInt(3),
        },
      ],
    });
    expect(peaceCessionOptions(snapshot, "war-1", "FRA")).toEqual([
      { areaId: "gbr_gib", name: "Gibraltar", cost: 3 },
    ]);
  });

  it("drops an area another nation holds a possession in", () => {
    const snapshot = snapshotWith({
      possessions: [{ id: "poss_corsica", nationId: "ITA", areaId: "med_corsica" }],
    });
    expect(peaceCessionOptions(snapshot, "war-1", "GBR").map((o) => o.areaId)).toEqual([
      "med_malta",
    ]);
  });

  it("offers nothing to a co-belligerent that is not the principal", () => {
    expect(peaceCessionOptions(snapshotWith(), "war-1", "AUS")).toEqual([]);
  });

  it("offers nothing for a war that is missing or not active", () => {
    expect(peaceCessionOptions(snapshotWith(), "nope", "GBR")).toEqual([]);
    const declared = snapshotWith({ wars: [war({ status: "DECLARED_NOT_ACTIVE" })] });
    expect(peaceCessionOptions(declared, "war-1", "GBR")).toEqual([]);
  });

  it("still lists an area that costs more than the budget so the caller can explain it", () => {
    const poor = snapshotWith({ wars: [war({ attackerWarScore: 0 })] });
    expect(peaceCessionOptions(poor, "war-1", "GBR")).toHaveLength(2);
  });
});
