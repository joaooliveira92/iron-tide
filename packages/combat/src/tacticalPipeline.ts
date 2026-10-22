export const TACTICAL_PIPELINE_PHASES = [
  "lock_commands",
  "transmit_acknowledge",
  "resolve_command_state",
  "update_contact_knowledge",
  "resolve_movement_intent",
  "resolve_propulsion_formation",
  "resolve_collisions_grounding",
  "resolve_sensors_spotting",
  "resolve_weapons_by_substep",
  "apply_damage_effects",
  "resolve_damage_control",
  "resolve_withdrawal_pursuit_exit",
  "evaluate_battle_end",
  "canonicalize_state_event_order",
  "compute_hashes",
] as const;

export interface PhaseRecord {
  phase: (typeof TACTICAL_PIPELINE_PHASES)[number];
  success: boolean;
  empty: boolean;
  hash?: string;
}

export function executeBattleMinutePhases(work: Record<string, boolean>): PhaseRecord[] {
  return TACTICAL_PIPELINE_PHASES.map((ph) => {
    const hasWork = !!work[ph];
    return { phase: ph, success: true, empty: !hasWork };
  });
}

export function createImmutableProjection<T extends object>(authoritative: T): Readonly<T> {
  return Object.freeze(JSON.parse(JSON.stringify(authoritative)));
}
export function interpolateRender(
  projection: Readonly<{ position: [number, number] }>,
  _alpha: number,
) {
  return { position: [...projection.position] as [number, number] };
}
