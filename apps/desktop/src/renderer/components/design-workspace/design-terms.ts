import { EN_US_MESSAGES, type MessageKey } from "../../lib/en-us-messages.js";
import { plainShipTypeName } from "./shipTypes.js";

export const TERMS = {
  shipType: "Ship type",
  classCode: "Class code",
  naturalClass: "Qualifies as",
  plannedUpgrades: "Planned upgrades",
} as const;

export const NOT_CLASSIFIED = "Not classified";

export const shipTypeValue = (code: string): string => `${plainShipTypeName(code)} [${code}]`;

export const naturalClassValue = (naturalClass: string | null, chosenType: string): string => {
  if (naturalClass === null) return NOT_CLASSIFIED;
  const name = shipTypeValue(naturalClass);
  return naturalClass === chosenType
    ? name
    : `${name} · differs from the chosen type (${plainShipTypeName(chosenType)})`;
};

const isMessageKey = (key: string): key is MessageKey => Object.hasOwn(EN_US_MESSAGES, key);

export const threatDisplayName = (threatId: string): string => {
  const key = `shipbuilding.threat.${threatId}`;
  return isMessageKey(key) ? EN_US_MESSAGES[key] : EN_US_MESSAGES["shipbuilding.threat.unnamed"];
};
