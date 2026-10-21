// S-5 11 (#87, spec #73 R15): the S-5 acceptance scenario. One function drives every S-5 behaviour from the compiled
// production-pack campaign month and returns a plain, JSON-able observation of authoritative state, so the same code runs
// in-process (assertions) and in two clean child processes (byte-identical comparison).
//
// EVERY RULESET NUMBER BELOW IS FIXTURE-CLASS. The production `presence` section is DORMANT (absent): it is gated on owner
// decision requests 0017-0023 and 0026 (#85). Nothing here reaches the production pack or a golden.
import type { CampaignSnapshot, Ship } from "@bluewave/campaign";
import { isPresenceExempt, measurePresence } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { DomainEventBody } from "@bluewave/events";
import {
  hashSnapshot,
  MonthExecutor,
  type MonthExecutorEngineOptions,
  type MonthResult,
} from "@bluewave/phase-engine";

import { compileProductionCampaign } from "./production-pack.js";

const SEED = "s5-acceptance-seed";

/** FIXTURE-CLASS presence values (never production). */
export const ACCEPTANCE_PRESENCE = {
  requiredTonsPerPossessionWeight: 1_000,
  noPortValueWeight: 3,
  crampedOrShortRangeCountBp: 5_000,
  penaltyRequests: true as const,
};

/** FIXTURE-CLASS base-limit block: a tight limit everywhere so the production fleets exceed it somewhere. */
export const ACCEPTANCE_BASE_LIMITS = {
  limitByBaseLevel: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  noBaseLimit: 1,
  occupyingStates: ["ACTIVE", "RESERVE", "MOTHBALLED", "WORKING_UP", "REPAIR"] as const,
  maintenanceAdderBp: 2_500,
  crewQualityReduction: 10,
};

type Env = CommandEnvelope<CommandBody>;
type PresenceOption = NonNullable<MonthExecutorEngineOptions["presence"]>;

export interface S5Observation {
  readonly sectionState: "dormant-production-fixture-exercised";
  readonly oldHashes: { snapshot: string; eventLedger: string };
  readonly newHashes: { snapshot: string; eventLedger: string };
  readonly assignment: {
    readonly shipId: string;
    readonly assignedReason: string;
    readonly assignedValue: string;
    readonly clearedReason: string;
    readonly clearedValue: string;
    readonly rejectedCount: number;
  };
  readonly weighting: {
    readonly areaId: string;
    readonly plainPresentTons: number;
    readonly colonialFsPresentTons: number;
    readonly colonialFsEventShortfallTons: number;
    readonly colonialFsRowShortfallTons: number;
    readonly shipTons: number;
  };
  readonly exclusion: {
    readonly activePresentTons: number;
    readonly reservePresentTons: number;
    readonly mothballedPresentTons: number;
  };
  readonly exemption: {
    readonly nationId: string;
    readonly eventsBeforeBlockade: number;
    readonly eventsWhileBlockaded: number;
    readonly eventsAfterWarEnds: number;
    readonly baseLimitsUnaffectedWhileBlockaded: boolean;
  };
  readonly routing: {
    readonly shipId: string;
    readonly fromAreaId: string;
    readonly toAreaId: string;
    readonly targetAreaId: string;
    readonly expectedTargetAreaId: string;
    readonly routeAdjacent: boolean;
  };
  readonly requests: {
    readonly dormantShortfalls: number;
    readonly shortfalls: number;
    readonly prestige: number;
    readonly revolt: number;
    readonly stateUnchangedByRequests: boolean;
  };
  readonly overBase: {
    readonly flagged: readonly string[];
    readonly crewReduced: boolean;
    readonly flaggedWithoutBlock: number;
  };
}

const envelope = (body: CommandBody, from: CampaignSnapshot): Env => ({
  commandId: `cmd-${body.type}`,
  version: "0.1.0",
  expectedSnapshotHash: sha256Hex(canonicalSerialize(from)),
  idempotencyKey: `ik-${body.type}-${JSON.stringify(body)}`,
  timestamp: "s5-acceptance",
  body,
});

