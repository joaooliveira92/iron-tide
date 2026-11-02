import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";
import { Data } from "effect";

import { compileProductionCampaign } from "./production-pack.js";

class CessionAreaMissing extends Data.TaggedError("CessionAreaMissing")<{
  readonly nationId: string;
}> {}

class PeaceFixtureMissing extends Data.TaggedError("PeaceFixtureMissing")<{
  readonly warId: string;
}> {}

const PLAYER = "austria_hungary";
const ENEMY = "italy";
const WAR_ID = "war_peace_acceptance";
const SEED = "peace-acceptance-seed";

export interface PeaceObservation {
  readonly warStatus: string;
  readonly relation: string;
  readonly tension: number;
  readonly snapshotHash: string;
}

export interface CessionObservation {
  readonly areaId: string;
  readonly warStatus: string;
  readonly controllerBefore: string | null;
  readonly controllerAfter: string | null;
  readonly transferredPossessionIds: readonly string[];
  readonly snapshotHash: string;
}

export interface PeaceAcceptanceObservation {
  readonly accept: PeaceObservation;
  readonly propose: PeaceObservation;
  readonly cede: CessionObservation;
}

const CESSION_COST = SafeInt(4);

function pricedCessionBase(base: CampaignSnapshot): { snapshot: CampaignSnapshot; areaId: string } {
  const home = base.nations.get(ENEMY)?.homeAreaId;
  const possessions = base.world.possessions ?? [];
  const area = [...base.world.areas]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .find(
      (candidate) =>
        candidate.controller === ENEMY &&
        candidate.id !== home &&
        possessions.some((p) => p.areaId === candidate.id) &&
        possessions.every((p) => p.areaId !== candidate.id || p.nationId === ENEMY),
    );
  if (area === undefined) throw new CessionAreaMissing({ nationId: ENEMY });
  const priced = atWar(base);
  return {
    areaId: area.id,
    snapshot: {
      ...priced,
      wars: {
        ...priced.wars,
        wars: priced.wars.wars.map((w) => ({ ...w, attackerWarScore: CESSION_COST })),
      },
      world: {
        ...priced.world,
        areas: priced.world.areas.map((a) =>
          a.id === area.id ? { ...a, cessionCost: CESSION_COST } : a,
        ),
      },
    },
  };
}

function observeCession(snapshot: CampaignSnapshot, areaId: string): CessionObservation {
  const result = new MonthExecutor().execute(
    snapshot,
    [
      envelope(
        {
          type: "ProposePeace",
          nationId: PLAYER,
          warId: WAR_ID,
          term: { _tag: "CedeArea", areaId },
        },
        snapshot,
      ),
    ],
    SEED,
    new DiagnosticCollector(),
  );
  const final = result.finalSnapshot;
  const war = final.wars.wars.find((candidate) => candidate.id === WAR_ID);
  return {
    areaId,
    warStatus: war?.status ?? "MISSING",
    controllerBefore: snapshot.world.areas.find((a) => a.id === areaId)?.controller ?? null,
    controllerAfter: final.world.areas.find((a) => a.id === areaId)?.controller ?? null,
    transferredPossessionIds: result.eventLedger.all.flatMap((event) =>
      event.body.kind === "PossessionTransferred" ? [event.body.possessionId] : [],
    ),
    snapshotHash: sha256Hex(canonicalSerialize(final)),
  };
}

function atWar(base: CampaignSnapshot): CampaignSnapshot {
  return {
    ...base,
    wars: {
      ...base.wars,
      wars: [
        {
          id: WAR_ID,
          attackerSideId: "side_a",
          defenderSideId: "side_d",
          attackerSideMembers: [PLAYER],
          defenderSideMembers: [ENEMY],
          attackerWarScore: 0,
          defenderWarScore: 0,
          attackerId: PLAYER,
          defenderId: ENEMY,
          startDate: "1880-01",
          status: "ACTIVE",
        },
      ],
      participantMemberships: [],
      battles: [],
    },
  };
}

function envelope(body: CommandBody, from: CampaignSnapshot): CommandEnvelope<CommandBody> {
  return {
    commandId: "cmd-peace-acceptance",
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(from)),
    idempotencyKey: "ik-peace-acceptance",
    timestamp: "peace-acceptance",
    body,
  };
}

function observe(snapshot: CampaignSnapshot, body: CommandBody): PeaceObservation {
  const result = new MonthExecutor().execute(
    snapshot,
    [envelope(body, snapshot)],
    SEED,
    new DiagnosticCollector(),
  );
  const final = result.finalSnapshot;
  const war = final.wars.wars.find((candidate) => candidate.id === WAR_ID);
  const relation = final.politics.relations.find(
    (candidate) =>
      (candidate.nationA === PLAYER && candidate.nationB === ENEMY) ||
      (candidate.nationA === ENEMY && candidate.nationB === PLAYER),
  );
  if (war === undefined || relation === undefined) throw new PeaceFixtureMissing({ warId: WAR_ID });
  return {
    warStatus: war.status,
    relation: relation.relation,
    tension: relation.tension,
    snapshotHash: sha256Hex(canonicalSerialize(final)),
  };
}

export function runPeaceAcceptance(): PeaceAcceptanceObservation {
  const { state } = compileProductionCampaign();
  const snapshot = atWar(state.snapshot);
  const cession = pricedCessionBase(state.snapshot);
  return {
    cede: observeCession(cession.snapshot, cession.areaId),
    accept: observe(snapshot, { type: "AcceptPeace", nationId: PLAYER, warId: WAR_ID }),
    propose: observe(snapshot, {
      type: "ProposePeace",
      nationId: PLAYER,
      warId: WAR_ID,
      term: { _tag: "StatusQuo" },
    }),
  };
}
