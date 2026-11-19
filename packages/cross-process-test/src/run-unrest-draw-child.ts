import type { CampaignSnapshot, NationState, WarState } from "@bluewave/campaign";
import { unrestFromRulesets } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor, unifiedSnapshotHash } from "@bluewave/phase-engine";

import { compileProductionCampaign } from "./production-pack.js";

const PLAYER = "uk";
const SEEDS = 12;

interface SeedRecord {
  readonly seed: string;
  readonly snapshotHash: string;
  readonly randomLedgerHash: string;
  readonly draws: readonly string[];
  readonly careerResult: string;
  readonly endedWars: number;
  readonly consequences: readonly string[];
}

function atThreshold(nation: NationState, unrest: number): NationState {
  return { ...nation, unrest };
}

function warBetween(attackerId: string, defenderId: string, month: string): WarState {
  return {
    wars: [
      {
        id: "unrest-war",
        attackerSideId: "a",
        defenderSideId: "d",
        attackerSideMembers: [attackerId],
        defenderSideMembers: [defenderId],
        attackerWarScore: 0,
        defenderWarScore: 0,
        attackerId,
        defenderId,
        startDate: month,
        status: "ACTIVE",
      },
    ],
    battles: [],
    participantMemberships: [attackerId, defenderId].map((nationId) => ({
      warId: "unrest-war",
      nationId,
      sideId: nationId === attackerId ? "a" : "d",
      status: "ACTIVE" as const,
      entryMonth: month,
      nationalContributionPoints: 0,
    })),
    blockadeState: [],
    battleManifests: [],
  };
}

function run(): readonly SeedRecord[] | { readonly error: string } {
  const { state, bundle } = compileProductionCampaign();
  const decoded = unrestFromRulesets(bundle.rulesets);
  if (decoded === undefined) return { error: "production rulesets carry no unrest section" };
  if (!decoded.ok) return { error: `unrest section invalid: ${decoded.field}` };
  const unrest = decoded.value;
  const base = state.snapshot;
  const rival = [...base.nations.keys()].filter((id) => id !== PLAYER).sort()[0];
  if (rival === undefined) return { error: "production campaign has no rival nation" };
  const month = `${base.startYear - 1}-10`;
  const nations = new Map(
    [...base.nations].map(([id, nation]) => [id, atThreshold(nation, unrest.revolutionThreshold)]),
  );
  const start: CampaignSnapshot = { ...base, nations, wars: warBetween(rival, PLAYER, month) };
  const records: SeedRecord[] = [];
  for (let index = 0; index < SEEDS; index += 1) {
    const seed = `unrest-draw-cross-process-${index}`;
    const result = new MonthExecutor().execute(
      start,
      [],
      seed,
      new DiagnosticCollector(),
      undefined,
      {
        playerNationId: PLAYER,
        unrest,
      },
    );
    records.push({
      seed,
      snapshotHash: unifiedSnapshotHash(result.finalSnapshot),
      randomLedgerHash: result.randomLedger.hash(),
      draws: result.randomLedger.all
        .filter((draw) => draw.streamId === "unrest_revolution")
        .map((draw) => `${draw.entityKey}:${draw.outcome}`),
      careerResult: result.finalSnapshot.careerResult?.reason ?? "NONE",
      endedWars: result.finalSnapshot.wars.wars.filter((war) => war.status === "ENDED").length,
      consequences: result.eventLedger.all.flatMap((envelope) =>
        envelope.body.kind === "UnrestConsequence"
          ? [`${envelope.body.nationId}:${envelope.body.consequence}`]
          : [],
      ),
    });
  }
  return records;
}

try {
  const outcome = run();
  const output =
    "error" in outcome
      ? { success: false, error: outcome.error }
      : { success: true, seeds: outcome };
  process.stdout.write(JSON.stringify(output) + "\n");
} catch (err) {
  process.stdout.write(JSON.stringify({ success: false, error: String(err) }) + "\n");
}
