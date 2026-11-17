import type { Ship } from "./state.js";

export interface FleetState {
  id: string;
  nationId: string;
  name: string;
  ships: Ship[];
  locationAreaId: string;
  destinationAreaId?: string;
}
