import {
  AmmunitionPatternSchema,
  AreaSchema,
  CampaignConstructionSchema,
  CampaignDesignSchema,
  CampaignDiplomacySchema,
  CampaignDivisionSchema,
  CampaignEconomySchema,
  CampaignFleetSchema,
  CampaignResearchSchema,
  GunFamilySchema,
  GunModelSchema,
  GunMountSchema,
  NationNavalProfileSchema,
  NationSchema,
  PackManifestSchema,
  PartSchema,
  PlatformSchema,
  PortSchema,
  PossessionSchema,
  PresentationContentSchema,
  PropulsionPlantSchema,
  ReferenceDesignSchema,
  ReferenceDesignLoadoutSchema,
  RouteEdgeSchema,
  RulesetManifestSchema,
  ShipComponentSchema,
  ShipHullFormSchema,
  ShipTypeRecordSchema,
  SlotTemplateSchema,
  TechnologyPrerequisiteChainSchema,
  UiCatalogueSchema,
  validateAgainstSchema,
  type ContentSchema,
  decodeBattleOfferRules,
  decodeFleetManagementRules,
  decodePresenceRules,
} from "@bluewave/content-schema";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

import type { CampaignCollections, CompilerStage } from "../index.js";
import type { ParseOutput } from "./parse.js";

export interface ValidateOutput {
  manifest: unknown;
  rulesets: unknown[];
  countries: unknown[];
  areas: unknown[];
  routes: unknown[];
  possessions: unknown[];
  ports: unknown[];
  technologies: unknown[];
  shipComponents?: unknown[];
  propulsionPlants?: unknown[];
  shipHullForms?: unknown[];
  shipBalance?: unknown;
  gunFamilies?: unknown[];
  gunModels?: unknown[];
  gunMounts?: unknown[];
  ammunition?: unknown[];
  navalProfiles?: unknown[];
  referenceDesigns?: unknown[];
  parts?: unknown[];
  slotTemplates?: unknown[];
  platforms?: unknown[];
  shipTypes?: unknown[];
  designLoadouts?: unknown[];
  partModelSources?: PartModelSources;
  fleets?: unknown[];
  economies?: unknown[];
  constructions?: unknown[];
  diplomacy?: unknown[];
  research?: unknown[];
  designs?: unknown[];
  divisions?: unknown[];
  presentation?: unknown;
  ui?: unknown;
}

export interface PartModelSources {
  readonly contentDir: string;
  readonly parts: ReadonlyMap<string, string>;
  readonly slotTemplates: ReadonlyMap<string, string>;
  readonly platforms: ReadonlyMap<string, string>;
  readonly shipTypes: ReadonlyMap<string, string>;
}

const COLLECTION_KEYS = [
  "rulesets",
  "countries",
  "areas",
  "routes",
  "possessions",
  "ports",
  "technologies",
] as const;

interface ShipBuildingCollection {
  key: keyof ValidateOutput;
  schema?: ContentSchema;
  label: string;
  idField: string;
}

interface ValidatedCatalogue {
  shipComponents: unknown[];
  propulsionPlants: unknown[];
  shipHullForms: unknown[];
  shipBalance: unknown;
  gunFamilies: unknown[];
  gunModels: unknown[];
  gunMounts: unknown[];
  ammunition: unknown[];
  navalProfiles: unknown[];
  referenceDesigns: unknown[];
  parts: unknown[];
  slotTemplates: unknown[];
  platforms: unknown[];
  shipTypes: unknown[];
  designLoadouts: unknown[];
}

const SHIP_BUILDING_COLLECTIONS: readonly ShipBuildingCollection[] = [
  { key: "shipComponents", schema: ShipComponentSchema, label: "ShipComponent", idField: "id" },
  {
    key: "propulsionPlants",
    schema: PropulsionPlantSchema,
    label: "PropulsionPlant",
    idField: "id",
  },
  { key: "shipHullForms", schema: ShipHullFormSchema, label: "ShipHullForm", idField: "id" },
  { key: "gunFamilies", schema: GunFamilySchema, label: "GunFamily", idField: "id" },
  { key: "gunModels", schema: GunModelSchema, label: "GunModel", idField: "id" },
  { key: "gunMounts", schema: GunMountSchema, label: "GunMount", idField: "id" },
  { key: "ammunition", schema: AmmunitionPatternSchema, label: "AmmunitionPattern", idField: "id" },
  {
    key: "navalProfiles",
    schema: NationNavalProfileSchema,
    label: "NationNavalProfile",
    idField: "nationId",
  },
  {
    key: "referenceDesigns",
    schema: ReferenceDesignSchema,
    label: "ReferenceDesign",
    idField: "id",
  },
  { key: "parts", schema: PartSchema, label: "Part", idField: "id" },
  { key: "slotTemplates", schema: SlotTemplateSchema, label: "SlotTemplate", idField: "id" },
  { key: "platforms", schema: PlatformSchema, label: "Platform", idField: "id" },
  { key: "shipTypes", schema: ShipTypeRecordSchema, label: "ShipType", idField: "id" },
  {
    key: "designLoadouts",
    schema: ReferenceDesignLoadoutSchema,
    label: "ReferenceDesignLoadout",
    idField: "id",
  },
];

