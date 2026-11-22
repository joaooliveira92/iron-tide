import type { CampaignSlot, CampaignSnapshot, TradeProtectionRules } from "@bluewave/campaign";
import type {
  CommandBody,
  CommandEnvelope,
  CommandIdempotencyMap,
  CommandLifecycle,
} from "@bluewave/commands";
import type { WarDeclarationRules } from "@bluewave/content-schema";
import type { Diagnostic } from "@bluewave/diagnostics";
import type { AiCommandGenerator } from "./aiCommandGenerator.js";
import { decideTradeDuty } from "./tradeDutyBehaviour.js";
import { decideWarDeclaration, decideWarSorties, fleetAreasOf } from "./warBehaviour.js";

export interface AiWarOptions {
  readonly rules: WarDeclarationRules;
  readonly tradeProtection?: TradeProtectionRules | undefined;
  readonly playerNationId: string;
}

export interface AiWarPlan {
  readonly envelopes: CommandEnvelope<CommandBody>[];
  readonly accepted: CommandEnvelope<CommandBody>[];
  readonly diagnostics: Diagnostic[];
}

function isLiveWarAgainst(snapshot: CampaignSnapshot, nationId: string, enemyId: string): boolean {
  return snapshot.wars.wars.some(
    (w) =>
      (w.status === "ACTIVE" || w.status === "DECLARED_NOT_ACTIVE") &&
      ((w.attackerId === nationId && w.defenderId === enemyId) ||
        (w.attackerId === enemyId && w.defenderId === nationId)),
  );
}

export function planWar(
  generator: AiCommandGenerator,
  snapshot: CampaignSnapshot,
  lifecycle: CommandLifecycle,
  slot: CampaignSlot,
  idempotencyMap: CommandIdempotencyMap,
  nationId: string,
  options: AiWarOptions,
): AiWarPlan {
  const plan: AiWarPlan = { envelopes: [], accepted: [], diagnostics: [] };
  const enemyId = options.playerNationId;
  if (enemyId === nationId) return plan;

  const submit = (envelope: CommandEnvelope<CommandBody>): void => {
    plan.envelopes.push(envelope);
    const outcome = lifecycle.process(envelope, snapshot, slot, idempotencyMap);
    if (outcome.type === "success") {
      plan.accepted.push(envelope);
      return;
    }
    const diagnostic = (outcome as { diagnostic?: Diagnostic }).diagnostic;
    plan.diagnostics.push(
      diagnostic ?? {
        code: "AI_UNKNOWN_REJECTION" as Diagnostic["code"],
        severity: "error",
        stage: "ai_planning",
        message: `War command rejected without diagnostic: ${outcome.type}`,
        entityId: nationId,
      },
    );
  };

  let engaged = isLiveWarAgainst(snapshot, nationId, enemyId);
  if (!engaged) {
    const decision = decideWarDeclaration(snapshot, nationId, enemyId, options.rules);
    if (decision.declare) {
      const before = plan.accepted.length;
      submit(generator.buildDeclareWarCommand(nationId, enemyId));
      engaged = plan.accepted.length > before;
    }
  }

  const sorties = engaged ? decideWarSorties(snapshot, nationId, enemyId) : [];
  if (options.tradeProtection !== undefined) {
    const duty = decideTradeDuty(snapshot, nationId, enemyId, options.tradeProtection, {
      engaged,
      sortieFleetIds: new Set(sorties.map((sortie) => sortie.fleetId)),
      enemyAreas: new Set(fleetAreasOf(snapshot, enemyId)),
    });
    if (duty.release.length > 0)
      submit(generator.buildSetTradeDutyCommand(nationId, duty.release, "NONE"));
    if (duty.assign.length > 0)
      submit(generator.buildSetTradeDutyCommand(nationId, duty.assign, "TRADE_PROTECTION"));
  }
  if (!engaged) return plan;

  for (const sortie of sorties) {
    submit(generator.buildMoveFleetCommand(nationId, sortie.fleetId, sortie.toAreaId));
  }
  return plan;
}
