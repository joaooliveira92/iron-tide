import { PRESTIGE_REASON_MESSAGES } from "./prestige-reason-messages.js";
import { STRIP_TRAINING_MESSAGES } from "./strip-training-messages.js";

export const STATUS_STRIP_MESSAGES = {
  ...PRESTIGE_REASON_MESSAGES,
  ...STRIP_TRAINING_MESSAGES,
  "shell.fleetMorale.label": "Fleet morale",
  "shell.fleetMorale.value": "{current} / {max}",
  "shell.fleetMorale.description":
    "National fleet morale, 0 to 100, starting full. Unpaid funds and a long blockade on cramped ships lower it; it recovers slowly otherwise. It is separate from unrest and from cohesion and has no effect yet. The values are provisional.",
  "shell.fleetMorale.lastChange": "Last change: {delta} ({reasons}, {month}).",
  "shell.fleetMorale.reason.UNPAID_FUNDS": "unpaid funds",
  "shell.fleetMorale.reason.BLOCKADE_CRAMPED": "blockade on cramped ships",
  "shell.fleetMorale.reason.RECOVERY": "recovery",
  "strategic.fleet_morale_change.summary": "Fleet morale change: {value}",
  "strategic.fleet_morale_change.before": "Morale before",
  "strategic.fleet_morale_change.unpaid_funds": "Unpaid funds",
  "strategic.fleet_morale_change.blockade_cramped": "Blockade on cramped ships",
  "strategic.fleet_morale_change.recovery": "Monthly recovery",
  "strategic.fleet_morale_change.clamp": "Bound clamp",
} as const;