const CAMPAIGN_COLLECTIONS: readonly CampaignCollection[] = [
  { key: "fleets", schema: CampaignFleetSchema, label: "Fleet", idField: "id" },
  { key: "economies", schema: CampaignEconomySchema, label: "Economy", idField: "nationId" },
  {
    key: "constructions",
    schema: CampaignConstructionSchema,
    label: "Construction",
    idField: "id",
  },
  {
    key: "research",
    schema: CampaignResearchSchema,
    label: "Research programme",
    idField: "nationId",
  },
  { key: "designs", schema: CampaignDesignSchema, label: "Design", idField: "designId" },
  {
    key: "diplomacy",
    schema: CampaignDiplomacySchema,
    label: "Diplomacy record",
    idField: "id",
  },
  { key: "divisions", schema: CampaignDivisionSchema, label: "Division", idField: "id" },
];

interface CampaignCollection {
  key: keyof ValidateOutput;
  schema: ContentSchema;
  label: string;
  idField: string;
}

export class ValidateStage implements CompilerStage<ParseOutput, ValidateOutput> {
  readonly name = "validate";

  run(
    input: ParseOutput,
    _signal: AbortSignal,
    collector: DiagnosticCollector,
  ): ValidateOutput | undefined {
    const { manifest: rawManifest } = input;

    const manifest = rawManifest
      ? validateAgainstSchema(
          rawManifest,
          PackManifestSchema,
          "PackManifest",
          "pack.json",
          collector,
        )
      : (collector.addError("MISSING-MANIFEST", "No manifest document found", {
          stage: "validate",
        }),
        undefined);

    if (!manifest) return undefined;

    const schemas: Record<string, { schema: ContentSchema; label: string }> = {
      rulesets: { schema: RulesetManifestSchema, label: "RulesetManifest" },
      countries: { schema: NationSchema, label: "Nation" },
      areas: { schema: AreaSchema, label: "Area" },
      routes: { schema: RouteEdgeSchema, label: "RouteEdge" },
      possessions: { schema: PossessionSchema, label: "Possession" },
      ports: { schema: PortSchema, label: "Port" },
      technologies: {
        schema: TechnologyPrerequisiteChainSchema,
        label: "TechnologyPrerequisiteChain",
      },
    };

    const validated: Record<string, unknown[]> = {
      rulesets: [],
      countries: [],
      areas: [],
      routes: [],
      possessions: [],
      ports: [],
      technologies: [],
    };

    for (const key of COLLECTION_KEYS) {
      const entry = schemas[key];
      if (!entry) continue;
      const { schema, label } = entry;
      const items = input.collectionDocs.get(key) ?? [];
      for (const item of items) {
        const result = validateAgainstSchema(item, schema, label, `${key}.yaml`, collector);
        if (result !== undefined) {
          const arr = validated[key];
          if (arr) arr.push(result);
        }
      }
    }

    validateDuplicateIds(validated, collector);
    validatePresenceRules(validated["rulesets"] ?? [], collector);
    validateBattleOfferRules(validated["rulesets"] ?? [], collector);
    validateFleetManagementRules(validated["rulesets"] ?? [], collector);
    validateMissingReferences(validated, collector);
    validateTechnologyGraph(validated, input, collector);

    const catalogue = validateShipBuildingCatalogue(input, collector);
    validateShipBuildingDuplicates(catalogue, input, collector);
    validateShipBuildingReferences(validated, catalogue, input, collector);
    validateComponentUpgradeGraph(catalogue, input, collector);

    const campaign = validateCampaignCollections(validated, input, collector);

    const presentation = validatePresentation(input, collector);
    validatePresentationRegions(validated, presentation, input, collector);

    const ui = validateUi(input, collector);

    if (collector.hasErrors) return undefined;

    return {
      manifest,
      rulesets: validated["rulesets"] ?? [],
      countries: validated["countries"] ?? [],
      areas: validated["areas"] ?? [],
      routes: validated["routes"] ?? [],
      possessions: validated["possessions"] ?? [],
      ports: validated["ports"] ?? [],
      technologies: validated["technologies"] ?? [],
      ...catalogue,
      partModelSources: {
        contentDir: input.contentDir,
        parts: sourceById(input, "parts", "id"),
        slotTemplates: sourceById(input, "slotTemplates", "id"),
        platforms: sourceById(input, "platforms", "id"),
        shipTypes: sourceById(input, "shipTypes", "id"),
      },
      fleets: [...campaign.fleets],
      economies: [...campaign.economies],
      constructions: [...campaign.constructions],
      diplomacy: [...campaign.diplomacy],
      research: [...campaign.research],
      designs: [...campaign.designs],
      divisions: [...(campaign.divisions ?? [])],
      ...(presentation !== undefined ? { presentation } : {}),
      ...(ui !== undefined ? { ui } : {}),
    };
  }
}

function validatePresentation(input: ParseOutput, collector: DiagnosticCollector): unknown {
  const raw = input.objectDocs.get("presentation");
  if (raw === undefined) return undefined;
  const sourcePath = input.objectSourcePaths.get("presentation") ?? "presentation.yaml";
  return validateAgainstSchema(
    raw,
    PresentationContentSchema,
    "PresentationContent",
    sourcePath,
    collector,
  );
}

function validateUi(input: ParseOutput, collector: DiagnosticCollector): unknown {
  const raw = input.objectDocs.get("ui");
  if (raw === undefined) return undefined;
  const sourcePath = input.objectSourcePaths.get("ui") ?? "ui/en-US.yaml";
  return validateAgainstSchema(raw, UiCatalogueSchema, "UiCatalogue", sourcePath, collector);
}

