import { RandomEngine } from "@bluewave/random";
import { PhaseResource, type PhaseFootprint } from "./phase-resource.js";
import { PhaseRegistry, type PhaseDefinition } from "./registry.js";

export { PhaseResource, type PhaseFootprint };

export const PHASE_FOOTPRINTS: Readonly<Record<string, PhaseFootprint>> = Object.fromEntries(
  PhaseRegistry.PHASES.map((phase) => [phase.id, phase.footprint]),
);

export const PHASE_ACCESS_DENIED = "PHASE_ACCESS_DENIED" as const;

export class PhaseGuard {
  constructor(private readonly overrides?: ReadonlyMap<string, PhaseDefinition>) {}

  private resolve(phaseId: string): PhaseDefinition | undefined {
    return this.overrides?.get(phaseId) ?? PhaseRegistry.getById(phaseId);
  }

  assert(phaseId: string, footprint: PhaseFootprint): string[] {
    const phase = this.resolve(phaseId);
    if (!phase) {
      return [`phase "${phaseId}" is not registered in the phase registry`];
    }

    const violations: string[] = [];

    for (const resource of footprint.reads) {
      if (!PhaseRegistry.hasAccess(phase, resource, "read")) {
        violations.push(`phase "${phaseId}" reads resource "${resource}" without read permission`);
      }
    }
    for (const resource of footprint.writes) {
      if (!PhaseRegistry.hasAccess(phase, resource, "write")) {
        violations.push(
          `phase "${phaseId}" writes resource "${resource}" without write permission`,
        );
      }
    }
    if (footprint.usesRng && !phase["rngAllowed"]) {
      violations.push(`phase "${phaseId}" draws randomness but rngAllowed=false`);
    }

    return violations;
  }

  isRngAllowed(phaseId: string): boolean {
    return this.resolve(phaseId)?.["rngAllowed"] === true;
  }

  rng(phaseId: string, seed: string): RandomEngine | null {
    if (!this.isRngAllowed(phaseId)) return null;
    return new RandomEngine(seed);
  }
}
