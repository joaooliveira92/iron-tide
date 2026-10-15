import type {
  FleetArea,
  FleetAreaEdge,
  FleetDivisionView,
  FleetPort,
  MovementCommand,
} from "@bluewave/campaign-engine";
import type { CommandEnvelope } from "./bridge-contract.js";

export type {
  FleetArea,
  FleetAreaEdge,
  FleetDivisionView,
  FleetPort,
  FleetShipView,
} from "@bluewave/campaign-engine";

/**
 * Read-only for MVP (desktop-mvp map, Construction & Fleet Contract
 * ticket) — divisions, geography, and commands are copied from engine
 * responses; the screen never decides whether a route is adjacent,
 * accessible, or otherwise legal. `submitMovementCommand`/
 * `replaceMovementCommand`/`cancelMovementCommand` stay unimplemented.
 * Shapes grounded in `DivisionPicker.tsx`, `OrderSection.tsx`, and
 * `fleet-screen-state.test.ts`; the view types themselves
 * (`FleetDivisionView`/`FleetArea`/`FleetAreaEdge`/`FleetPort`) are owned by
 * `@bluewave/campaign-engine`'s fleet projection (ticket 15) and re-exported
 * here so renderer imports keep working.
 */

export interface FleetScreenProjection {
  readonly revision: number;
  readonly month: { readonly month: number; readonly year: number };
  readonly playerNationId: string;
  readonly divisions: readonly FleetDivisionView[];
  readonly areas: readonly FleetArea[];
  readonly areaEdges: readonly FleetAreaEdge[];
  readonly ports: readonly FleetPort[];
  readonly movementCommands: readonly MovementCommand[];
}

export interface MovementCommandOutcome {
  readonly workspace: { readonly movementCommands: readonly MovementCommand[] };
  readonly command: { readonly commandId: string; readonly status: string };
}

export interface SubmitMovementCommandPayload extends CommandEnvelope {
  readonly divisionId: string;
  readonly fromAreaId: string;
  readonly toAreaId: string;
}

export interface ReplaceMovementCommandPayload extends SubmitMovementCommandPayload {
  readonly commandId: string;
}

export interface CancelMovementCommandPayload extends CommandEnvelope {
  readonly commandId: string;
}