function validatePresentationRegions(
  core: Record<string, unknown[]>,
  presentation: unknown,
  input: ParseOutput,
  collector: DiagnosticCollector,
): void {
  if (presentation === null || typeof presentation !== "object") return;
  const sourcePath = input.objectSourcePaths.get("presentation") ?? "presentation.yaml";
  const areaIds = idsOf(core["areas"]);
  const nationIds = idsOf(core["countries"]);

  const fail = (entityId: string, message: string, remediation: string): void => {
    collector.addError("PRESENTATION_REGION", message, {
      stage: "validate",
      sourceLocation: { path: sourcePath, line: 1 },
      entityId,
      remediation,
    });
  };

  const regions = (presentation as { regions?: unknown }).regions;
  if (regions !== null && typeof regions === "object") {
    const declared = idsOf((regions as { regions?: unknown }).regions as unknown[] | undefined);
    const areaRegion = asRecord((regions as { areaRegion?: unknown }).areaRegion);
    if (areaIds.size > 0) {
      for (const areaId of areaIds) {
        if (!(areaId in areaRegion)) {
          fail(
            areaId,
            `Area '${areaId}' has no presentation region`,
            `Add '${areaId}' to presentation.regions.areaRegion`,
          );
        }
      }
      const used = new Set<string>();
      for (const [areaId, regionId] of Object.entries(areaRegion)) {
        if (!areaIds.has(areaId)) {
          fail(
            areaId,
            `Presentation region mapping for unknown area '${areaId}'`,
            `Remove '${areaId}' from presentation.regions.areaRegion`,
          );
        }
        if (typeof regionId === "string") {
          used.add(regionId);
          if (!declared.has(regionId)) {
            fail(
              areaId,
              `Presentation area '${areaId}' maps to unknown region '${regionId}'`,
              `Declare region '${regionId}' in presentation.regions.regions`,
            );
          }
        }
      }
      for (const regionId of declared) {
        if (!used.has(regionId)) {
          fail(
            regionId,
            `Declared presentation region '${regionId}' holds no area`,
            `Assign an area to '${regionId}' or remove it from presentation.regions.regions`,
          );
        }
      }
    }
  }

  const mapJoin = (presentation as { mapJoin?: unknown }).mapJoin;
  if (mapJoin !== null && typeof mapJoin === "object") {
    const fixture = asRecord(
      (mapJoin as { campaignAreaToFixture?: unknown }).campaignAreaToFixture,
    );
    if (areaIds.size > 0) {
      for (const areaId of areaIds) {
        if (!(areaId in fixture)) {
          fail(
            areaId,
            `Area '${areaId}' has no campaign-map fixture mapping`,
            `Add '${areaId}' to presentation.mapJoin.campaignAreaToFixture`,
          );
        }
      }
      for (const areaId of Object.keys(fixture)) {
        if (!areaIds.has(areaId)) {
          fail(
            areaId,
            `Campaign-map fixture mapping for unknown area '${areaId}'`,
            `Remove '${areaId}' from presentation.mapJoin.campaignAreaToFixture`,
          );
        }
      }
    }
    if (nationIds.size > 0) {
      const home = asRecord((mapJoin as { nationHomeArea?: unknown }).nationHomeArea);
      for (const nationId of nationIds) {
        if (!(nationId in home)) {
          fail(
            nationId,
            `Nation '${nationId}' has no home-waters area`,
            `Add '${nationId}' to presentation.mapJoin.nationHomeArea`,
          );
        }
      }
      for (const [nationId, areaId] of Object.entries(home)) {
        if (!nationIds.has(nationId)) {
          fail(
            nationId,
            `Home-waters mapping for unknown nation '${nationId}'`,
            `Remove '${nationId}' from presentation.mapJoin.nationHomeArea`,
          );
        }
        if (typeof areaId === "string" && !areaIds.has(areaId)) {
          fail(
            nationId,
            `Nation '${nationId}' home waters name unknown area '${areaId}'`,
            `Point '${nationId}' at a known area`,
          );
        }
      }
    }
  }
}

