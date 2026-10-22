import type { RawScriptedForceOrder } from "@bluewave/campaign-engine";

const DEFAULT_SCRIPTED_ORDERS: readonly RawScriptedForceOrder[] = [
  {
    issueTurn: 1,
    divisionId: "Channel Squadron",
    orderType: "change_lead_division",
    newLeadShipId: "HMS Majestic",
  },
];

export const DEFAULT_SCRIPTED_ORDERS_TEXT = JSON.stringify(DEFAULT_SCRIPTED_ORDERS, null, 2);

export type ParseScriptedOrdersResult =
  | { readonly ok: true; readonly orders: readonly RawScriptedForceOrder[] }
  | { readonly ok: false; readonly error: string };

export function parseScriptedOrders(text: string): ParseScriptedOrdersResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Scripted orders must be a JSON array." };
  }

  for (const [index, entry] of parsed.entries()) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as Record<string, unknown>)["issueTurn"] !== "number" ||
      typeof (entry as Record<string, unknown>)["divisionId"] !== "string" ||
      typeof (entry as Record<string, unknown>)["orderType"] !== "string"
    ) {
      return {
        ok: false,
        error: `Order at index ${index} must include numeric issueTurn, divisionId, orderType.`,
      };
    }
  }

  return { ok: true, orders: parsed as readonly RawScriptedForceOrder[] };
}
