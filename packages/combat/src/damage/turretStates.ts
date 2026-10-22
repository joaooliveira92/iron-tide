import { type ComponentOutcome } from "./componentDamage.js";

export type TurretState = "OPERATIONAL" | "JAMMED" | "DISABLED" | "DESTROYED" | "BURNED_OUT";

export interface TurretComponent {
  id: string;
  state: TurretState;
  jamDurationMinutes?: number;
}

const OUTCOME_TO_TURRET_STATE: Record<ComponentOutcome, TurretState> = {
  UNAFFECTED: "OPERATIONAL",
  DEGRADED: "OPERATIONAL",
  JAMMED: "JAMMED",
  DISABLED: "DISABLED",
  DESTROYED: "DESTROYED",
  BURNED_OUT: "BURNED_OUT",
  FLOODED: "DISABLED",
  ISOLATED: "DISABLED",
};

export function applyTurretDamage(
  turret: TurretComponent,
  outcome: ComponentOutcome,
): TurretComponent {
  const newState = OUTCOME_TO_TURRET_STATE[outcome];
  const currentStateSeverity = stateSeverity(turret.state);
  const newStateSeverity = stateSeverity(newState);

  if (newStateSeverity <= currentStateSeverity && newState !== turret.state) {
    return turret;
  }

  const jamDurationMinutes = newState === "JAMMED" ? 5 : undefined;

  return {
    id: turret.id,
    state: newState,
    ...(jamDurationMinutes !== undefined ? { jamDurationMinutes } : {}),
  };
}

const SEVERITY_ORDER: Record<TurretState, number> = {
  OPERATIONAL: 0,
  JAMMED: 1,
  DISABLED: 2,
  DESTROYED: 3,
  BURNED_OUT: 4,
};

function stateSeverity(state: TurretState): number {
  return SEVERITY_ORDER[state];
}