function idsOf(items: unknown[] | undefined): Set<string> {
  return new Set(
    (items ?? [])
      .map((item) => (item as Record<string, unknown>)["id"])
      .filter((id): id is string => typeof id === "string"),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function validateCampaignCollections(
  core: Record<string, unknown[]>,
  input: ParseOutput,
  collector: DiagnosticCollector,
): CampaignCollections {
  const out: Partial<Record<keyof ValidateOutput, unknown[]>> = {};
  for (const spec of CAMPAIGN_COLLECTIONS) {
    const items = input.collectionDocs.get(spec.key) ?? [];
    const sources = input.sourcePaths.get(spec.key) ?? [];
    const validated: unknown[] = [];
    items.forEach((item, index) => {
      const sourcePath = sources[index] ?? `${String(spec.key)}.yaml`;
      const result = validateAgainstSchema(item, spec.schema, spec.label, sourcePath, collector);
      if (result !== undefined) validated.push(result);
    });
    out[spec.key] = validated;

    const seen = new Set<string>();
    items.forEach((item, index) => {
      const id = (item as Record<string, unknown>)[spec.idField];
      if (typeof id !== "string") return;
      if (seen.has(id)) {
        collector.addError("DUP-ID", `Duplicate ${spec.label} id '${id}'`, {
          stage: "validate",
          sourceLocation: { path: sources[index] ?? `${String(spec.key)}.yaml`, line: 1 },
          entityId: id,
          remediation: `Give each ${spec.label} a unique '${spec.idField}'`,
        });
      }
      seen.add(id);
    });
  }

  validateCampaignReferences(core, out, input, collector);

  return {
    fleets: out["fleets"] ?? [],
    economies: out["economies"] ?? [],
    constructions: out["constructions"] ?? [],
    diplomacy: out["diplomacy"] ?? [],
    research: out["research"] ?? [],
    designs: out["designs"] ?? [],
    divisions: out["divisions"] ?? [],
  };
}

function validateCampaignReferences(
  core: Record<string, unknown[]>,
  campaign: Partial<Record<keyof ValidateOutput, unknown[]>>,
  input: ParseOutput,
  collector: DiagnosticCollector,
): void {
  const stringIds = (items: readonly unknown[], field: string): Set<string> =>
    new Set(
      items
        .map((item) => (item as Record<string, unknown>)[field])
        .filter((v): v is string => typeof v === "string"),
    );

  const nationIds = stringIds(core["countries"] ?? [], "id");
  const technologyIds = stringIds(core["technologies"] ?? [], "id");
  const designVersionIds = stringIds(campaign["designs"] ?? [], "designVersionId");

  const sources = (key: keyof ValidateOutput, idField: string): Map<string, string> =>
    sourceById(input, key, idField);

  const ref = (
    key: keyof ValidateOutput,
    idField: string,
    entityId: string,
    fieldPath: string,
    message: string,
  ) => {
    collector.addError("REF", message, {
      stage: "validate",
      sourceLocation: { path: sources(key, idField).get(entityId) ?? `${key}.yaml`, line: 1 },
      entityId,
      remediation: `Add the missing reference or fix '${fieldPath}'`,
    });
  };

  if (nationIds.size > 0) {
    for (const spec of CAMPAIGN_COLLECTIONS) {
      for (const item of campaign[spec.key] ?? []) {
        const rec = item as Record<string, unknown>;
        const nationId = rec["nationId"];
        if (typeof nationId === "string" && !nationIds.has(nationId)) {
          const entityId = stringValue(rec[spec.idField]) || nationId;
          ref(
            spec.key,
            spec.idField,
            entityId,
            "nationId",
            `${spec.label} '${entityId}' references unknown nation '${nationId}'`,
          );
        }
      }
    }
  }

  if (designVersionIds.size > 0) {
    for (const item of campaign["fleets"] ?? []) {
      const fleet = item as Record<string, unknown>;
      const fleetId = stringValue(fleet["id"]);
      for (const ship of Array.isArray(fleet["ships"]) ? (fleet["ships"] as unknown[]) : []) {
        const designVersionId = (ship as Record<string, unknown>)["designVersionId"];
        if (typeof designVersionId === "string" && !designVersionIds.has(designVersionId)) {
          ref(
            "fleets",
            "id",
            fleetId,
            "ships[].designVersionId",
            `Fleet '${fleetId}' ship references unknown design version '${designVersionId}'`,
          );
        }
      }
    }
    for (const item of campaign["constructions"] ?? []) {
      const construction = item as Record<string, unknown>;
      const id = stringValue(construction["id"]);
      const designVersionId = construction["designVersionId"];
      if (typeof designVersionId === "string" && !designVersionIds.has(designVersionId)) {
        ref(
          "constructions",
          "id",
          id,
          "designVersionId",
          `Construction '${id}' references unknown design version '${designVersionId}'`,
        );
      }
    }
  }

  const divisions = campaign["divisions"] ?? [];
  if (divisions.length > 0) {
    const shipLocation = new Map<string, { nationId: string; areaId: string }>();
    for (const item of campaign["fleets"] ?? []) {
      const fleet = item as Record<string, unknown>;
      const areaId = stringValue(fleet["locationAreaId"]);
      const fleetNationId = stringValue(fleet["nationId"]);
      for (const ship of Array.isArray(fleet["ships"]) ? (fleet["ships"] as unknown[]) : []) {
        const shipId = stringValue((ship as Record<string, unknown>)["id"]);
        if (shipId !== "") shipLocation.set(shipId, { nationId: fleetNationId, areaId });
      }
    }
    for (const item of divisions) {
      const division = item as Record<string, unknown>;
      const divisionId = stringValue(division["id"]);
      const nationId = stringValue(division["nationId"]);
      const shipOrder = Array.isArray(division["shipOrder"])
        ? (division["shipOrder"] as unknown[])
        : [];
      const areas = new Set<string>();
      for (const shipId of shipOrder) {
        if (typeof shipId !== "string") continue;
        const located = shipLocation.get(shipId);
        if (located === undefined) {
          ref(
            "divisions",
            "id",
            divisionId,
            "shipOrder",
            `Division '${divisionId}' references unknown ship '${shipId}'`,
          );
          continue;
        }
        if (located.nationId !== nationId) {
          ref(
            "divisions",
            "id",
            divisionId,
            "shipOrder",
            `Division '${divisionId}' includes ship '${shipId}' of another nation`,
          );
        }
        areas.add(located.areaId);
      }
      if (areas.size > 1) {
        ref(
          "divisions",
          "id",
          divisionId,
          "shipOrder",
          `Division '${divisionId}' ships are not co-located (${[...areas].join(", ")})`,
        );
      }
    }
  }

  if (technologyIds.size > 0) {
    for (const item of campaign["research"] ?? []) {
      const programme = item as Record<string, unknown>;
      const nationId = stringValue(programme["nationId"]);
      for (const tech of Array.isArray(programme["technologies"])
        ? (programme["technologies"] as unknown[])
        : []) {
        const techId = (tech as Record<string, unknown>)["techId"];
        if (typeof techId === "string" && !technologyIds.has(techId)) {
          ref(
            "research",
            "nationId",
            nationId,
            "technologies[].techId",
            `Research programme '${nationId}' references unknown technology '${techId}'`,
          );
        }
      }
    }
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function validateShipBuildingCatalogue(
  input: ParseOutput,
  collector: DiagnosticCollector,
): ValidatedCatalogue {
  const out: Record<string, unknown[]> = {};
  for (const spec of SHIP_BUILDING_COLLECTIONS) {
    const raw = input.collectionDocs.get(spec.key) ?? [];
    const sources = input.sourcePaths.get(spec.key) ?? [];
    if (spec.schema === undefined) {
      out[spec.key] = raw;
      continue;
    }
    const items: unknown[] = [];
    raw.forEach((item, index) => {
      const sourcePath = sources[index] ?? `${spec.key}.yaml`;
      const result = validateAgainstSchema(item, spec.schema!, spec.label, sourcePath, collector);
      if (result !== undefined) items.push(result);
    });
    out[spec.key] = items;
  }
  return {
    shipComponents: out["shipComponents"] ?? [],
    propulsionPlants: out["propulsionPlants"] ?? [],
    shipHullForms: out["shipHullForms"] ?? [],
    shipBalance: input.objectDocs.get("shipBalance"),
    gunFamilies: out["gunFamilies"] ?? [],
    gunModels: out["gunModels"] ?? [],
    gunMounts: out["gunMounts"] ?? [],
    ammunition: out["ammunition"] ?? [],
    navalProfiles: out["navalProfiles"] ?? [],
    referenceDesigns: out["referenceDesigns"] ?? [],
    parts: out["parts"] ?? [],
    slotTemplates: out["slotTemplates"] ?? [],
    platforms: out["platforms"] ?? [],
    shipTypes: out["shipTypes"] ?? [],
    designLoadouts: out["designLoadouts"] ?? [],
  };
}

function catalogueArrays(catalogue: ValidatedCatalogue): Record<string, unknown[]> {
  return {
    shipComponents: catalogue.shipComponents,
    propulsionPlants: catalogue.propulsionPlants,
    shipHullForms: catalogue.shipHullForms,
    gunFamilies: catalogue.gunFamilies,
    gunModels: catalogue.gunModels,
    gunMounts: catalogue.gunMounts,
    ammunition: catalogue.ammunition,
    navalProfiles: catalogue.navalProfiles,
    referenceDesigns: catalogue.referenceDesigns,
    parts: catalogue.parts,
    slotTemplates: catalogue.slotTemplates,
    platforms: catalogue.platforms,
    shipTypes: catalogue.shipTypes,
    designLoadouts: catalogue.designLoadouts,
  };
}

function validateShipBuildingDuplicates(
  catalogue: ValidatedCatalogue,
  input: ParseOutput,
  collector: DiagnosticCollector,
): void {
  const arrays = catalogueArrays(catalogue);
  for (const spec of SHIP_BUILDING_COLLECTIONS) {
    const items = arrays[spec.key] ?? [];
    const sources = input.sourcePaths.get(spec.key) ?? [];
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const id = (item as Record<string, unknown>)[spec.idField];
      if (typeof id !== "string") return;
      if (seen.has(id)) {
        collector.addError("DUP-ID", `Duplicate ${spec.label} id '${id}'`, {
          stage: "validate",
          sourceLocation: { path: sources[index] ?? `${spec.key}.yaml`, line: 1 },
          entityId: id,
          remediation: `Give each ${spec.label} a unique '${spec.idField}'`,
        });
      }
      seen.add(id);
    });
  }
}

function validateShipBuildingReferences(
  core: Record<string, unknown[]>,
  catalogue: ValidatedCatalogue,
  input: ParseOutput,
  collector: DiagnosticCollector,
): void {
  const arrays = catalogueArrays(catalogue);
  const idFieldByKey = new Map<string, string>(
    SHIP_BUILDING_COLLECTIONS.map((spec) => [spec.key, spec.idField]),
  );
  const ids = (key: keyof ValidateOutput, field = "id"): Set<string> => {
    const items = arrays[key] ?? [];
    return new Set(
      items
        .map((item) => (item as Record<string, unknown>)[field])
        .filter((v): v is string => typeof v === "string"),
    );
  };
  const coreIds = (key: string): Set<string> => {
    const items = core[key] ?? [];
    return new Set(
      items
        .map((item) => (item as Record<string, unknown>)["id"])
        .filter((v): v is string => typeof v === "string"),
    );
  };
  const sourceFor = (key: keyof ValidateOutput, id: string): string => {
    const items = arrays[key] ?? [];
    const sources = input.sourcePaths.get(key) ?? [];
    const field = idFieldByKey.get(key) ?? "id";
    const index = items.findIndex((item) => (item as Record<string, unknown>)[field] === id);
    return sources[index] ?? `${String(key)}.yaml`;
  };

  const componentIds = ids("shipComponents");
  const plantIds = ids("propulsionPlants");
  const hullFormIds = ids("shipHullForms");
  const familyIds = ids("gunFamilies");
  const gunModelIds = ids("gunModels");
  const techIds = coreIds("technologies");

  const ref = (
    sourceKey: keyof ValidateOutput,
    entityId: string,
    fieldPath: string,
    message: string,
  ) => {
    collector.addError("REF", message, {
      stage: "validate",
      sourceLocation: { path: sourceFor(sourceKey, entityId), line: 1 },
      entityId,
      remediation: `Add the missing reference or fix '${fieldPath}'`,
    });
  };

  for (const item of catalogue.gunModels) {
    const rec = item as Record<string, unknown>;
    const id = String(rec["id"]);
    const familyId = rec["familyId"];
    if (typeof familyId === "string" && !familyIds.has(familyId)) {
      ref(
        "gunModels",
        id,
        "familyId",
        `Gun model '${id}' references unknown gun family '${familyId}'`,
      );
    }
    for (const techId of stringArray(rec["requiredTechnologyIds"])) {
      if (!techIds.has(techId)) {
        ref(
          "gunModels",
          id,
          "requiredTechnologyIds",
          `Gun model '${id}' references unknown technology '${techId}'`,
        );
      }
    }
  }

  for (const item of catalogue.gunMounts) {
    const rec = item as Record<string, unknown>;
    const id = String(rec["id"]);
    for (const familyId of stringArray(rec["compatibleGunFamilies"])) {
      if (!familyIds.has(familyId)) {
        ref(
          "gunMounts",
          id,
          "compatibleGunFamilies",
          `Gun mount '${id}' references unknown gun family '${familyId}'`,
        );
      }
    }
  }

  for (const item of catalogue.ammunition) {
    const rec = item as Record<string, unknown>;
    const id = String(rec["id"]);
    for (const familyId of stringArray(rec["compatibleGunFamilies"])) {
      if (!familyIds.has(familyId)) {
        ref(
          "ammunition",
          id,
          "compatibleGunFamilies",
          `Ammunition '${id}' references unknown gun family '${familyId}'`,
        );
      }
    }
    for (const modelId of stringArray(rec["compatibleGunModelIds"])) {
      if (!gunModelIds.has(modelId)) {
        ref(
          "ammunition",
          id,
          "compatibleGunModelIds",
          `Ammunition '${id}' references unknown gun model '${modelId}'`,
        );
      }
    }
  }

  for (const item of catalogue.shipComponents) {
    const rec = item as Record<string, unknown>;
    const id = String(rec["id"]);
    for (const required of stringArray(rec["requires"])) {
      if (!techIds.has(required)) {
        ref(
          "shipComponents",
          id,
          "requires",
          `Component '${id}' requires unknown technology '${required}'`,
        );
      }
    }
    for (const upgrade of stringArray(rec["upgradePath"])) {
      if (!componentIds.has(upgrade)) {
        ref(
          "shipComponents",
          id,
          "upgradePath",
          `Component '${id}' upgradePath references unknown component '${upgrade}'`,
        );
      }
    }
  }

  for (const item of catalogue.navalProfiles) {
    const rec = item as Record<string, unknown>;
    const nationId = String(rec["nationId"]);
    const hard = rec["hardCapabilities"] as Record<string, unknown> | undefined;
    if (hard) {
      for (const hullFormId of stringArray(hard["hullForms"])) {
        if (!hullFormIds.has(hullFormId)) {
          ref(
            "navalProfiles",
            nationId,
            "hardCapabilities.hullForms",
            `Naval profile '${nationId}' references unknown hull form '${hullFormId}'`,
          );
        }
      }
      for (const plantId of stringArray(hard["domesticPlants"])) {
        if (!plantIds.has(plantId)) {
          ref(
            "navalProfiles",
            nationId,
            "hardCapabilities.domesticPlants",
            `Naval profile '${nationId}' references unknown propulsion plant '${plantId}'`,
          );
        }
      }
    }
    const componentAccess = rec["componentAccess"];
    if (componentAccess && typeof componentAccess === "object") {
      for (const componentId of Object.keys(componentAccess)) {
        if (!componentIds.has(componentId)) {
          ref(
            "navalProfiles",
            nationId,
            "componentAccess",
            `Naval profile '${nationId}' references unknown component '${componentId}'`,
          );
        }
      }
    }
  }

  for (const item of catalogue.referenceDesigns) {
    const rec = item as Record<string, unknown>;
    const id = String(rec["id"]);
    const draft = rec["draft"] as Record<string, unknown> | undefined;
    const hull = draft?.["hull"] as Record<string, unknown> | undefined;
    const hullFormId = hull?.["hullFormId"];
    if (typeof hullFormId === "string" && !hullFormIds.has(hullFormId)) {
      ref(
        "referenceDesigns",
        id,
        "draft.hull.hullFormId",
        `Reference design '${id}' references unknown hull form '${hullFormId}'`,
      );
    }
    const machinery = draft?.["machinery"] as Record<string, unknown> | undefined;
    const plantId = machinery?.["plantId"];
    if (typeof plantId === "string" && !plantIds.has(plantId)) {
      ref(
        "referenceDesigns",
        id,
        "draft.machinery.plantId",
        `Reference design '${id}' references unknown propulsion plant '${plantId}'`,
      );
    }
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function sourceById(input: ParseOutput, key: string, idField: string): Map<string, string> {
  const docs = input.collectionDocs.get(key) ?? [];
  const sources = input.sourcePaths.get(key) ?? [];
  const map = new Map<string, string>();
  docs.forEach((doc, index) => {
    const id = (doc as Record<string, unknown>)[idField];
    if (typeof id === "string") map.set(id, sources[index] ?? `${key}.yaml`);
  });
  return map;
}

interface GraphInvariantSpec {
  readonly code: string;
  readonly label: string;
  readonly edgeField: string;
  readonly fallbackSource: string;
}

function validateGraphInvariant(
  items: readonly unknown[],
  idField: string,
  edgesOf: (record: Record<string, unknown>) => string[],
  sources: Map<string, string>,
  spec: GraphInvariantSpec,
  collector: DiagnosticCollector,
): void {
  if (items.length === 0) return;
  const sourceFor = (id: string): string => sources.get(id) ?? spec.fallbackSource;

  const adjacency = new Map<string, string[]>();
  for (const item of items) {
    const id = (item as Record<string, unknown>)[idField];
    if (typeof id === "string") adjacency.set(id, []);
  }

  for (const item of items) {
    const record = item as Record<string, unknown>;
    const id = String(record[idField]);
    for (const edge of edgesOf(record)) {
      if (edge === id) {
        collector.addError(
          "SELF_REFERENCE",
          `${spec.label} '${id}' lists itself in its ${spec.edgeField}`,
          {
            stage: "validate",
            sourceLocation: { path: sourceFor(id), line: 1 },
            entityId: id,
            remediation: `Remove '${id}' from its own ${spec.edgeField}`,
          },
        );
        continue;
      }
      if (adjacency.has(edge)) adjacency.get(id)!.push(edge);
    }
  }

  const cycle = findCycle(adjacency);
  if (cycle !== null) {
    const path = [...cycle, cycle[0]!].join(" -> ");
    collector.addError(spec.code, `${spec.label} cycle detected: ${path}`, {
      stage: "validate",
      sourceLocation: { path: sourceFor(cycle[0]!), line: 1 },
      entityId: cycle[0],
      relatedLocations: cycle.map((id) => ({ path: sourceFor(id), line: 1 })),
      remediation: `Break the ${spec.label.toLowerCase()} cycle among: ${cycle.join(", ")}`,
    });
  }
}

function validateTechnologyGraph(
  validated: Record<string, unknown[]>,
  input: ParseOutput,
  collector: DiagnosticCollector,
): void {
  validateGraphInvariant(
    validated["technologies"] ?? [],
    "id",
    (record) => {
      const prereqs = record["prerequisites"];
      if (!Array.isArray(prereqs)) return [];
      return prereqs
        .map((prereq) => (prereq as Record<string, unknown>)["techId"])
        .filter((techId): techId is string => typeof techId === "string");
    },
    sourceById(input, "technologies", "id"),
    {
      code: "TECHNOLOGY_PREREQUISITE_CYCLE",
      label: "Technology prerequisite",
      edgeField: "prerequisites",
      fallbackSource: "technologies.yaml",
    },
    collector,
  );
}

function validateComponentUpgradeGraph(
  catalogue: ValidatedCatalogue,
  input: ParseOutput,
  collector: DiagnosticCollector,
): void {
  validateGraphInvariant(
    catalogue.shipComponents,
    "id",
    (record) => stringArray(record["upgradePath"]),
    sourceById(input, "shipComponents", "id"),
    {
      code: "COMPONENT_UPGRADE_CYCLE",
      label: "Ship component upgrade",
      edgeField: "upgradePath",
      fallbackSource: "ship-building/components.yaml",
    },
    collector,
  );
}

function findCycle(adjacency: Map<string, string[]>): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of adjacency.keys()) color.set(id, WHITE);
  const stack: string[] = [];
  let found: string[] | null = null;

  const visit = (id: string): boolean => {
    color.set(id, GRAY);
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      if (!adjacency.has(next)) continue;
      const state = color.get(next);
      if (state === GRAY) {
        found = stack.slice(stack.indexOf(next));
        return true;
      }
      if (state === WHITE && visit(next)) return true;
    }
    stack.pop();
    color.set(id, BLACK);
    return false;
  };

  for (const id of [...adjacency.keys()].sort()) {
    if (color.get(id) === WHITE && visit(id)) break;
  }
  return found;
}

function validateDuplicateIds(
  validated: Record<string, unknown[]>,
  collector: DiagnosticCollector,
): void {
  for (const key of COLLECTION_KEYS) {
    const items = validated[key] ?? [];
    const seen = new Set<string>();
    for (const item of items) {
      const id = (item as Record<string, unknown>)["id"];
      if (typeof id === "string") {
        if (seen.has(id)) {
          collector.addError("DUP-ID", `Duplicate ID '${id}' in ${key}`, {
            stage: "validate",
            entityId: id,
          });
        }
        seen.add(id);
      }
    }
  }
}

function collectIds(validated: Record<string, unknown[]>): Map<string, Set<string>> {
  const idMap = new Map<string, Set<string>>();
  for (const key of COLLECTION_KEYS) {
    const items = validated[key] ?? [];
    const ids = new Set<string>();
    for (const item of items) {
      const id = (item as Record<string, unknown>)["id"];
      if (typeof id === "string") {
        ids.add(id);
      }
    }
    idMap.set(key, ids);
  }
  return idMap;
}

function validatePresenceRules(rulesets: readonly unknown[], collector: DiagnosticCollector): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["presence"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "PRESENCE_RULES_AMBIGUOUS",
      `More than one ruleset carries a presence section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of rulesets) {
    const record = ruleset as Record<string, unknown>;
    if (record["presence"] === undefined) continue;
    const rulesetId = String(record["id"]);
    const decoded = decodePresenceRules(record["presence"]);
    if (decoded.ok) continue;
    collector.addError(
      "PRESENCE_RULES_INVALID",
      `Ruleset '${rulesetId}' presence section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author every presence value in ruleset '${rulesetId}', or remove the section to leave it dormant`,
      },
    );
  }
}

function validateBattleOfferRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["battleOffers"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "BATTLE_OFFER_RULES_AMBIGUOUS",
      `More than one ruleset carries a battleOffers section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of rulesets) {
    const record = ruleset as Record<string, unknown>;
    if (record["battleOffers"] === undefined) continue;
    const rulesetId = String(record["id"]);
    const decoded = decodeBattleOfferRules(record["battleOffers"]);
    if (decoded.ok) continue;
    collector.addError(
      "BATTLE_OFFER_RULES_INVALID",
      `Ruleset '${rulesetId}' battleOffers section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author every battleOffers value in ruleset '${rulesetId}', or remove the section to leave it dormant`,
      },
    );
  }
}

