import type { CompiledDesignVersion, FleetState } from "@bluewave/campaign";

export function fields<T>() {
  return <U extends readonly (keyof T)[]>(
    ...keys: U &
      (Exclude<keyof T, U[number]> extends never ? unknown : never) &
      (Exclude<U[number], keyof T> extends never ? unknown : never)
  ): U => keys;
}

export const FLEET_STATE_FIELDS = fields<FleetState>()(
  "id",
  "nationId",
  "name",
  "ships",
  "locationAreaId",
  "destinationAreaId",
);

export const COMPILED_DESIGN_VERSION_FIELDS = fields<CompiledDesignVersion>()(
  "designVersionId",
  "designFamilyId",
  "className",
  "nationId",
  "hullType",
  "normalizedDisplacementKg",
  "normalizedSpeedUms",
  "normalizedArmorUm",
  "hitPoints",
  "mainGunsCaliber",
  "mainGunsCount",
  "machineryType",
  "crewComplement",
  "contentVersion",
  "compiledHash",
  "hullLengthMm",
  "hullBeamMm",
  "capabilities",
  "armament",
  "torpedoArmament",
  "sourceDraft",
  "colonialServiceFitted",
  "crampedAccommodation",
  "shortRange",
  "constructionCostUnits",
  "constructionPlan",
);
