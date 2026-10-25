import {
  completeFleetExercise,
  exerciseLimitReached,
  exerciseMonthAfter,
  exerciseProblems,
  FLEET_EXERCISE_DORMANT,
  FLEET_EXERCISE_LIMIT_REACHED,
  FLEET_EXERCISE_REJECTED,
  scheduleFleetExercise,
  type NationState,
} from "@bluewave/campaign";
import type { CommandBody, HoldFleetExerciseCommand } from "@bluewave/commands";
import type { PhaseContext } from "./pipeline.js";

export function applyFleetExerciseCommand(ctx: PhaseContext, body: CommandBody): boolean {
  if (body["type"] !== "HoldFleetExercise") return false;
  const command = body as HoldFleetExerciseCommand;
  const refuse = (code: string, message: string) =>
    ctx.collector.addError(code, message, {
      stage: "command-collection",
      entityId: command["nationId"],
    });

  const rules = ctx.fleetManagement?.exercise;
  if (rules === undefined) {
    refuse(
      FLEET_EXERCISE_DORMANT,
      "Fleet exercises are not available: the section is not authored",
    );
    return true;
  }
  const nation = ctx.snapshot.current["nations"].get(command["nationId"]);
  if (nation === undefined) return true;

  const held = exerciseMonthAfter(ctx.campaignMonth);
  if (exerciseLimitReached(nation["fleetExercise"], held.year, rules)) {
    refuse(
      FLEET_EXERCISE_LIMIT_REACHED,
      `${command["nationId"]} has already held its fleet exercise for ${held.year}`,
    );
    return true;
  }
  const problems = exerciseProblems(nation, command["nationId"], command["shipIds"]);
  if (problems.length > 0) {
    refuse(
      FLEET_EXERCISE_REJECTED,
      `Fleet exercise rejected: ${problems.map((p) => `${p.shipId}=${p.reason}`).join(", ")}`,
    );
    return true;
  }
  const nations = new Map(ctx.snapshot.current["nations"]);
  nations.set(
    command["nationId"],
    scheduleFleetExercise(nation, command["shipIds"], ctx.campaignMonth, rules),
  );
  ctx.snapshot.current = { ...ctx.snapshot.current, nations };
  return true;
}

export function completeFleetExerciseForMonth(ctx: PhaseContext): void {
  const rules = ctx.fleetManagement;
  if (rules === undefined) return;

  let changed = false;
  const updated = new Map<string, NationState>();
  for (const [nationId, nation] of ctx.snapshot.read("nations")) {
    const completed = completeFleetExercise(
      nation,
      ctx.campaignMonth,
      rules.divisionExperience.perExercise,
    );
    if (completed !== nation) changed = true;
    updated.set(nationId, completed);
  }
  if (changed) ctx.snapshot.write("nations", updated);
}
