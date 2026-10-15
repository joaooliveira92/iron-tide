import { RandomEngine } from "@bluewave/random";
import { PhaseRegistry, type PhaseDefinition } from "./registry.js";

/**
 * Canonical resource domains the phase registry models. These map to snapshot
 * regions the MonthExecutor phases actually read/write. `all` is a wildcard.
 */
export const PhaseResource = {
  ALL: "all",
  TREASURY: "treasury",
  FLEETS: "fleets",
  CONSTRUCTIONS: "constructions",
  RESEARCH: "research",
  WARS: "wars",
  POLITICS: "politics",
  NATIONS: "nations",
  STRATEGIC_WEATHER: "strategicWeather",
  DESIGNS: "designs",
} as const;

export interface PhaseFootprint {
  /** resources the phase reads */
  readonly reads: string[];
  /** resources the phase writes */
  readonly writes: string[];
  /** whether the phase draws randomness */
  readonly usesRng: boolean;
}

/**
 * The authoritative runtime footprint of each phase — what a phase actually
 * touches. This is the "reality" side of the contract; the registry's
 * read/writePermissions + rngAllowed is the declared policy. The PhaseGuard
 * checks footprint ⊆ policy at runtime and fails closed on any overstep.
 *
 * ADR-0036: reconciled so every footprint sits within its phase's declared
 * permissions (no phase is denied in a well-formed run).
 */
export const PHASE_FOOTPRINTS: Readonly<Record<string, PhaseFootprint>> = {
  opening_validation: {
    reads: [PhaseResource.NATIONS, PhaseResource.WARS],
    writes: [],
    usesRng: false,
  },
  weather_generation: {
    reads: [PhaseResource.ALL],
    writes: [PhaseResource.STRATEGIC_WEATHER],
    usesRng: true,
  },
  monthly_revenue: {
    reads: [PhaseResource.TREASURY],
    writes: [PhaseResource.TREASURY],
    usesRng: false,
  },
  ai_planning: {
    reads: [PhaseResource.RESEARCH, PhaseResource.CONSTRUCTIONS, PhaseResource.TREASURY],
    writes: [PhaseResource.RESEARCH, PhaseResource.TREASURY, PhaseResource.CONSTRUCTIONS],
    usesRng: true,
  },
  ai_procurement: {
    reads: [
      PhaseResource.NATIONS,
      PhaseResource.CONSTRUCTIONS,
      PhaseResource.TREASURY,
      PhaseResource.RESEARCH,
      PhaseResource.DESIGNS,
    ],
    writes: [PhaseResource.NATIONS, PhaseResource.CONSTRUCTIONS, PhaseResource.DESIGNS],
    usesRng: true,
  },
  command_collection: {
    reads: [PhaseResource.ALL],
    writes: [
      PhaseResource.TREASURY,
      PhaseResource.CONSTRUCTIONS,
      PhaseResource.RESEARCH,
      PhaseResource.WARS,
      PhaseResource.POLITICS,
      PhaseResource.FLEETS,
    ],
    usesRng: false,
  },
  appropriation: {
    reads: [PhaseResource.TREASURY, PhaseResource.CONSTRUCTIONS, PhaseResource.NATIONS],
    writes: [PhaseResource.TREASURY, PhaseResource.CONSTRUCTIONS, PhaseResource.NATIONS],
    // INC-4/SB3-R9: the appropriation phase draws the keyed acceleration capacity-pressure delay decisions over the
    // `appropriation`-scoped engine (no draw occurs when no project is accelerated). SB3-R17: it also resolves the
    // private dock-expansion event (no draw occurs without explicit dock-expansion eligibility).
    usesRng: true,
  },
  maintenance: {
    reads: [PhaseResource.TREASURY, PhaseResource.FLEETS],
    writes: [PhaseResource.TREASURY],
    usesRng: false,
  },
  obligation: {
    reads: [PhaseResource.TREASURY],
    writes: [PhaseResource.TREASURY],
    usesRng: false,
  },
  construction_processing: {
    reads: [PhaseResource.CONSTRUCTIONS, PhaseResource.FLEETS, PhaseResource.NATIONS],
    writes: [PhaseResource.CONSTRUCTIONS, PhaseResource.FLEETS, PhaseResource.NATIONS],
    usesRng: false,
  },
  resolve_diplomacy: {
    reads: [PhaseResource.WARS, PhaseResource.POLITICS],
    writes: [PhaseResource.WARS],
    usesRng: false,
  },
  resolve_research: {
    reads: [PhaseResource.RESEARCH, PhaseResource.TREASURY],
    writes: [PhaseResource.RESEARCH, PhaseResource.TREASURY],
    usesRng: true,
  },
  resolve_aircraft_development: {
    reads: [PhaseResource.NATIONS, PhaseResource.TREASURY, PhaseResource.RESEARCH],
    writes: [PhaseResource.NATIONS],
    usesRng: true,
  },
  resolve_carrier_operations: {
    reads: [PhaseResource.NATIONS],
    writes: [PhaseResource.NATIONS],
    usesRng: true,
  },
  battle_generation: {
    reads: [PhaseResource.WARS, PhaseResource.FLEETS, PhaseResource.NATIONS],
    writes: [PhaseResource.WARS, PhaseResource.NATIONS],
    usesRng: true,
  },
  battle_resolution: {
    reads: [
      PhaseResource.WARS,
      PhaseResource.FLEETS,
      PhaseResource.NATIONS,
      PhaseResource.STRATEGIC_WEATHER,
    ],
    writes: [PhaseResource.WARS, PhaseResource.FLEETS, PhaseResource.NATIONS],
    usesRng: true,
  },
  closing_validation: {
    reads: [PhaseResource.NATIONS, PhaseResource.CONSTRUCTIONS],
    writes: [],
    usesRng: false,
  },
};

