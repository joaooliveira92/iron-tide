import { SUBMARINE_POLICY_DORMANT, type NationState } from "@bluewave/campaign";
import type { CommandBody, SetSubmarinePolicyCommand } from "@bluewave/commands";
import type { PhaseContext } from "./pipeline.js";

export function applySubmarinePolicyCommand(ctx: PhaseContext, body: CommandBody): boolean {
  if (body["type"] !== "SetSubmarinePolicy") return false;
  const command = body as SetSubmarinePolicyCommand;
  const refuse = (code: string, message: string) =>
    ctx.collector.addError(code, message, {
      stage: "command-collection",
      entityId: command["nationId"],
    });
  if (ctx.engineOptions?.tradeProtection?.submarineThreat?.unrestricted === undefined) {
    refuse(
      SUBMARINE_POLICY_DORMANT,
      "Submarine policy is not available: unrestricted warfare is not authored",
    );
    return true;
  }
  const nation = ctx.snapshot.current["nations"].get(command["nationId"]);
  if (nation === undefined) {
    refuse("NATION_NOT_FOUND", `Nation ${command["nationId"]} not found`);
    return true;
  }
  const { submarinePolicy: _previous, ...rest } = nation;
  const next: NationState =
    command["policy"] === "UNRESTRICTED" ? { ...rest, submarinePolicy: "UNRESTRICTED" } : rest;
  const nations = new Map(ctx.snapshot.current["nations"]);
  nations.set(command["nationId"], next);
  ctx.snapshot.current = { ...ctx.snapshot.current, nations };
  return true;
}
