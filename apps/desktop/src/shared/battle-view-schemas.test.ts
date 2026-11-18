import type { BattleView, BattleViewContact } from "@bluewave/combat/battleResolution";
import { describe, expect, it } from "vite-plus/test";
import { decodeBattleView } from "./battle-view-schemas.js";

const TYPE_CONTACT: BattleViewContact = {
  handle: "0123456789abcdef",
  tier: "TYPE",
  shipType: "CRUISER",
  positionM: [1_000, -2_000],
  ageMinutes: 0,
  courseDeg: 90,
  speedMilliKnots: 12_000,
  confidenceBp: 10_000,
  stale: false,
};

function view(): BattleView {
  return {
    version: "battle_view_v1",
    battleId: "b1",
    areaId: "area",
    campaignMonth: "1880-02",
    side: "ATTACKER",
    playerNationId: "n-uk",
    ended: false,
    endReason: null,
    winnerId: null,
    loserId: null,
    pauseReason: "ENEMY_SIGHTED",
    objectives: [],
    status: {
      minute: 3,
      elapsedMinutes: 3,
      maxMinutes: 240,
      dayPhase: "DAY",
      localMinuteOfDay: null,
      latLonAnchor: null,
      weather: {
        seaState: "3",
        precipitation: "NONE",
        daylight: true,
        visibilityM: 18_520,
        windDirectionDeg: 225,
        windSpeedMetresPerSecond: 8,
      },
    },
    divisions: [],
    ships: [],
    contacts: [TYPE_CONTACT],
    friendlyReports: [],
    overlays: {
      sightingRangesM: { visualM: 18_520, radarM: null },
      gunRangeArcs: [],
      fireLines: [],
      smoke: [],
      flotillaAttack: null,
      forceState: null,
      terrain: { land: [], shallows: [], exclusionZones: [] },
    },
    log: [],
    accessibility: {
      tierLabels: { UNIDENTIFIED: "u", TYPE: "t", CLASS: "c" },
      stars: { "0": "none" },
    },
  };
}

describe("battle view strict decode", () => {
  it("accepts a well-formed view", () => {
    expect(decodeBattleView(view()).kind).toBe("decoded");
  });

  it("rejects a TYPE contact that carries the true class", () => {
    const leaked = { ...TYPE_CONTACT, className: "Dreadnought" };
    expect(decodeBattleView({ ...view(), contacts: [leaked] }).kind).toBe("invalid");
  });

  it("rejects an UNIDENTIFIED contact that carries a ship type", () => {
    const leaked = { ...TYPE_CONTACT, tier: "UNIDENTIFIED" };
    expect(decodeBattleView({ ...view(), contacts: [leaked] }).kind).toBe("invalid");
  });

  it("rejects unknown top-level fields such as hidden enemy ships", () => {
    expect(decodeBattleView({ ...view(), enemyShips: [] }).kind).toBe("invalid");
  });

  it("rejects fractional metres", () => {
    const fractional = { ...TYPE_CONTACT, positionM: [0.5, 1] };
    expect(decodeBattleView({ ...view(), contacts: [fractional] }).kind).toBe("invalid");
  });

  it("rejects an unknown pause reason", () => {
    expect(decodeBattleView({ ...view(), pauseReason: "BORED" }).kind).toBe("invalid");
  });
});