function validateFleetManagementRules(
  rulesets: readonly unknown[],
  collector: DiagnosticCollector,
): void {
  const carriers = rulesets.filter(
    (ruleset) => (ruleset as Record<string, unknown>)["fleetManagement"] !== undefined,
  );
  if (carriers.length > 1)
    collector.addError(
      "FLEET_MANAGEMENT_RULES_AMBIGUOUS",
      `More than one ruleset carries a fleetManagement section (${carriers.map((r) => String((r as Record<string, unknown>)["id"])).join(", ")}); exactly one may`,
      { stage: "validate" },
    );
  for (const ruleset of rulesets) {
    const record = ruleset as Record<string, unknown>;
    if (record["fleetManagement"] === undefined) continue;
    const rulesetId = String(record["id"]);
    const decoded = decodeFleetManagementRules(record["fleetManagement"]);
    if (decoded.ok) continue;
    collector.addError(
      "FLEET_MANAGEMENT_RULES_INVALID",
      `Ruleset '${rulesetId}' fleetManagement section is invalid at '${decoded.field}': ${decoded.message}`,
      {
        stage: "validate",
        entityId: rulesetId,
        remediation: `Author every fleetManagement value in ruleset '${rulesetId}', or remove the section to leave it dormant`,
      },
    );
  }
}