/**
 * Stable diagnostic code emitted when a phase oversteps its declared registry
 * permissions (read, write, or RNG) at runtime.
 */
export const PHASE_ACCESS_DENIED = "PHASE_ACCESS_DENIED" as const;

/**
 * Runtime enforcement of the phase registry contract. For each phase it asserts
 * the phase's authoritative footprint against the registry-declared
 * read/writePermissions + rngAllowed. A violation is reported as a diagnostic;
 * the caller (MonthExecutor) fails the phase closed (does not execute it).
 *
 * An optional `overrides` map lets a caller substitute a phase definition
 * (used by tests to exercise the fail-closed path for a specific phase).
 */
export class PhaseGuard {
  constructor(private readonly overrides?: ReadonlyMap<string, PhaseDefinition>) {}

  private resolve(phaseId: string): PhaseDefinition | undefined {
    return this.overrides?.get(phaseId) ?? PhaseRegistry.getById(phaseId);
  }

  /**
   * Assert `phaseId`'s declared footprint against the effective registry
   * definition. Returns human-readable violation messages (empty = allowed).
   * An unknown phase id is itself a violation (never throws).
   */
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

  /**
   * Whether the effective registry definition for `phaseId` allows randomness.
   * Returns false for unknown phases (fail closed). This is the structural
   * RNG gate: MonthExecutor obtains a RandomEngine only through `rng()`, which
   * withholds the engine for any phase that is not `rngAllowed`.
   */
  isRngAllowed(phaseId: string): boolean {
    return this.resolve(phaseId)?.["rngAllowed"] === true;
  }

  /**
   * Return a phase-scoped RandomEngine for `phaseId`, or null when the phase is
   * not `rngAllowed` (or is unknown). Non-`rngAllowed` phases therefore cannot
   * draw randomness: they are never handed an engine. ADR-0036.
   */
  rng(phaseId: string, seed: string): RandomEngine | null {
    if (!this.isRngAllowed(phaseId)) return null;
    return new RandomEngine(seed);
  }
}
