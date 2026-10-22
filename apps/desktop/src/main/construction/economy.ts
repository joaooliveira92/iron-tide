import { buildPlayerProjection } from "@bluewave/campaign-engine";
import {
  DOCK_EXPANSION_BASE_DURATION_MONTHS,
  DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP,
  builderDockRecord,
  constructionCapacityUtilization,
  dockExpansionEraStepForMonth,
  dockExpansionFinalDurationMonths,
  nationalConstructionCapacity,
} from "@bluewave/phase-engine";
import type { ConstructionScreenProjection } from "../../shared/construction-contract.js";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import { loadShipBuildingContent } from "../shipBuildingContent.js";
import { campaignMonthKey } from "./commandRecord.js";

export function constructionEconomy(
  record: CampaignSessionRecord,
): ConstructionScreenProjection["economy"] {
  const projection = buildPlayerProjection(record.state, record.playerSlotId, record.month);
  const nation = record.state.snapshot.nations.get(record.playerSlotId);
  const treasury = projection ? projection.economy.treasury : nation ? Number(nation.treasury) : 0;
  const monthlyAppropriation = projection ? projection.economy.monthlyAppropriation : 0;
  const shipyardCapacity = projection ? projection.economy.shipyardCapacity : 0;

  const snapshot = record.state.snapshot;
  const content = loadShipBuildingContent();
  const monthId = campaignMonthKey(record);

  const dock = builderDockRecord(snapshot, record.playerSlotId, content, monthId);
  const dockMaxBuildDisplacementKg = dock?.maximumNewConstructionMassKg ?? null;

  const balance = content.environmentFor(monthId, record.playerSlotId).constructionBalance;
  const capacity = nationalConstructionCapacity(balance, dockMaxBuildDisplacementKg ?? 0);
  const utilization = constructionCapacityUtilization(snapshot, record.playerSlotId, capacity);

  const dockPossessions = snapshot.world.ports
    .filter((port) => port.nationId === record.playerSlotId)
    .map((port) => ({ id: port.id, name: port.name }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    treasury,
    monthlyAppropriation,
    shipyardCapacity,
    dockMaxBuildDisplacementKg,
    maxConcurrentConstructionMassKg: utilization.maxConcurrentMassKg,
    committedNewConstructionMassKg: utilization.committedMassKg,
    exemptNewConstructionMassKg: utilization.exemptMassKg,
    dockExpansionDurationMonths: dockExpansionFinalDurationMonths(
      DOCK_EXPANSION_BASE_DURATION_MONTHS,
      DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP,
    ),
    dockExpansionNextStepKg: dockExpansionEraStepForMonth(monthId),
    dockPossessions,
  };
}
