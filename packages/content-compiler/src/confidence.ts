import { CONFIDENCE_LEVELS } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";

import type { ContentBundle } from "./index.js";

export { CONFIDENCE_LEVELS };
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export interface ConfidenceCounts {
  readonly HIGH: number;
  readonly MEDIUM: number;
  readonly LOW: number;
  readonly total: number;
}

export interface CollectionConfidence {
  readonly collection: string;
  readonly counts: ConfidenceCounts;
}

export interface ConfidenceReport {
  readonly collections: readonly CollectionConfidence[];
  readonly total: ConfidenceCounts;
}

export interface ProvenanceLocation {
  readonly collection: string;
  readonly recordId: string;
  readonly field: string;
  readonly confidence?: string;
  readonly sourceStatus?: string;
}

export interface BundleCollectionSpec {
  readonly name: string;
  readonly idField: string;
  readonly of: (bundle: ContentBundle) => unknown;
}

export const BUNDLE_COLLECTIONS: readonly BundleCollectionSpec[] = [
  { name: "rulesets", idField: "id", of: (b) => b.rulesets },
  { name: "nations", idField: "id", of: (b) => b.nations },
  { name: "areas", idField: "id", of: (b) => b.areas },
  { name: "routes", idField: "id", of: (b) => b.routes },
  { name: "possessions", idField: "id", of: (b) => b.possessions },
  { name: "ports", idField: "id", of: (b) => b.ports },
  { name: "technologies", idField: "id", of: (b) => b.technologies },
  { name: "shipBuilding.components", idField: "id", of: (b) => b.shipBuilding?.components },
  { name: "shipBuilding.plants", idField: "id", of: (b) => b.shipBuilding?.plants },
  { name: "shipBuilding.hullForms", idField: "id", of: (b) => b.shipBuilding?.hullForms },
  {
    name: "shipBuilding.navalProfiles",
    idField: "nationId",
    of: (b) => b.shipBuilding?.navalProfiles,
  },
  {
    name: "shipBuilding.referenceDesigns",
    idField: "id",
    of: (b) => b.shipBuilding?.referenceDesigns,
  },
  {
    name: "shipBuilding.armament.gunFamilies",
    idField: "id",
    of: (b) => b.shipBuilding?.armament.gunFamilies,
  },
  {
    name: "shipBuilding.armament.gunModels",
    idField: "id",
    of: (b) => b.shipBuilding?.armament.gunModels,
  },
  {
    name: "shipBuilding.armament.gunMounts",
    idField: "id",
    of: (b) => b.shipBuilding?.armament.gunMounts,
  },
  {
    name: "shipBuilding.armament.ammunition",
    idField: "id",
    of: (b) => b.shipBuilding?.armament.ammunition,
  },
  {
    name: "shipBuilding.partModel.parts",
    idField: "id",
    of: (b) => {
      const byId = b.shipBuilding?.partModel?.partIndex.byId;
      return byId === undefined
        ? undefined
        : Object.keys(byId)
            .sort(compareCodePoints)
            .map((id) => byId[id]);
    },
  },
  {
    name: "shipBuilding.partModel.slotTemplates",
    idField: "id",
    of: (b) => b.shipBuilding?.partModel?.slotTemplates,
  },
  {
    name: "shipBuilding.partModel.platforms",
    idField: "id",
    of: (b) => b.shipBuilding?.partModel?.platforms,
  },
  {
    name: "shipBuilding.partModel.shipTypes",
    idField: "id",
    of: (b) => b.shipBuilding?.partModel?.partIndex.shipTypes,
  },
  { name: "campaign.fleets", idField: "id", of: (b) => b.campaign?.fleets },
  { name: "campaign.economies", idField: "nationId", of: (b) => b.campaign?.economies },
  { name: "campaign.constructions", idField: "id", of: (b) => b.campaign?.constructions },
  { name: "campaign.research", idField: "nationId", of: (b) => b.campaign?.research },
  { name: "campaign.designs", idField: "designId", of: (b) => b.campaign?.designs },
  { name: "campaign.diplomacy", idField: "id", of: (b) => b.campaign?.diplomacy },
];

export function collectProvenanceLocations(bundle: ContentBundle): ProvenanceLocation[] {
  const out: ProvenanceLocation[] = [];
  for (const spec of BUNDLE_COLLECTIONS) {
    const value = spec.of(bundle);
    if (value === undefined) continue;
    const records = Array.isArray(value) ? value : [value];
    for (const record of records) {
      walkProvenance(record, spec.name, recordIdOf(record, spec.idField), "", out);
    }
  }
  return out;
}

function recordIdOf(record: unknown, idField: string): string {
  if (isRecord(record)) {
    const id = record[idField];
    if (typeof id === "string") return id;
  }
  return "";
}

function walkProvenance(
  value: unknown,
  collection: string,
  recordId: string,
  path: string,
  out: ProvenanceLocation[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkProvenance(item, collection, recordId, `${path}[${index}]`, out),
    );
    return;
  }
  if (!isRecord(value)) return;
  const provenance = value["provenance"];
  if (
    isRecord(provenance) &&
    (typeof provenance["sourceStatus"] === "string" || typeof provenance["confidence"] === "string")
  ) {
    out.push({
      collection,
      recordId,
      field: path === "" ? "provenance" : `${path}.provenance`,
      confidence: asString(provenance["confidence"]),
      sourceStatus: asString(provenance["sourceStatus"]),
    });
  }
  for (const [nestedKey, nested] of Object.entries(value)) {
    walkProvenance(
      nested,
      collection,
      recordId,
      path === "" ? nestedKey : `${path}.${nestedKey}`,
      out,
    );
  }
}

export function countConfidence(bundle: ContentBundle): ConfidenceReport {
  const locations = collectProvenanceLocations(bundle);
  const collections: CollectionConfidence[] = [];
  const total = emptyCounts();
  for (const spec of BUNDLE_COLLECTIONS) {
    if (spec.of(bundle) === undefined) continue;
    const counts = emptyCounts();
    for (const location of locations) {
      if (location.collection !== spec.name) continue;
      if (isConfidenceLevel(location.confidence)) counts[location.confidence] += 1;
      counts.total += 1;
    }
    collections.push({ collection: spec.name, counts });
    total.HIGH += counts.HIGH;
    total.MEDIUM += counts.MEDIUM;
    total.LOW += counts.LOW;
    total.total += counts.total;
  }
  return { collections, total };
}

function emptyCounts(): { HIGH: number; MEDIUM: number; LOW: number; total: number } {
  return { HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 };
}

function isConfidenceLevel(value: string | undefined): value is ConfidenceLevel {
  return value === "HIGH" || value === "MEDIUM" || value === "LOW";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
