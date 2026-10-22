import type { RawScriptedForceOrder } from "@bluewave/campaign-engine";

export const SCRIPTED_TACTICAL_ORDERS: readonly RawScriptedForceOrder[] = [
  {
    issueTurn: 1,
    divisionId: "Channel Squadron",
    orderType: "change_lead_division",
    newLeadShipId: "HMS Majestic",
  },
  { issueTurn: 1, divisionId: "Channel Squadron", orderType: "target_ship" },
  {
    issueTurn: 1,
    divisionId: "Cruiser Squadron",
    orderType: "flotilla_attack",
    targetDivisionId: "Scouting Group",
  },
  {
    issueTurn: 2,
    divisionId: "High Seas Squadron",
    orderType: "rally",
    rallyPoint: { x: 500, y: 500 },
  },
  { issueTurn: 3, divisionId: "Scouting Group", orderType: "disengage" },
];
