import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

export const FLEET_FORMULA_VERSION = "fleet_v1";

const SOURCE = { kind: "code", ref: "packages/campaign/src/presence.ts" } as const;
const UNIT_TONS = "tons";

function tonChild(formulaId: string, amount: number): ExplanationTree {
  return new ExplanationBuilder(formulaId, FLEET_FORMULA_VERSION)
    .withInput("amount", Math.abs(amount))
    .withResult(amount)
    .withUnit(UNIT_TONS)
    .withSource(SOURCE)
    .build();
}

export function explainPresenceShortfall(
  requiredTons: number,
  presentTons: number,
  exempt: boolean,
  shortfallTons: number,
): ExplanationTree {
  const rawShortfall = Math.max(0, requiredTons - presentTons);
  const builder = new ExplanationBuilder("fleet_presence", FLEET_FORMULA_VERSION)
    .withInput("requiredTons", requiredTons)
    .withInput("presentTons", presentTons)
    .withInput("exempt", exempt ? "true" : "false")
    .withIntermediate("rawShortfallTons", rawShortfall)
    .withResult(shortfallTons)
    .withUnit(UNIT_TONS)
    .withOperation("subtract")
    .withSource(SOURCE)
    .addChild(tonChild("fleet_presence.required", requiredTons))
    .addChild(tonChild("fleet_presence.present", -presentTons));
  if (exempt && rawShortfall > 0) {
    builder.addChild(tonChild("fleet_presence.exemption", -rawShortfall));
  }
  return builder.build();
}
