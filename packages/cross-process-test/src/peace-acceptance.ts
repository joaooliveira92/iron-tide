import type { CampaignSnapshot } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";
import { Data } from "effect";

import { compileProductionCampaign } from "./production-pack.js";

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

export interface PeaceAcceptanceObservation {
  readonly accept: PeaceObservation;
  readonly propose: PeaceObservation;
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
  return {
    accept: observe(snapshot, { type: "AcceptPeace", nationId: PLAYER, warId: WAR_ID }),
    propose: observe(snapshot, {
      type: "ProposePeace",
      nationId: PLAYER,
      warId: WAR_ID,
      term: { _tag: "StatusQuo" },
    }),
  };
}
