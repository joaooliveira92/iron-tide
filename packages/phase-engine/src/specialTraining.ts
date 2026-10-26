import {
  advanceSpecialTraining,
  fundSpecialTraining,
  TRAINING_DORMANT,
  trainingRefusal,
  type NationState,
  type TrainingSubject,
} from "@bluewave/campaign";
import type { CommandBody, SetSpecialTrainingCommand } from "@bluewave/commands";
import type { PhaseContext } from "./pipeline.js";

export function applySpecialTrainingCommand(ctx: PhaseContext, body: CommandBody): boolean {
  if (body["type"] !== "SetSpecialTraining") return false;
  const command = body as SetSpecialTrainingCommand;
  const rules = ctx.fleetManagement?.training;
  if (rules === undefined) {
    ctx.collector.addError(
      TRAINING_DORMANT,
      "Special training is not available: the fleet-management section is not authored",
      { stage: "command-collection", entityId: command["nationId"] },
    );
    return true;
  }
  const refusal = trainingRefusal(command["subjects"], rules);
  if (refusal !== null) {
    ctx.collector.addError(
      refusal,
      `Special training refused for ${command["nationId"]}: ${refusal}`,
      { stage: "command-collection", entityId: command["nationId"] },
    );
    return true;
  }
  const nation = ctx.snapshot.current["nations"].get(command["nationId"]);
  if (nation === undefined) return true;
  const program = fundSpecialTraining(
    nation["specialTraining"],
    command["subjects"] as TrainingSubject[],
    rules,
    command["nationId"],
  );
  const nations = new Map(ctx.snapshot.current["nations"]);
  const { specialTraining: _previous, ...rest } = nation;
  nations.set(
    command["nationId"],
    program.length === 0 ? (rest as NationState) : { ...rest, specialTraining: program },
  );
  ctx.snapshot.current = { ...ctx.snapshot.current, nations };
  return true;
}

export function advanceSpecialTrainingForMonth(ctx: PhaseContext): void {
  const rules = ctx.fleetManagement?.training;
  if (rules === undefined) return;

  let changed = false;
  const updated = new Map<string, NationState>();
  for (const [nationId, nation] of ctx.snapshot.read("nations")) {
    const program = advanceSpecialTraining(nation["specialTraining"], rules.proficiencyMonths);
    if (program === undefined || program.length === 0) {
      updated.set(nationId, nation);
      continue;
    }
    changed = true;
    updated.set(nationId, { ...nation, specialTraining: program });
  }
  if (changed) ctx.snapshot.write("nations", updated);
}
