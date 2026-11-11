import type { AvailabilityReason } from "@bluewave/ship-design";

const words = (id: string): string => id.replaceAll("_", " ").toLowerCase();

const param = (reason: AvailabilityReason, key: string): string | null => {
  const value = reason.params[key];
  return typeof value === "string" ? value : null;
};

export function prerequisiteText(reason: AvailabilityReason): string {
  switch (reason.code) {
    case "SHIP_TYPE_TECHNOLOGY_REQUIRED": {
      const tech = param(reason, "techId");
      return tech === null ? reason.message : `Requires ${words(tech)}`;
    }
    case "SHIP_TYPE_CAPABILITY_REQUIRED": {
      const capability = param(reason, "capabilityId");
      return capability === null ? reason.message : `Requires the ${words(capability)} capability`;
    }
    case "SHIP_TYPE_ERA_NOT_REACHED": {
      const era = param(reason, "fromEra");
      return era === null ? reason.message : `Not before the ${words(era)} era`;
    }
    default:
      return reason.message;
  }
}

export const lockedSummary = (reasons: readonly AvailabilityReason[]): string =>
  reasons.map(prerequisiteText).join("; ");
