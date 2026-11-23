import {
  countEnemySubmarines,
  isRaiderBlockedByBlockade,
  submarineEscortCounts,
  submarinePolicyOf,
  submarineQuotaTerm,
  submarineTradeChanceStages,
  type BlockadeState,
  type SubmarinePolicy,
  type SubmarineShip,
  type SubmarineThreatRules,
  type TradeDutyDesign,
  type TradeDutyShip,
  type TradeProtectionRules,
  type WarDeclaration,
} from "@bluewave/campaign";
import { compareCodePoints } from "@bluewave/deterministic";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

export const SUBMARINE_TRADE_FORMULA_VERSION = "submarine_trade_v1";

const ROOT_ID = "submarine_trade";
const BP_FULL = 10_000;
const RULE_SOURCE = { kind: "ruleset", ref: "trade_protection" } as const;
const CODE_SOURCE = { kind: "code", ref: "packages/campaign/src/submarineThreat.ts" } as const;

export type SubmarineTradeShip = SubmarineShip & TradeDutyShip;

export interface SubmarineTradeAttacker {
  readonly nationId: string;
  readonly policy: SubmarinePolicy;
  readonly ships: readonly SubmarineTradeShip[];
}

export interface SubmarineTradeExplanationInput {
  readonly rules: Pick<
    TradeProtectionRules,
    "shortfallAmplifyBp" | "contributingHullTypes" | "amcHullType"
  > & { readonly submarineThreat?: SubmarineThreatRules | undefined };
  readonly victimId: string;
  readonly victimShortfallBp: number;
  readonly victimShips: readonly TradeDutyShip[];
  readonly attackers: readonly SubmarineTradeAttacker[];
  readonly blockades: readonly Pick<BlockadeState, "blockaderId" | "blockadedNationId">[];
  readonly designs: ReadonlyMap<string, TradeDutyDesign>;
}

export interface SubmarineTradeExplanation {
  readonly tree: ExplanationTree;
  readonly chancesBp: ReadonlyMap<string, number>;
}

export function submarineTradeAttackers(
  wars: readonly Pick<
    WarDeclaration,
    "id" | "status" | "attackerSideMembers" | "defenderSideMembers"
  >[],
  nations: ReadonlyMap<
    string,
    {
      readonly fleets: readonly { readonly ships: readonly SubmarineTradeShip[] }[];
      readonly submarinePolicy?: SubmarinePolicy | undefined;
    }
  >,
  victimId: string,
): SubmarineTradeAttacker[] {
  const attackers: SubmarineTradeAttacker[] = [];
  const seen = new Set<string>();
  const active = wars
    .filter((war) => war.status === "ACTIVE")
    .sort((a, b) => compareCodePoints(a.id, b.id));
  for (const war of active) {
    const victimAttacks = war.attackerSideMembers.includes(victimId);
    const victimDefends = war.defenderSideMembers.includes(victimId);
    if (!victimAttacks && !victimDefends) continue;
    const opponents = [...(victimAttacks ? war.defenderSideMembers : war.attackerSideMembers)].sort(
      compareCodePoints,
    );
    for (const nationId of opponents) {
      const nation = nations.get(nationId);
      if (seen.has(nationId) || nation === undefined) continue;
      seen.add(nationId);
      attackers.push({
        nationId,
        policy: submarinePolicyOf(nation),
        ships: nation.fleets
          .flatMap((fleet) => fleet.ships)
          .sort((a, b) => compareCodePoints(a.id, b.id)),
      });
    }
  }
  return attackers;
}

function stage(
  attackerId: string,
  name: string,
  version: string,
  result: number,
  operation: "identity" | "add" | "multiply" | "clamp",
): ExplanationBuilder {
  return new ExplanationBuilder(`${ROOT_ID}.attacker.${attackerId}.${name}`, version)
    .withResult(result)
    .withUnit("bp")
    .withOperation(operation)
    .withSource(CODE_SOURCE);
}

