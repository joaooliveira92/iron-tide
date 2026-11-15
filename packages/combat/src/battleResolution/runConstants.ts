export const RUN_MAX_TURN_MINUTES = 99;
export const RUN_CONTACT_AWARE_HELD_MINUTES = 5;
export const RUN_CONTACT_AWARE_IDLE_MINUTES = 60;

export const RUN_PAUSE_KINDS = [
  "ENEMY_SIGHTED",
  "CONTACT_LOST",
  "FRIENDLY_HIT",
  "SHIP_SUNK",
  "TORPEDO",
] as const;

export const RUN_PAUSE_PRECEDENCE = [
  "BATTLE_END",
  "SHIP_SUNK",
  "FRIENDLY_HIT",
  "TORPEDO",
  "ENEMY_SIGHTED",
  "CONTACT_LOST",
] as const;

export const FRIENDLY_HIT_EVENT_TYPES = [
  "damage_impact",
  "torpedo_damage",
  "missile_impact",
] as const;
export const TORPEDO_EVENT_TYPES = ["torpedo_launch", "torpedo_hit"] as const;