const run = (
  snapshot: CampaignSnapshot,
  commands: Env[] = [],
  presence: PresenceOption | null = ACCEPTANCE_PRESENCE,
): MonthResult =>
  new MonthExecutor().execute(
    snapshot,
    commands,
    SEED,
    new DiagnosticCollector(),
    undefined,
    presence === null ? undefined : { presence },
  );

function bodies<K extends DomainEventBody["kind"]>(
  r: MonthResult,
  kind: K,
): Extract<DomainEventBody, { kind: K }>[] {
  const out: Extract<DomainEventBody, { kind: K }>[] = [];
  for (const e of r.eventLedger.all) {
    if (e.body.kind === kind) out.push(e.body as Extract<DomainEventBody, { kind: K }>);
  }
  return out;
}

/** Replace one ship in the snapshot by id. */
function withShip(
  snapshot: CampaignSnapshot,
  shipId: string,
  patch: Partial<Ship>,
): CampaignSnapshot {
  const nations = new Map(snapshot.nations);
  for (const [id, nation] of snapshot.nations) {
    nations.set(id, {
      ...nation,
      fleets: nation.fleets.map((f) => ({
        ...f,
        ships: f.ships.map((s) => (s.id === shipId ? { ...s, ...patch } : s)),
      })),
    });
  }
  return { ...snapshot, nations };
}