function attackerTree(
  input: SubmarineTradeExplanationInput,
  threat: SubmarineThreatRules,
  attacker: SubmarineTradeAttacker,
  submarines: number,
  counts: { readonly aswEscorts: number; readonly qShips: number },
): { readonly tree: ExplanationTree; readonly finalBp: number } {
  const version = SUBMARINE_TRADE_FORMULA_VERSION;
  const blockaded = isRaiderBlockedByBlockade(input.blockades, attacker.nationId, input.victimId);
  const stages = submarineTradeChanceStages(
    { shortfallAmplifyBp: input.rules.shortfallAmplifyBp, submarineThreat: threat },
    input.victimShortfallBp,
    blockaded,
    attacker.policy,
    counts,
  );
  const builder = new ExplanationBuilder(`${ROOT_ID}.attacker.${attacker.nationId}`, version)
    .withInput("nationId", attacker.nationId)
    .withInput("policy", attacker.policy)
    .withInput("submarines", submarines)
    .withResult(stages.finalBp)
    .withUnit("bp")
    .withOperation("identity")
    .withSource(RULE_SOURCE)
    .addChild(
      stage(attacker.nationId, "base", version, stages.attackBp, "identity")
        .withInput("attackBp", threat.attackBp)
        .withSource(RULE_SOURCE)
        .build(),
    )
    .addChild(
      stage(attacker.nationId, "shortfall", version, stages.baseBp, "add")
        .withInput("shortfallBp", input.victimShortfallBp)
        .withInput("shortfallAmplifyBp", input.rules.shortfallAmplifyBp)
        .withIntermediate("shortfallTermBp", stages.shortfallTermBp)
        .build(),
    )
    .addChild(
      stage(attacker.nationId, "policy", version, stages.amplifiedBp, "multiply")
        .withInput("policy", attacker.policy)
        .withInput("multiplierBp", stages.policyMultiplierBp ?? BP_FULL)
        .build(),
    )
    .addChild(
      stage(attacker.nationId, "cap", version, stages.cappedBp, "clamp")
        .withInput("capBp", BP_FULL)
        .build(),
    )
    .addChild(
      stage(attacker.nationId, "blockade", version, stages.blockadedBp, "multiply")
        .withInput("blockaded", blockaded ? 1 : 0)
        .withInput("reductionBp", blockaded ? threat.blockadeReductionBp : 0)
        .build(),
    )
    .addChild(
      stage(attacker.nationId, "asw_escort", version, stages.aswEscortedBp, "multiply")
        .withInput("escorts", counts.aswEscorts)
        .withInput("reductionBp", threat.aswEscortReductionBp ?? 0)
        .build(),
    )
    .addChild(
      stage(attacker.nationId, "q_ship", version, stages.finalBp, "multiply")
        .withInput("qShips", counts.qShips)
        .withInput("reductionBp", threat.qShipReductionBp ?? 0)
        .build(),
    );
  if (attacker.policy === "UNRESTRICTED" && threat.unrestricted !== undefined) {
    builder.addChild(
      stage(attacker.nationId, "incident", version, threat.unrestricted.incidentBp, "identity")
        .withInput("incidentBp", threat.unrestricted.incidentBp)
        .withSource(RULE_SOURCE)
        .build(),
    );
  }
  return { tree: builder.build(), finalBp: stages.finalBp };
}

export function explainSubmarineTrade(
  input: SubmarineTradeExplanationInput,
): SubmarineTradeExplanation | undefined {
  const threat = input.rules.submarineThreat;
  if (threat === undefined) return undefined;
  const armed = input.attackers
    .map((attacker) => ({
      attacker,
      submarines: countEnemySubmarines(threat, attacker.ships, input.designs),
    }))
    .filter((entry) => entry.submarines > 0)
    .sort((a, b) => compareCodePoints(a.attacker.nationId, b.attacker.nationId));
  if (armed.length === 0) return undefined;

  const counts = submarineEscortCounts(
    {
      contributingHullTypes: input.rules.contributingHullTypes,
      amcHullType: input.rules.amcHullType,
      submarineThreat: threat,
    },
    input.victimShips,
    input.designs,
  );
  const enemySubmarines = armed.reduce((total, entry) => total + entry.submarines, 0);
  const fleetSupportSubmarines = armed.reduce(
    (total, entry) =>
      entry.attacker.policy === "FLEET_SUPPORT" ? total + entry.submarines : total,
    0,
  );
  const quotaBuilder = new ExplanationBuilder(`${ROOT_ID}.quota`, SUBMARINE_TRADE_FORMULA_VERSION)
    .withInput("enemySubmarines", enemySubmarines)
    .withInput("fleetSupportSubmarines", fleetSupportSubmarines)
    .withInput("quotaPerBoatBp", threat.quotaPerBoatBp)
    .withResult(submarineQuotaTerm(threat, enemySubmarines, fleetSupportSubmarines))
    .withUnit("ships")
    .withOperation("multiply")
    .withSource(RULE_SOURCE);
  if (threat.fleetSupport?.quotaMultiplierBp !== undefined) {
    quotaBuilder.withInput("quotaMultiplierBp", threat.fleetSupport.quotaMultiplierBp);
  }

  const root = new ExplanationBuilder(ROOT_ID, SUBMARINE_TRADE_FORMULA_VERSION)
    .withInput("victimId", input.victimId)
    .withInput("shortfallBp", input.victimShortfallBp)
    .withInput("shortfallAmplifyBp", input.rules.shortfallAmplifyBp)
    .withResult(enemySubmarines)
    .withUnit("boats")
    .withOperation("identity")
    .withSource(RULE_SOURCE)
    .addChild(quotaBuilder.build());
  const chancesBp = new Map<string, number>();
  for (const { attacker, submarines } of armed) {
    const built = attackerTree(input, threat, attacker, submarines, counts);
    chancesBp.set(attacker.nationId, built.finalBp);
    root.addChild(built.tree);
  }
  return { tree: root.build(), chancesBp };
}
