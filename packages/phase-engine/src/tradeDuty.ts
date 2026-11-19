import {
  TRADE_DUTY_ASSIGNED_REASON,
  TRADE_DUTY_CLEARED_REASON,
  TRADE_DUTY_DORMANT,
  TRADE_DUTY_REJECTED,
  tradeDutyProblems,
  withTradeDuty,
  type NationState,
} from "@bluewave/campaign";
import type { CommandBody, SetTradeDutyCommand } from "@bluewave/commands";
import { shipStationAssignmentChangedEvent } from "./events.js";
import type { PhaseContext } from "./pipeline.js";

const NO_ASSIGNMENT = "NONE";

export function applyTradeDutyCommand(ctx: PhaseContext, body: CommandBody): boolean {
  if (body["type"] !== "SetTradeDuty") return false;
  const command = body as SetTradeDutyCommand;
  const refuse = (code: string, message: string) =>
    ctx.collector.addError(code, message, {
      stage: "command-collection",
      entityId: command["nationId"],
    });
  if (ctx.engineOptions?.tradeProtection === undefined) {
    refuse(TRADE_DUTY_DORMANT, "Trade duty is not available: the section is not authored");
    return true;
  }
  const nation = ctx.snapshot.current["nations"].get(command["nationId"]);
  if (nation === undefined) {
    refuse("NATION_NOT_FOUND", `Nation ${command["nationId"]} not found`);
    return true;
  }
  const problems = tradeDutyProblems(
    nation,
    command["nationId"],
    command["shipIds"],
    command["duty"],
  );
  if (problems.length > 0) {
    refuse(
      TRADE_DUTY_REJECTED,
      `Trade duty no longer applies: ${problems
        .map((p) => `${p.shipId || "<batch>"}=${p.reason}`)
        .join(", ")}`,
    );
    return true;
  }
  const targets = new Set(command["shipIds"]);
  const previous = new Map<string, string>();
  const fleets = nation["fleets"].map((fleet) => ({
    ...fleet,
    ships: fleet["ships"].map((ship) => {
      if (!targets.has(ship["id"])) return ship;
      previous.set(ship["id"], ship["stationAssignment"] ?? NO_ASSIGNMENT);
      return withTradeDuty(ship, command["duty"]);
    }),
  }));
  const nations = new Map(ctx.snapshot.current["nations"]);
  nations.set(command["nationId"], { ...nation, fleets } satisfies NationState);
  ctx.snapshot.current = { ...ctx.snapshot.current, nations };
  const reason =
    command["duty"] === "NONE" ? TRADE_DUTY_CLEARED_REASON : TRADE_DUTY_ASSIGNED_REASON;
  for (const shipId of [...targets].sort()) {
    ctx.eventLedger.append(
      shipStationAssignmentChangedEvent(
        shipId,
        command["nationId"],
        previous.get(shipId) ?? NO_ASSIGNMENT,
        command["duty"],
        reason,
        ctx.nextSeq(),
        ctx.campaignMonth,
      ),
    );
  }
  return true;
}
