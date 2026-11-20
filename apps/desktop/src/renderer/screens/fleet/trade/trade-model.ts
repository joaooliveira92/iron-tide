import type {
  FleetScreenProjection,
  FleetTradeProjection,
} from "../../../../shared/fleet-contract.js";
import type { RequestLifecycle } from "../../../lib/command-screen-workflow.js";
import { translate } from "../../../lib/strings.js";

export interface TradeState extends RequestLifecycle {
  readonly trade: FleetTradeProjection | null;
}

export function initialTradeState(): TradeState {
  return {
    revision: 0,
    trade: null,
    pendingRequest: null,
    requiresRefresh: false,
    notice: null,
  };
}

export function projectTrade(projection: FleetScreenProjection): Partial<TradeState> {
  return { trade: projection.trade ?? null };
}

const REASON_CODES: ReadonlySet<string> = new Set([
  "UNDER_CONSTRUCTION",
  "NOT_OPERATIONAL",
  "NOT_ACTIVE",
  "ALREADY_ASSIGNED",
  "NOT_OWNED",
  "NOT_ASSIGNED",
  "EMPTY_BATCH",
  "DUPLICATE_SHIP",
]);

export function percentOfBp(bp: number): number {
  return Math.round(bp / 100);
}

export function explainTradeRejection(
  diagnostics: readonly string[],
  names: ReadonlyMap<string, string>,
): string[] {
  const lines: string[] = [translate("fleet.trade.rejected")];
  for (const diagnostic of diagnostics) {
    const detail = diagnostic.includes(": ")
      ? diagnostic.slice(diagnostic.indexOf(": ") + 2)
      : diagnostic;
    const pairs = detail.split(", ").map((part) => part.split("="));
    if (pairs.every((pair) => pair.length === 2 && REASON_CODES.has(pair[1]!))) {
      for (const [id, code] of pairs as [string, string][]) {
        const name = id === "<batch>" || id === "" ? "" : (names.get(id) ?? id);
        lines.push(translate(`fleet.trade.reason.${code}`, { name }));
      }
    } else lines.push(diagnostic);
  }
  return lines;
}
