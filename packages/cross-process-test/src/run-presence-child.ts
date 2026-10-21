// S-5 05 (#79, spec #73 R15): cross-process determinism child for the month-end presence step. Compiles the production
// pack, runs one strategic month twice - once with the presence section dormant and once with a FIXTURE-CLASS section -
// and prints the hashes and the typed shortfall events as JSON for byte-for-byte comparison across two clean processes.
//
// EVERY RULESET NUMBER BELOW IS FIXTURE-CLASS: it exercises the mechanics and never reaches the production pack.
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { CampaignSnapshot } from "@bluewave/campaign";
import { hashSnapshot, MonthExecutor } from "@bluewave/phase-engine";

import { compileProductionCampaign } from "./production-pack.js";

const FIXTURE_PRESENCE = {
  requiredTonsPerPossessionWeight: 1_000,
  noPortValueWeight: 3,
  crampedOrShortRangeCountBp: 5_000,
};

// FIXTURE-CLASS base-limit block (S-5 08): a tight limit everywhere so the production fleets exceed it somewhere.
const FIXTURE_BASE_LIMITS = {
  limitByBaseLevel: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  noBaseLimit: 1,
  occupyingStates: ["ACTIVE", "RESERVE", "MOTHBALLED", "WORKING_UP", "REPAIR"] as const,
  maintenanceAdderBp: 2_500,
  crewQualityReduction: 10,
};