function validateMissingReferences(
  validated: Record<string, unknown[]>,
  collector: DiagnosticCollector,
): void {
  const idMap = collectIds(validated);
  const allIds = new Set<string>();
  for (const ids of idMap.values()) {
    for (const id of ids) {
      allIds.add(id);
    }
  }

  const nationIds = idMap.get("countries") ?? new Set();
  const areaIds = idMap.get("areas") ?? new Set();

  for (const nation of validated["countries"] ?? []) {
    const record = nation as Record<string, unknown>;
    const nationId = String(record["id"]);
    const home = record["homeArea"];
    if (home === undefined) {
      collector.addError("HOME_AREA_MISSING", `Nation '${nationId}' has no home area`, {
        stage: "validate",
        entityId: nationId,
        remediation: `Add 'homeArea' to nation '${nationId}'`,
      });
    } else if (typeof home === "string" && !areaIds.has(home)) {
      collector.addError(
        "HOME_AREA_UNKNOWN",
        `Nation '${nationId}' home area names unknown area '${home}'`,
        {
          stage: "validate",
          entityId: nationId,
          remediation: `Point '${nationId}' at a known area`,
        },
      );
    }
  }

  const possessions = validated["possessions"] ?? [];
  for (const p of possessions) {
    const pRecord = p as Record<string, unknown>;
    const pId = pRecord["id"];
    const nationId = pRecord["nationId"];
    const areaId = pRecord["areaId"];
    if (typeof nationId === "string" && !nationIds.has(nationId)) {
      collector.addError(
        "REF",
        `Possession '${String(pId)}' references unknown nation '${nationId}'`,
        {
          stage: "validate",
          entityId: typeof pId === "string" ? pId : undefined,
        },
      );
    }
    if (typeof areaId === "string" && !areaIds.has(areaId)) {
      collector.addError("REF", `Possession '${String(pId)}' references unknown area '${areaId}'`, {
        stage: "validate",
        entityId: typeof pId === "string" ? pId : undefined,
      });
    }
  }

  const ports = validated["ports"] ?? [];
  for (const p of ports) {
    const pRecord = p as Record<string, unknown>;
    const pId = pRecord["id"];
    const areaId = pRecord["areaId"];
    const nationId = pRecord["nationId"];
    if (typeof areaId === "string" && !areaIds.has(areaId)) {
      collector.addError("REF", `Port '${String(pId)}' references unknown area '${areaId}'`, {
        stage: "validate",
        entityId: typeof pId === "string" ? pId : undefined,
      });
    }
    if (typeof nationId === "string" && !nationIds.has(nationId)) {
      collector.addError("REF", `Port '${String(pId)}' references unknown nation '${nationId}'`, {
        stage: "validate",
        entityId: typeof pId === "string" ? pId : undefined,
      });
    }
  }

  const routes = validated["routes"] ?? [];
  for (const r of routes) {
    const rRecord = r as Record<string, unknown>;
    const rId = rRecord["id"];
    const rFrom = rRecord["from"];
    const rTo = rRecord["to"];
    if (typeof rFrom === "string" && !areaIds.has(rFrom)) {
      collector.addError("REF", `Route '${String(rId)}' references unknown area '${rFrom}'`, {
        stage: "validate",
        entityId: typeof rId === "string" ? rId : undefined,
      });
    }
    if (typeof rTo === "string" && !areaIds.has(rTo)) {
      collector.addError("REF", `Route '${String(rId)}' references unknown area '${rTo}'`, {
        stage: "validate",
        entityId: typeof rId === "string" ? rId : undefined,
      });
    }
  }

  const techs = validated["technologies"] ?? [];
  for (const t of techs) {
    const tRecord = t as Record<string, unknown>;
    const tId = tRecord["id"];
    const prereqs = tRecord["prerequisites"];
    if (Array.isArray(prereqs)) {
      for (const prereq of prereqs) {
        const prereqRecord = prereq as Record<string, unknown>;
        const techId = prereqRecord["techId"];
        if (typeof techId === "string" && techId !== tId && !allIds.has(techId)) {
          collector.addError(
            "REF",
            `Technology '${String(tId)}' references unknown prerequisite '${techId}'`,
            {
              stage: "validate",
              entityId: typeof tId === "string" ? tId : undefined,
            },
          );
        }
      }
    }
  }
}
