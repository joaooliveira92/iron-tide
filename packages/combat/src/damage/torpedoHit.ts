export type { ShipDamageState, FloodingSourceRecord } from "./state.js";
export { withDamageStateHash, assertFixedPointDamage } from "./state.js";
export { resolveStructureFlotation, type StructureFlotationResult } from "./structureFlotation.js";
export { evaluateTerminalSeam, type TerminalResult } from "./terminalSeam.js";
export { applyTurretDamage, type TurretComponent } from "./turretStates.js";
export type { ComponentOutcome } from "./componentDamage.js";