function run(): void {
  try {
    const { state } = compileProductionCampaign();
    const execute = (
      withSection: boolean,
      penalty = false,
      snapshot: CampaignSnapshot = state.snapshot,
    ) =>
      new MonthExecutor().execute(
        snapshot,
        [],
        "presence-cross-process-seed",
        new DiagnosticCollector(),
        undefined,
        withSection
          ? {
              presence: penalty
                ? { ...FIXTURE_PRESENCE, penaltyRequests: true as const }
                : FIXTURE_PRESENCE,
            }
          : undefined,
      );
    const dormant = execute(false);
    const configured = execute(true);
    const shortfalls = configured.eventLedger.all.flatMap((e) =>
      e.body.kind === "PresenceShortfall" ? [e.body] : [],
    );
    const penalised = execute(true, true);
    const requestsOf = (r: typeof penalised, kind: string) =>
      r.eventLedger.all.filter((e) => e.body.kind === kind).map((e) => e.body);
    // Put the first under-covered nation at war and under blockade: it must drop out of every output.
    const exemptNation = shortfalls[0]!.nationId;
    const blockadedSnapshot: CampaignSnapshot = {
      ...state.snapshot,
      wars: {
        ...state.snapshot.wars,
        wars: [
          {
            id: "fixture-war",
            attackerSideId: "fixture-attackers",
            defenderSideId: "fixture-defenders",
            attackerSideMembers: ["fixture-blockader"],
            defenderSideMembers: [exemptNation],
            attackerWarScore: 0,
            defenderWarScore: 0,
            attackerId: "fixture-blockader",
            defenderId: exemptNation,
            startDate: "1880-01",
            status: "ACTIVE",
          },
        ],
        blockadeState: [
          {
            blockaderId: "fixture-blockader",
            blockadedNationId: exemptNation,
            areaId: shortfalls[0]!.areaId,
            establishedMonth: "1880-01",
          },
        ],
      },
    };
    const blockaded = execute(true, true, blockadedSnapshot);
    const involving = (r: typeof penalised) =>
      r.eventLedger.all.filter(
        (e) =>
          (e.body.kind === "PresenceShortfall" ||
            e.body.kind === "PrestigeLossRequested" ||
            e.body.kind === "RevoltPressureRequested") &&
          e.body.nationId === exemptNation,
      ).length;
    // S-5 07: assign one active ship outside its nation's shortfall areas to foreign station; the month routes it.
    const shortAreas = new Set(shortfalls.map((e) => `${e.nationId}/${e.areaId}`));
    let stationed: CampaignSnapshot | undefined;
    let stationedShipId = "";
    for (const sf of shortfalls) {
      if (stationed !== undefined) break;
      const nation = state.snapshot.nations.get(sf.nationId)!;
      const candidate = nation.fleets
        .flatMap((f) => f.ships)
        .find(
          (sh) =>
            sh.nationId === sf.nationId &&
            sh.readiness === "ACTIVE" &&
            !sh.isUnderConstruction &&
            sh.availability !== "UNAVAILABLE" &&
            !shortAreas.has(`${sf.nationId}/${sh.locationAreaId}`),
        );
      if (candidate === undefined) continue;
      stationedShipId = candidate.id;
      const nations = new Map(state.snapshot.nations);
      nations.set(sf.nationId, {
        ...nation,
        fleets: nation.fleets.map((f) => ({
          ...f,
          ships: f.ships.map((sh) =>
            sh.id === candidate.id ? { ...sh, stationAssignment: "FOREIGN_STATION" as const } : sh,
          ),
        })),
      });
      stationed = { ...state.snapshot, nations };
    }
    const deployed = stationed === undefined ? undefined : execute(true, false, stationed);
    const deploymentKinds = [
      "ShipRemovedFromDivision",
      "ShipDetachedToFleet",
      "ForeignStationShipMoved",
      "ForeignStationNoRoute",
    ];
    const deploymentEvents =
      deployed === undefined
        ? []
        : deployed.eventLedger.all
            .filter((e) => deploymentKinds.includes(e.body.kind))
            .map((e) => e.body);
    // S-5 08: the same month with the fixture base-limit block flags ships beyond the limits and applies the consequences.
    const baseLimited = new MonthExecutor().execute(
      state.snapshot,
      [],
      "presence-cross-process-seed",
      new DiagnosticCollector(),
      undefined,
      { presence: { ...FIXTURE_PRESENCE, baseLimits: FIXTURE_BASE_LIMITS } },
    );
    const baseLimitFlagged = [...baseLimited.finalSnapshot.nations.values()]
      .flatMap((n) => n.fleets.flatMap((f) => f.ships))
      .filter((sh) => sh.overBase !== undefined)
      .map((sh) => sh.id)
      .sort();
    const output = {
      baseLimitFlagged,
      baseLimitSnapshotHash: hashSnapshot(baseLimited.finalSnapshot),
      baseLimitEventLedgerHash: baseLimited.eventLedger.hash(),
      stationedShipId,
      deploymentEvents,
      deploymentSnapshotHash: deployed === undefined ? "" : hashSnapshot(deployed.finalSnapshot),
      configuredFullSnapshotHash: hashSnapshot(configured.finalSnapshot),
      deploymentEventLedgerHash: deployed === undefined ? "" : deployed.eventLedger.hash(),
      penaltySnapshotHash: sha256Hex(canonicalSerialize(penalised.finalSnapshot)),
      penaltyEventLedgerHash: penalised.eventLedger.hash(),
      prestigeRequests: requestsOf(penalised, "PrestigeLossRequested"),
      revoltRequests: requestsOf(penalised, "RevoltPressureRequested"),
      exemptNation,
      exemptNationEventsUnblockaded: involving(penalised),
      exemptNationEventsBlockaded: involving(blockaded),
      blockadedEventLedgerHash: blockaded.eventLedger.hash(),
      dormantSnapshotHash: sha256Hex(canonicalSerialize(dormant.finalSnapshot)),
      dormantEventLedgerHash: dormant.eventLedger.hash(),
      dormantShortfallCount: dormant.eventLedger.all.filter(
        (e) => e.body.kind === "PresenceShortfall",
      ).length,
      configuredSnapshotHash: sha256Hex(canonicalSerialize(configured.finalSnapshot)),
      configuredEventLedgerHash: configured.eventLedger.hash(),
      shortfalls,
      success: dormant.success && configured.success,
    };
    process.stdout.write(JSON.stringify(output) + "\n");
  } catch (err) {
    process.stdout.write(JSON.stringify({ success: false, error: String(err) }) + "\n");
  }
}

run();
