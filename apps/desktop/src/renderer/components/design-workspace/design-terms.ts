import type { ThreatProfile } from "@bluewave/ship-design";
import { plainShipTypeName } from "./shipTypes.js";

export const TERMS = {
  shipType: "Ship type",
  classCode: "Class code",
  naturalClass: "Qualifies as",
  plannedUpgrades: "Planned upgrades",
} as const;

export const UNNAMED_THREAT = "unnamed threat";

export const NOT_CLASSIFIED = "Not classified";

export const shipTypeValue = (code: string): string => `${plainShipTypeName(code)} [${code}]`;

export const naturalClassValue = (naturalClass: string | null, chosenType: string): string => {
  if (naturalClass === null) return NOT_CLASSIFIED;
  const name = shipTypeValue(naturalClass);
  return naturalClass === chosenType
    ? name
    : `${name} · differs from the chosen type (${plainShipTypeName(chosenType)})`;
};

export const threatDisplayName = (
  threats: readonly Pick<ThreatProfile, "id" | "name">[],
  id: string,
): string => {
  const name = threats.find((t) => t.id === id)?.name;
  return name === undefined || name.trim() === "" ? UNNAMED_THREAT : name;
};