export function runS5Acceptance(): S5Observation {
  const base = compileProductionCampaign().state.snapshot;

  // Old = the month with the production section dormant (absent); new = the same month under the fixture section.
  const dormant = run(base, [], null);
  const configured = run(base);
  const shortfalls = bodies(configured, "PresenceShortfall");
  if (shortfalls.length === 0) throw new Error("fixture section produced no shortfall");
  const nationId = shortfalls[0]!.nationId;
  const shortArea = shortfalls[0]!.areaId;
  const nation = base.nations.get(nationId)!;

  // A commissioned, operational, ACTIVE ship of the nation that has a compiled design (known tonnage).
  const candidate = nation.fleets
    .flatMap((f) => f.ships)
    .find(
      (s) =>
        s.readiness === "ACTIVE" &&
        !s.isUnderConstruction &&
        s.availability !== "UNAVAILABLE" &&
        base.designs.has(s.designVersionId) &&
        s.stationAssignment === undefined,
    );
  if (candidate === undefined) throw new Error("no eligible ship");
  const shipTonsKg = base.designs.get(candidate.designVersionId)!.normalizedDisplacementKg;

  // 1. Assignment and clear by command, observed on authoritative state.
  const assigned = run(base, [
    envelope({ type: "AssignForeignStation", nationId, shipIds: [candidate.id] }, base),
  ]);
  const shipIn = (r: MonthResult, id: string) =>
    r.finalSnapshot.nations
      .get(nationId)!
      .fleets.flatMap((f) => f.ships)
      .find((s) => s.id === id)!;
  const assignEvent = bodies(assigned, "ShipStationAssignmentChanged")[0]!;
  const cleared = run(assigned.finalSnapshot, [
    envelope(
      { type: "ClearForeignStation", nationId, shipIds: [candidate.id] },
      assigned.finalSnapshot,
    ),
  ]);
  const clearEvent = bodies(cleared, "ShipStationAssignmentChanged")[0]!;
  const ineligible = run(base, [
    envelope({ type: "ClearForeignStation", nationId, shipIds: [candidate.id] }, base),
  ]);

  // 2. 1.5x weighting: the same ship placed in the short area, plain versus colonial-service on foreign station.
  const placed = withShip(base, candidate.id, { locationAreaId: shortArea });
  const rowOf = (s: CampaignSnapshot) =>
    measurePresence(s, ACCEPTANCE_PRESENCE).find(
      (r) => r.nationId === nationId && r.areaId === shortArea,
    )!;
  const plainRow = rowOf(placed);
  const colonialFs = withShip(placed, candidate.id, {
    colonialServiceFitted: true,
    stationAssignment: "FOREIGN_STATION",
  });
  const colonialRow = rowOf(colonialFs);
  const colonialMonth = run(colonialFs);
  const colonialEvent = bodies(colonialMonth, "PresenceShortfall").find(
    (e) => e.nationId === nationId && e.areaId === shortArea,
  );

  // 3. Reserve and mothballed ships contribute nothing.
  const reserveRow = rowOf(withShip(placed, candidate.id, { readiness: "RESERVE" }));
  const mothRow = rowOf(withShip(placed, candidate.id, { readiness: "MOTHBALLED" }));

  // 4. Blockade exemption and its end.
  const warOf = (status: "ACTIVE" | "ENDED", nid: string) => ({
    id: "fixture-war",
    attackerSideId: "fixture-attackers",
    defenderSideId: "fixture-defenders",
    attackerSideMembers: ["fixture-blockader"],
    defenderSideMembers: [nid],
    attackerWarScore: 0,
    defenderWarScore: 0,
    attackerId: "fixture-blockader",
    defenderId: nid,
    startDate: "1880-01",
    status,
  });
  const blockadeSnapshot = (status: "ACTIVE" | "ENDED", nid = nationId): CampaignSnapshot => ({
    ...base,
    wars: {
      ...base.wars,
      wars: [warOf(status, nid)],
      blockadeState: [
        {
          blockaderId: "fixture-blockader",
          blockadedNationId: nid,
          areaId: shortArea,
          establishedMonth: "1880-01",
        },
      ],
    },
  });
  const involving = (r: MonthResult) =>
    r.eventLedger.all.filter(
      (e) =>
        (e.body.kind === "PresenceShortfall" ||
          e.body.kind === "PrestigeLossRequested" ||
          e.body.kind === "RevoltPressureRequested") &&
        e.body.nationId === nationId,
    ).length;
  const blockaded = run(blockadeSnapshot("ACTIVE"));
  const limited = run(base, [], { ...ACCEPTANCE_PRESENCE, baseLimits: ACCEPTANCE_BASE_LIMITS });
  const flaggedOf = (r: MonthResult) =>
    [...r.finalSnapshot.nations.values()]
      .flatMap((n) => n.fleets.flatMap((f) => f.ships))
      .filter((sh) => sh.overBase !== undefined)
      .map((sh) => sh.id)
      .sort();
  const limitedFlagged = flaggedOf(limited);
  const flaggedNation = [...limited.finalSnapshot.nations.values()].find((n) =>
    n.fleets.some((f) => f.ships.some((sh) => sh.overBase !== undefined)),
  )!.id;
  const blockadedLimited = run(blockadeSnapshot("ACTIVE", flaggedNation), [], {
    ...ACCEPTANCE_PRESENCE,
    baseLimits: ACCEPTANCE_BASE_LIMITS,
  });
  const ended = run(blockadeSnapshot("ENDED"));
  if (!isPresenceExempt(blockadeSnapshot("ACTIVE"), nationId, "1880-01")) {
    throw new Error("expected the fixture blockade to exempt the nation");
  }

  // 5. Routing: a foreign-station ship outside every shortfall area sails one hop toward the largest shortfall.
  const shortKeys = new Set(shortfalls.map((s) => `${s.nationId}/${s.areaId}`));
  let routing: S5Observation["routing"] | undefined;
  for (const sf of shortfalls) {
    const n = base.nations.get(sf.nationId)!;
    const ship = n.fleets
      .flatMap((f) => f.ships)
      .find(
        (s) =>
          s.readiness === "ACTIVE" &&
          !s.isUnderConstruction &&
          s.availability !== "UNAVAILABLE" &&
          !shortKeys.has(`${sf.nationId}/${s.locationAreaId}`),
      );
    if (ship === undefined) continue;
    const stationed = withShip(base, ship.id, { stationAssignment: "FOREIGN_STATION" });
    const rows = measurePresence(base, ACCEPTANCE_PRESENCE).filter(
      (r) => r.nationId === sf.nationId && r.shortfallTons > 0,
    );
    const expected = [...rows].sort(
      (a, b) => b.shortfallTons - a.shortfallTons || (a.areaId < b.areaId ? -1 : 1),
    )[0]!;
    const moved = bodies(run(stationed), "ForeignStationShipMoved").find(
      (e) => e.shipId === ship.id,
    );
    if (moved === undefined) continue;
    const from = String(moved.fromAreaId);
    const to = String(moved.toAreaId);
    routing = {
      shipId: ship.id,
      fromAreaId: from,
      toAreaId: to,
      targetAreaId: String(moved.targetAreaId),
      expectedTargetAreaId: expected.areaId,
      routeAdjacent: base.world.routes.some(
        (r) =>
          r.type === "sea" &&
          ((r.from === from && r.to === to) || (r.to === from && r.from === to)),
      ),
    };
    break;
  }
  if (routing === undefined) throw new Error("no routable foreign-station ship found");

  // 6. Shortfall events and typed penalty requests are events only.
  const prestige = bodies(configured, "PrestigeLossRequested").length;
  const revolt = bodies(configured, "RevoltPressureRequested").length;

  // 7. Over-base flag and consequences.
  const flaggedShips = [...limited.finalSnapshot.nations.values()]
    .flatMap((n) => n.fleets.flatMap((f) => f.ships))
    .filter((s) => s.overBase !== undefined);
  const crewOf = (r: MonthResult, id: string) =>
    [...r.finalSnapshot.nations.values()]
      .flatMap((n) => n.fleets.flatMap((f) => f.ships))
      .find((s) => s.id === id)!.crewQuality;

  return {
    sectionState: "dormant-production-fixture-exercised",
    oldHashes: {
      snapshot: hashSnapshot(dormant.finalSnapshot),
      eventLedger: dormant.eventLedger.hash(),
    },
    newHashes: {
      snapshot: hashSnapshot(limited.finalSnapshot),
      eventLedger: limited.eventLedger.hash(),
    },
    assignment: {
      shipId: candidate.id,
      assignedReason: String(assignEvent.reason),
      assignedValue: String(shipIn(assigned, candidate.id).stationAssignment),
      clearedReason: String(clearEvent.reason),
      clearedValue: String(shipIn(cleared, candidate.id).stationAssignment),
      rejectedCount: ineligible.commandLedger.all.filter((o) => o.type === "rejected").length,
    },
    weighting: {
      areaId: shortArea,
      plainPresentTons: plainRow.presentTons,
      colonialFsPresentTons: colonialRow.presentTons,
      colonialFsEventShortfallTons: colonialEvent?.shortfallTons ?? 0,
      colonialFsRowShortfallTons: colonialRow.shortfallTons,
      shipTons: Math.floor(shipTonsKg / 1000),
    },
    exclusion: {
      activePresentTons: plainRow.presentTons,
      reservePresentTons: reserveRow.presentTons,
      mothballedPresentTons: mothRow.presentTons,
    },
    exemption: {
      nationId,
      eventsBeforeBlockade: involving(configured),
      eventsWhileBlockaded: involving(blockaded),
      eventsAfterWarEnds: involving(ended),
      baseLimitsUnaffectedWhileBlockaded:
        flaggedOf(blockadedLimited).join() === limitedFlagged.join(),
    },
    routing,
    requests: {
      dormantShortfalls: bodies(dormant, "PresenceShortfall").length,
      shortfalls: shortfalls.length,
      prestige,
      revolt,
      stateUnchangedByRequests:
        hashSnapshot(configured.finalSnapshot) === hashSnapshot(dormant.finalSnapshot),
    },
    overBase: {
      flagged: flaggedShips.map((s) => s.id).sort(),
      crewReduced: flaggedShips.some(
        (s) => Number(s.crewQuality) < Number(crewOf(configured, s.id)),
      ),
      flaggedWithoutBlock: [...configured.finalSnapshot.nations.values()]
        .flatMap((n) => n.fleets.flatMap((f) => f.ships))
        .filter((s) => s.overBase !== undefined).length,
    },
  };
}
