import { describe, it, expect } from "vite-plus/test";
import {
  reserveAssets,
  releaseProvisionalReservations,
  assertParticipationLimit,
  MAX_BATTLE_PARTICIPATION_PER_SHIP_PER_MONTH,
} from "../../src/generation/reservation.js";
import { BATTLE_ASSET_RESERVATION_CONFLICT } from "../../src/generation/reasonCodes.js";

describe("reservations (AC-11)", () => {
  it("maximum participation is exactly 1 per ship per month", () => {
    expect(MAX_BATTLE_PARTICIPATION_PER_SHIP_PER_MONTH).toBe(1);
  });

  it("reserves each asset; duplicate -> BATTLE_ASSET_RESERVATION_CONFLICT", () => {
    const r = reserveAssets("b1", ["a", "b"], new Set());
    expect(r.map((x) => x.assetId)).toEqual(["a", "b"]);
    expect(() => reserveAssets("b1", ["a", "c"], new Set(["a"]))).toThrow(
      new RegExp(BATTLE_ASSET_RESERVATION_CONFLICT),
    );
    expect(() => reserveAssets("b1", ["a", "a"], new Set())).toThrow(
      new RegExp(BATTLE_ASSET_RESERVATION_CONFLICT),
    );
  });

  it("releases provisional reservations", () => {
    const r = reserveAssets("b1", ["a", "b", "c"], new Set());
    const released = releaseProvisionalReservations(r, new Set(["b"]));
    expect(released.map((x) => x.assetId)).toEqual(["a", "c"]);
  });

  it("over-participation fails", () => {
    expect(() => assertParticipationLimit({ ship: 2 }, {})).toThrow(
      new RegExp(BATTLE_ASSET_RESERVATION_CONFLICT),
    );
    expect(() => assertParticipationLimit({ ship: 1 }, {})).not.toThrow();
  });
});

describe("auto-resolution proof (AC-11 / ADR B-1-6)", () => {
  it("ships a declared-surface proof for a B-1 manifest", async () => {
    const { buildManifest } = await import("../../src/generation/manifest.js");
    const { proveAutoResolvable, shippedResolverCapabilities } =
      await import("../../src/generation/autoResolutionProof.js");
    const base = {
      battleId: "b1",
      opportunityId: "opp_1",
      warId: "war_1",
      areaId: "area_battle",
      missionType: "FLEET_BATTLE",
      attackerId: "GBR",
      defenderId: "FRA",
      acceptanceClass: "OPTIONAL",
      missionObjectives: [] as string[],
      sides: [
        { sideId: "ATTACKER" as const, participantIds: ["GBR"] },
        { sideId: "DEFENDER" as const, participantIds: ["FRA"] },
      ],
      persistentAssets: ["a"],
      temporaryAssets: [] as string[],
      permanentDivisionIds: [] as string[],
      tacticalDivisions: [] as never[],
      commanders: [] as string[],
      weather: "clear",
      seaState: "moderate",
      visibility: "good",
      environment: "day",
      sourceStateHashes: {} as Record<string, string>,
      reservations: [] as string[],
      autoResolutionProof: "",
      provenanceRecords: [] as string[],
      rulesetVersion: "1",
      formulaVersion: "1",
      aiPolicyVersion: "1",
      rngVersion: "1",
      contentVersion: "0.3.0",
    };
    const manifest = buildManifest(base);
    const proof = proveAutoResolvable(manifest, shippedResolverCapabilities());
    expect(proof).toBe("auto_resolution_declared_surface_v1");
  });
});
