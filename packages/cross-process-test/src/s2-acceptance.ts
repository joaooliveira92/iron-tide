import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { unifiedSnapshotHash, MonthExecutor, type MonthResult } from "@bluewave/phase-engine";

import { compileProductionCampaign } from "./production-pack.js";

const PLAYER = "uk";
const ENEMY = "france";
const AREA = "eng_home_coast";
const SEED = "s2-acceptance-seed";
const SACK_SEED_PREFIX = "s2-acceptance-sack-";
const SEED_LIMIT = 200;
const BATTLE_SEED_PREFIX = "s2-acceptance-battle-";

export interface PrestigeEventObservation {
  readonly nationId: string;
  readonly reasonCode: string;
  readonly ruleKind: string;
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export interface MonthObservation {
  readonly snapshotHash: string;
  readonly eventLedgerHash: string;
  readonly randomLedgerHash: string;
  readonly outcome: string;
  readonly prestige: number;
  readonly events: readonly PrestigeEventObservation[];
  readonly sackingDraws: number;
  readonly careerResult: unknown;
}

export interface S2Observation {
  readonly valueSet: CampaignSnapshot["prestigeRules"];
  readonly seeds: { readonly sacked: string };
  readonly unpaidFunds: MonthObservation;
  readonly battleLost: MonthObservation;
  readonly battleWon: MonthObservation;
  readonly sacked: MonthObservation;
  readonly retained: MonthObservation;
  readonly campaignEnd: MonthObservation;
  readonly repeatedAdvanceOutcome: string;
  readonly playerStartPrestige: number;
  readonly everyNationSeeded: boolean;
}

function execute(snapshot: CampaignSnapshot, seed: string): MonthResult {
  return new MonthExecutor().execute(snapshot, [], seed, new DiagnosticCollector(), undefined, {
    playerNationId: PLAYER,
  });
}

function observe(result: MonthResult): MonthObservation {
  const player = result.finalSnapshot.nations.get(PLAYER)!;
  return {
    snapshotHash: unifiedSnapshotHash(result.finalSnapshot),
    eventLedgerHash: result.eventLedger.hash(),
    randomLedgerHash: result.randomLedger.hash(),
    outcome: result.outcome ?? "completed",
    prestige: Number(player.prestige),
    events: result.eventLedger.all.flatMap((entry) => {
      const body = entry.body;
      if (body.kind !== "PrestigeChanged") return [];
      return [
        {
          nationId: body.nationId,
          reasonCode: body.reasonCode,
          ruleKind: body.ruleKind,
          before: body.before,
          after: body.after,
          delta: body.delta,
        },
      ];
    }),
    sackingDraws: result.randomLedger.all.filter((d) => d.streamId === "prestige_sacking").length,
    careerResult: result.finalSnapshot.careerResult ?? null,
  };
}

function withPlayer(snapshot: CampaignSnapshot, patch: Partial<NationState>): CampaignSnapshot {
  const nations = new Map(snapshot.nations);
  nations.set(PLAYER, { ...nations.get(PLAYER)!, ...patch });
  return { ...snapshot, nations };
}

function warSnapshot(
  base: CampaignSnapshot,
  firepower: { readonly player: number; readonly enemy: number },
): CampaignSnapshot {
  const nations = new Map<string, NationState>(base.nations);
  for (const id of [PLAYER, ENEMY]) {
    const nation = nations.get(id)!;
    const ships = nation.fleets
      .flatMap((fleet) => fleet.ships)
      .slice(0, 2)
      .map((ship) => ({
        ...ship,
        locationAreaId: AREA,
        firepower: SafeInt(id === PLAYER ? firepower.player : firepower.enemy),
        hitPoints: ship.maxHitPoints,
        isUnderConstruction: false,
        readiness: "ACTIVE" as const,
        crewQuality: SafeInt(100),
      }));
    nations.set(id, {
      ...nation,
      fleets: [
        { id: `fleet-${id}`, nationId: id, name: `${id} fleet`, ships, locationAreaId: AREA },
      ],
    });
  }
  return {
    ...base,
    nations,
    wars: {
      ...base.wars,
      wars: [
        {
          id: "war_s2",
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
      battles: [],
    },
  };
}

function battleWith(snapshot: CampaignSnapshot, reasonCode: string): MonthObservation {
  for (let i = 0; i < SEED_LIMIT; i++) {
    const observation = observe(execute(snapshot, `${BATTLE_SEED_PREFIX}${String(i)}`));
    if (observation.events.some((e) => e.reasonCode === reasonCode)) return observation;
  }
  throw new Error(`no seed produced ${reasonCode}`);
}

export function runS2Acceptance(): S2Observation {
  const { state } = compileProductionCampaign();
  const base = state.snapshot;
  const rules = base.prestigeRules;
  const threshold = Number(rules.sackingThreshold);

  const unpaidFunds = observe(
    execute(withPlayer(base, { treasury: SafeInt(0), expenses: SafeInt(900_000_000) }), SEED),
  );
  const war = warSnapshot(base, { player: 300, enemy: 200 });
  const battleLost = battleWith(war, "BATTLE_LOST");
  const battleWon = battleWith(war, "BATTLE_WON");

  const atRisk = withPlayer(base, { prestige: SafeInt(threshold) });
  let sackedSeed = "";
  let sackedResult: MonthResult | undefined;
  let retained: MonthResult | undefined;
  for (let i = 0; i < SEED_LIMIT && (sackedResult === undefined || retained === undefined); i++) {
    const seed = `${SACK_SEED_PREFIX}${String(i)}`;
    const result = execute(atRisk, seed);
    if (result.finalSnapshot.careerResult !== undefined) {
      if (sackedResult === undefined) {
        sackedResult = result;
        sackedSeed = seed;
      }
    } else if (retained === undefined) {
      retained = result;
    }
  }
  if (sackedResult === undefined || retained === undefined) {
    throw new Error("no seed produced both a sack and a retained career");
  }

  const finalMonth: CampaignSnapshot = {
    ...base,
    startYear: 1970,
    startMonth: 11,
    turnNumber: SafeInt(0),
  };
  const ended = execute(finalMonth, SEED);
  const repeated = execute(ended.finalSnapshot, SEED);

  return {
    valueSet: rules,
    seeds: { sacked: sackedSeed },
    unpaidFunds,
    battleLost,
    battleWon,
    sacked: observe(sackedResult),
    retained: observe(retained),
    campaignEnd: observe(ended),
    repeatedAdvanceOutcome: repeated.outcome ?? "completed",
    playerStartPrestige: Number(base.nations.get(PLAYER)!.prestige),
    everyNationSeeded: [...base.nations.values()].every(
      (nation) =>
        Number.isSafeInteger(nation.prestige) &&
        nation.prestige >= rules.lowerBound &&
        nation.prestige <= rules.upperBound,
    ),
  };
}

export function s2ObservationHash(observation: S2Observation): string {
  return sha256Hex(canonicalSerialize(observation));
}
