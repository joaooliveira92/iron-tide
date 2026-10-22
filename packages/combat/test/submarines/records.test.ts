import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  orderWarsById,
  orderAreasById,
  orderSubmarineAssetsById,
  orderMissionsByPriority,
  orderTargetsById,
  orderBattleAllocationsById,
  orderAswContactsById,
  orderFriendlyFireChecksById,
  withSubmarineOperationsRecordHash,
  computeSubmarineOperationsRecordHash,
} from "@bluewave/combat/submarines";

describe("AC-17: §26 canonical ordering", () => {
  it("orderWarsById: deterministic ascending", () => {
    expect(orderWarsById(["war-Z", "war-A", "war-M"])).toEqual(["war-A", "war-M", "war-Z"]);
  });

  it("orderAreasById: deterministic ascending", () => {
    expect(orderAreasById(["area-B", "area-A"])).toEqual(["area-A", "area-B"]);
  });

  it("orderSubmarineAssetsById: deterministic ascending", () => {
    expect(orderSubmarineAssetsById(["sub-3", "sub-1", "sub-2"])).toEqual([
      "sub-1",
      "sub-2",
      "sub-3",
    ]);
  });

  it("orderMissionsByPriority: ascending priority", () => {
    const priorities = { MINE_LAYING: 7, FLEET_INTERDICTION: 2, MERCHANT_RAIDING: 3 };
    expect(
      orderMissionsByPriority(
        ["MINE_LAYING", "FLEET_INTERDICTION", "MERCHANT_RAIDING"],
        priorities,
      ),
    ).toEqual(["FLEET_INTERDICTION", "MERCHANT_RAIDING", "MINE_LAYING"]);
  });

  it("orderMissionsByPriority: unknown missions sort last", () => {
    const priorities = { FLEET_INTERDICTION: 2 };
    expect(orderMissionsByPriority(["MINE_LAYING", "FLEET_INTERDICTION"], priorities)).toEqual([
      "FLEET_INTERDICTION",
      "MINE_LAYING",
    ]);
  });

  it("orderTargetsById: deterministic ascending", () => {
    expect(orderTargetsById(["t-3", "t-1", "t-2"])).toEqual(["t-1", "t-2", "t-3"]);
  });

  it("orderBattleAllocationsById: deterministic ascending", () => {
    expect(orderBattleAllocationsById(["b-B", "b-A"])).toEqual(["b-A", "b-B"]);
  });

  it("orderAswContactsById: deterministic ascending", () => {
    expect(orderAswContactsById(["c-9", "c-1"])).toEqual(["c-1", "c-9"]);
  });

  it("orderFriendlyFireChecksById: by contact then submarine", () => {
    const checks = [
      { contactId: "c-B", submarineAssetId: "sub-Z" },
      { contactId: "c-A", submarineAssetId: "sub-A" },
      { contactId: "c-B", submarineAssetId: "sub-A" },
    ];
    const ordered = orderFriendlyFireChecksById(checks);
    expect(ordered[0]).toEqual({ contactId: "c-A", submarineAssetId: "sub-A" });
    expect(ordered[1]).toEqual({ contactId: "c-B", submarineAssetId: "sub-A" });
    expect(ordered[2]).toEqual({ contactId: "c-B", submarineAssetId: "sub-Z" });
  });
});

describe("AC-17: §25 SubmarineOperationsRecord + hash", () => {
  it("withSubmarineOperationsRecordHash produces deterministic hash", () => {
    const r1 = withSubmarineOperationsRecordHash({
      month: SafeInt(1),
      warIds: ["war-1"],
      areaIds: ["area-1"],
      assetIds: ["sub-1"],
      missionIds: ["MISSION-1"],
      targetIds: ["t-1"],
      battleIds: [],
      aswContactIds: [],
      friendlyFireCheckIds: [],
      rulesetVersion: "submarine_ruleset_v1",
      formulaVersion: "submarine_formula_v1",
    });
    const r2 = withSubmarineOperationsRecordHash({
      month: SafeInt(1),
      warIds: ["war-1"],
      areaIds: ["area-1"],
      assetIds: ["sub-1"],
      missionIds: ["MISSION-1"],
      targetIds: ["t-1"],
      battleIds: [],
      aswContactIds: [],
      friendlyFireCheckIds: [],
      rulesetVersion: "submarine_ruleset_v1",
      formulaVersion: "submarine_formula_v1",
    });
    expect(r1.recordHash).toBe(r2.recordHash);
  });

  it("different inputs produce different hashes", () => {
    const h1 = computeSubmarineOperationsRecordHash({
      month: SafeInt(1),
      warIds: ["war-1"],
      areaIds: ["area-1"],
      assetIds: ["sub-1"],
      missionIds: [],
      targetIds: [],
      battleIds: [],
      aswContactIds: [],
      friendlyFireCheckIds: [],
      rulesetVersion: "submarine_ruleset_v1",
      formulaVersion: "submarine_formula_v1",
    });
    const h2 = computeSubmarineOperationsRecordHash({
      month: SafeInt(2),
      warIds: ["war-2"],
      areaIds: ["area-2"],
      assetIds: ["sub-2"],
      missionIds: [],
      targetIds: [],
      battleIds: [],
      aswContactIds: [],
      friendlyFireCheckIds: [],
      rulesetVersion: "submarine_ruleset_v1",
      formulaVersion: "submarine_formula_v1",
    });
    expect(h1).not.toBe(h2);
  });
});
