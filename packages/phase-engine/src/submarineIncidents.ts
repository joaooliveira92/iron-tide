import {
  countEnemySubmarines,
  submarinePolicyOf,
  TENSION_MAX,
  type NationState,
  type TradeDutyDesign,
} from "@bluewave/campaign";
import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import type { PhaseContext } from "./pipeline.js";
import { designMap, shipsOf } from "./tradeWarContext.js";

export const SUBMARINE_INCIDENT_STREAM_FAMILY = "diplomacy/submarine_incident";
export const SUBMARINE_INCIDENT_REASON = "SUBMARINE_INCIDENT";
const INCIDENT_DRAW_RANGE_BP = 10_000;

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("\u0000");
}

export function applySubmarineIncidentsForMonth(ctx: PhaseContext): void {
  const threat = ctx.engineOptions?.tradeProtection?.submarineThreat;
  const unrestricted = threat?.unrestricted;
  if (threat === undefined || unrestricted === undefined) return;
  const nations = ctx.snapshot.read("nations");
  const politics = ctx.snapshot.read("politics");
  const designs: ReadonlyMap<string, TradeDutyDesign> = designMap(ctx);
  const raiding = (nation: NationState | undefined): boolean =>
    nation !== undefined &&
    submarinePolicyOf(nation) === "UNRESTRICTED" &&
    countEnemySubmarines(threat, shipsOf(nation), designs) > 0;
  const relations = [...politics.relations];
  const engine = ctx.rng.engine();
  const rulesetVersion = ctx.snapshot.read("rulesetVersion");
  let changed = false;

  const order = relations
    .map((relation, index) => ({
      relation,
      index,
      key: pairKey(relation.nationA, relation.nationB),
    }))
    .sort((a, b) => compareCodePoints(a.key, b.key));

  for (const { relation, index, key } of order) {
    if (relation.relation !== "neutral" && relation.relation !== "trade_agreement") continue;
    if (relation.tension >= TENSION_MAX) continue;
    if (!raiding(nations.get(relation.nationA)) && !raiding(nations.get(relation.nationB))) {
      continue;
    }
    const entityKey = key.replace("\u0000", "|");
    const draw = Math.floor(
      engine
        .stream(`${SUBMARINE_INCIDENT_STREAM_FAMILY}/${entityKey}/${ctx.campaignMonth}`)
        .next() * INCIDENT_DRAW_RANGE_BP,
    );
    const hit = draw < unrestricted.incidentBp;
    ctx.randomLedger.record({
      streamId: SUBMARINE_INCIDENT_STREAM_FAMILY,
      entityKey,
      phase: "resolve_diplomacy",
      rulesetVersion,
      inputHash: sha256Hex(
        canonicalSerialize({
          pair: entityKey,
          campaignMonth: ctx.campaignMonth,
          relation: relation.relation,
          tension: relation.tension,
          incidentBp: unrestricted.incidentBp,
        }),
      ),
      draw,
      outcome: hit ? "HIT" : "MISS",
      reasonCode: SUBMARINE_INCIDENT_REASON,
    });
    if (!hit) continue;
    relations[index] = { ...relation, tension: relation.tension + 1 };
    changed = true;
  }

  if (!changed) return;
  ctx.snapshot.write("politics", { ...politics, relations });
}
