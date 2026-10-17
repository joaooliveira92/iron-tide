// Typed read-only views of the compiled production bundle's collections for the
// N-1 audit tests. `ContentBundle` publishes these as `unknown[]` because the
// compiler is shape-agnostic at the artifact layer, but every record has already
// been decoded with its content schema before the bundle is emitted, so casting
// to the checked record shape here reads a validated in-process value rather than
// asserting an untrusted boundary.
import type { ContentBundle } from "../../src/index.js";

export interface NationRecord {
  readonly id: string;
  readonly isPlayable: boolean;
}

export interface ShipRecord {
  readonly id: string;
  readonly classId: string;
  readonly designVersionId?: string;
}

export interface FleetRecord {
  readonly id: string;
  readonly nationId: string;
  readonly locationAreaId: string;
  readonly ships: readonly ShipRecord[];
  readonly provenance?: unknown;
}

export interface DesignRecord {
  readonly designVersionId: string;
  readonly className: string;
  readonly nationId: string;
  readonly familyCreationMonth?: string;
}

export interface ConstructionRecord {
  readonly id: string;
  readonly type: string;
  readonly nationId: string;
  readonly targetId: string;
  readonly designVersionId?: string;
}

export interface ResearchTechRecord {
  readonly techId: string;
  readonly completed: boolean;
}

export interface ResearchRecord {
  readonly nationId: string;
  readonly researchBudget: number;
  readonly currentProjectTechId?: string;
  readonly technologies: readonly ResearchTechRecord[];
}

export interface ProvenanceRecord {
  readonly kind: string;
  readonly sourceStatus: string;
}

export interface DiplomacyRecord {
  readonly nationA: string;
  readonly nationB: string;
  readonly relation: string;
  readonly tension?: number;
  readonly nap?: boolean;
  readonly provenance?: ProvenanceRecord;
}

export interface TechnologyRecord {
  readonly id: string;
  readonly prerequisites?: readonly { readonly techId: string }[];
}

export interface DivisionRecord {
  readonly id: string;
  readonly nationId: string;
  readonly shipOrder: readonly string[];
  readonly commanderOfficerId?: string;
  readonly divisionRole: string;
  readonly preferredFormation: string;
  readonly provenance?: ProvenanceRecord;
}

export function nationsOf(bundle: ContentBundle): NationRecord[] {
  return bundle.nations as NationRecord[];
}

export function technologiesOf(bundle: ContentBundle): TechnologyRecord[] {
  return bundle.technologies as TechnologyRecord[];
}

export function fleetsOf(bundle: ContentBundle): FleetRecord[] {
  return (bundle.campaign?.fleets ?? []) as FleetRecord[];
}

export function designsOf(bundle: ContentBundle): DesignRecord[] {
  return (bundle.campaign?.designs ?? []) as DesignRecord[];
}

export function constructionsOf(bundle: ContentBundle): ConstructionRecord[] {
  return (bundle.campaign?.constructions ?? []) as ConstructionRecord[];
}

export function researchOf(bundle: ContentBundle): ResearchRecord[] {
  return (bundle.campaign?.research ?? []) as ResearchRecord[];
}

export function diplomacyOf(bundle: ContentBundle): DiplomacyRecord[] {
  return (bundle.campaign?.diplomacy ?? []) as DiplomacyRecord[];
}

export function divisionsOf(bundle: ContentBundle): DivisionRecord[] {
  return (bundle.campaign?.divisions ?? []) as DivisionRecord[];
}
