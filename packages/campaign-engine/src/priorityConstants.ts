/**
 * Pure priority/construction thresholds, split out of `priorities.ts` so the
 * renderer can consume them without dragging the Effect Schema validation
 * runtime into the renderer bundle: `priorities.ts` builds Effect schemas at
 * module scope, so any runtime import from it bundles `effect` (ADR-0105
 * `MIG-EXCL-1`, ticket 04). These values are plain constants with no schema
 * dependency.
 */

/** Minimum research share (basis points) below which a low-spend priority fires. */
export const MIN_RESEARCH_SHARE_BP = 800;

/** A construction project at or above this work fraction is "near completion". */
export const NEAR_COMPLETION_WORK_RATIO = 0.9;
