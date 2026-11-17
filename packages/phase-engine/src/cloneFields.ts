import type { FleetState } from "@bluewave/campaign";

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
