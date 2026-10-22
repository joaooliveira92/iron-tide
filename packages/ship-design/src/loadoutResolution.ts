import type {
  DesignHeaderData,
  FlattenedPart,
  LoadoutData,
  LoadoutEntryData,
  SlotData,
} from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import { armourRegionFromEntry, type FlattenedArmourPart } from "./armourPartAdapter.js";
import type { ArmourRegion } from "./armour.js";
import type { ZoneId } from "./arrangement.js";
import type {
  DesignIntent,
  DesignRequirement,
  PlacementSpec,
  Resolved,
  ResolvedTorpedoMount,
} from "./compileShared.js";
import { compileTorpedo } from "./compileTorpedo.js";
import type { HullSpec } from "./hull.js";
import type { PropulsionPlant } from "./machinery.js";
import { basisMultiplier, quantityLines, totalOf } from "./partQuantities.js";
import {
  INSTALLED_KW,
  propulsionPlantFromPart,
  type FlattenedPlantPart,
} from "./plantPartAdapter.js";

export type LoadoutResolutionCode =
  | "RESOLVE_UNKNOWN_PART"
  | "RESOLVE_UNSUPPORTED_FAMILY"
  | "RESOLVE_NO_ENTRY_ID"
  | "RESOLVE_NO_NESTED_GUN"
  | "RESOLVE_MISSING_GUN_FAMILY"
  | "RESOLVE_MISSING_WEAPON_CATEGORY"
  | "RESOLVE_NO_SLOT"
  | "RESOLVE_NO_ZONE"
  | "RESOLVE_NO_REGION"
  | "RESOLVE_NO_ARMOUR_SHAPE"
  | "RESOLVE_NO_MACHINERY"
  | "RESOLVE_NO_PLANT_PARAMETER"
  | "RESOLVE_PLANT_PART_INVALID"
  | "RESOLVE_TORPEDO_UNRESOLVED";

export interface LoadoutResolutionIssue {
  readonly code: LoadoutResolutionCode;
  readonly path: string;
  readonly message: string;
}

export type LoadoutResolution =
  | {
      readonly status: "RESOLVED";
      readonly intent: DesignIntent;
      readonly plant: PropulsionPlant;
      readonly resolved: readonly Resolved[];
      readonly armourParts: readonly FlattenedArmourPart[];
    }
  | { readonly status: "UNRESOLVED"; readonly issues: readonly LoadoutResolutionIssue[] };

export type PartLookup = (id: string) => FlattenedPart | undefined;
export type SlotLookup = (id: string) => SlotData | undefined;

interface Reader {
  readonly designId: string;
  readonly partOf: PartLookup;
  readonly slotOf: SlotLookup;
  readonly issues: LoadoutResolutionIssue[];
}

const fail = (reader: Reader, code: LoadoutResolutionCode, path: string, message: string): void => {
  reader.issues.push({ code, path: `${reader.designId}.${path}`, message });
};

const FITTING_CATEGORY_BY_INTERFACE: Readonly<Record<string, Resolved["category"]>> = {
  magazine: "MAGAZINE",
  electrical_plant: "GENERATOR",
  accommodation: "ACCOMMODATION",
  damage_control: "DAMAGE_CONTROL",
  funnel: "SPECIAL_EQUIPMENT",
  ventilation: "SPECIAL_EQUIPMENT",
};

function placementSlot(
  reader: Reader,
  entry: LoadoutEntryData,
  path: string,
): { slot: SlotData; zone: ZoneId } | null {
  const slot = reader.slotOf(entry.slot);
  if (slot === undefined) {
    fail(reader, "RESOLVE_NO_SLOT", `${path}.slot`, `no slot '${entry.slot}'.`);
    return null;
  }
  if (slot.zone === undefined) {
    fail(reader, "RESOLVE_NO_ZONE", `${path}.slot`, `slot '${entry.slot}' names no zone.`);
    return null;
  }
  return { slot, zone: slot.zone as ZoneId };
}

function countParameterOf(part: FlattenedPart): string | null {
  const names = Object.keys(part.parameters ?? {}).sort(compareCodePoints);
  return names[0] ?? null;
}

function placementSpec(
  entry: LoadoutEntryData & { readonly id: string },
  componentId: string,
  zone: ZoneId,
  params: Record<string, number>,
  compiledTorpedo?: Resolved["spec"]["compiledTorpedo"],
): PlacementSpec {
  return {
    instanceId: entry.id,
    componentId,
    zoneId: zone,
    stationPermille: entry.stationPermille ?? 0,
    ...(entry.side !== undefined ? { side: entry.side } : {}),
    ...(Object.keys(params).length > 0 ? { params } : {}),
    ...(entry.magazineEntry !== undefined ? { magazineRef: entry.magazineEntry } : {}),
    ...(compiledTorpedo !== undefined ? { compiledTorpedo } : {}),
  };
}

interface PartFacts {
  readonly attr: Record<string, number>;
  readonly fcClass?: string;
  readonly fcClasses: readonly string[];
  readonly maintenanceMonthlyBp: number;
  readonly buildWorkMicro: number | null;
  readonly productionLine: string | null;
  readonly requires: readonly string[];
  readonly weightKg: number;
  readonly volumeLitre: number;
  readonly deckFootprintMm2: number;
  readonly crew: number;
  readonly costMicro: number;
  readonly heightMm: number;
  readonly zCgMm: number;
  readonly powerKw: number;
  readonly coolingKw: number;
}

function factsOf(
  part: FlattenedPart,
  lines: ReturnType<typeof quantityLines>,
  mountCount: number,
  containedPerUnit: number,
): PartFacts {
  const engineering = part.engineering;
  const capabilities = part.capabilities ?? [];
  const capability = <K extends string>(kind: K) =>
    capabilities.find((c) => c.kind === kind) as
      | Extract<(typeof capabilities)[number], { kind: K }>
      | undefined;

  const scaled = (
    components:
      | readonly {
          readonly value: number;
          readonly basis: import("@bluewave/content-schema").ApplicationBasis;
        }[]
      | undefined,
  ): number =>
    (components ?? []).reduce(
      (sum, c) => sum + c.value * basisMultiplier(c.basis, mountCount, containedPerUnit),
      0,
    );

  const attr: Record<string, number> = {};
  const spec = part.spec as Readonly<Record<string, number | undefined>>;
  const specAttr = (name: string, source: string = name): void => {
    const value = spec[source];
    if (value !== undefined) attr[name] = value;
  };
  specAttr("caliberUm", "calibreUm");
  specAttr("shellMassG");
  specAttr("chargeBp", "propellantChargeBp");
  specAttr("roundVolumeMl");
  specAttr("rofBaseX100", "mechanicalRateOfFireRoundsPerMinuteX100");
  specAttr("beamArcDeg");
  specAttr("magazineLitre");
  specAttr("flashProtectionBp");
  specAttr("accuracyBonusBp");
  specAttr("capacity", "gunCapacity");

  const feed = capability("ammunition_feed");
  if (feed !== undefined) attr["maxFeedPermille"] = feed.maxFeedPermille;
  const obstruction = capability("arc_obstruction");
  if (obstruction !== undefined) {
    attr["arcBlockedDeg"] = obstruction.blockedDeg;
    attr["arcReachPermille"] = obstruction.reachPermille;
  }
  const damageControl = capability("damage_control");
  if (damageControl !== undefined) attr["damageControlBp"] = damageControl.effectBp;

  const generation = engineering?.power?.generation;
  if (generation !== undefined) attr["genKw"] = scaled(generation);
  const supply = engineering?.cooling?.supply;
  if (supply !== undefined) attr["coolingSupplyKw"] = scaled(supply);
  const flammability = engineering?.flammability;
  if (flammability !== undefined) attr["flammableBp"] = flammability.indexBp;

  const fcClass = capability("fire_control_class");
  const fcClasses = capability("fire_control_support");
  const physical = engineering?.physical;
  return {
    attr,
    ...(fcClass === undefined ? {} : { fcClass: fcClass.class }),
    fcClasses: fcClasses?.classes ?? [],
    maintenanceMonthlyBp: engineering?.maintenance?.monthlyBpOfCost ?? 0,
    buildWorkMicro: part.buildWorkMicro ?? null,
    productionLine: part.productionLine ?? null,
    requires: part.lifecycle.requires ?? [],
    weightKg: totalOf(lines, "massKg"),
    volumeLitre: totalOf(lines, "volumeLitre"),
    deckFootprintMm2: totalOf(lines, "deckFootprintMm2"),
    crew: totalOf(lines, "crew"),
    costMicro: totalOf(lines, "costMicro"),
    heightMm: physical?.envelopeHeightMm ?? 0,
    zCgMm: physical?.centreOfGravity.zMm ?? 0,
    powerKw: scaled(engineering?.power?.consumption),
    coolingKw: scaled(engineering?.cooling?.demand),
  };
}

function resolvedFrom(
  spec: PlacementSpec,
  componentId: string,
  category: Resolved["category"],
  part: FlattenedPart,
  params: Record<string, number>,
  lines: ReturnType<typeof quantityLines>,
  mountCount: number,
  containedPerUnit: number,
  torpedoMount: ResolvedTorpedoMount | null,
  critical: boolean,
): Resolved {
  const facts = factsOf(part, lines, mountCount, containedPerUnit);
  return {
    spec,
    componentId,
    category,
    tags: part.metadata?.tags ?? [],
    ...(facts.fcClass === undefined ? {} : { fcClass: facts.fcClass }),
    fcClasses: facts.fcClasses,
    ...(part.allowedZones === undefined ? {} : { allowedZones: part.allowedZones }),
    forbidsCoLocation: [],
    critical,
    maintenanceMonthlyBp: facts.maintenanceMonthlyBp,
    buildWorkMicro: facts.buildWorkMicro,
    productionLine: facts.productionLine,
    requires: facts.requires,
    torpedoMount,
    params,
    weightKg: facts.weightKg,
    volumeLitre: facts.volumeLitre,
    deckFootprintMm2: facts.deckFootprintMm2,
    heightMm: facts.heightMm,
    zCgMm: facts.zCgMm,
    powerKw: facts.powerKw,
    coolingKw: facts.coolingKw,
    crew: facts.crew,
    costMicro: facts.costMicro,
    attr: facts.attr,
  };
}

function readGunPlacement(
  reader: Reader,
  entry: LoadoutEntryData,
  mount: Extract<FlattenedPart, { readonly family: "gun_mount" }>,
  path: string,
): Resolved | null {
  if (entry.id === undefined) {
    fail(reader, "RESOLVE_NO_ENTRY_ID", path, "a gun entry needs an id to name its instance.");
    return null;
  }
  const gunEntry = entry.entries?.["guns"]?.[0];
  if (gunEntry === undefined) {
    fail(
      reader,
      "RESOLVE_NO_NESTED_GUN",
      `${path}.entries.guns`,
      "a mount entry needs one nested gun.",
    );
    return null;
  }
  const gun = reader.partOf(gunEntry.part);
  if (gun === undefined || gun.family !== "gun") {
    fail(
      reader,
      "RESOLVE_UNKNOWN_PART",
      `${path}.entries.guns[0]`,
      `no gun part '${gunEntry.part}'.`,
    );
    return null;
  }
  if (gun.spec.gunFamily === undefined) {
    fail(
      reader,
      "RESOLVE_MISSING_GUN_FAMILY",
      `${path}.entries.guns[0]`,
      "the gun part names no family.",
    );
    return null;
  }
  if (gun.spec.weaponCategory === undefined) {
    fail(
      reader,
      "RESOLVE_MISSING_WEAPON_CATEGORY",
      `${path}.entries.guns[0]`,
      `gun part '${gun.id}' names no weapon category.`,
    );
    return null;
  }
  const placed = placementSlot(reader, entry, path);
  if (placed === null) return null;
  const mountCount = entry.mountCount ?? 1;
  const gunsPerMount = mount.spec.gunsPerMount;
  const containedUnits = mountCount * gunsPerMount;
  const rounds = gunEntry.params?.["rounds"] ?? gun.parameters?.["rounds"]?.min;
  const params: Record<string, number> = {
    barrels: containedUnits,
    ...(rounds === undefined ? {} : { rounds }),
    ...gunEntry.params,
  };
  const lines = [
    ...quantityLines(mount.quantities, "mount", mount.id, mountCount, gunsPerMount),
    ...quantityLines(gun.quantities, "gun", gun.id, containedUnits, 1),
  ];
  return resolvedFrom(
    placementSpec({ ...entry, id: entry.id }, gun.spec.gunFamily, placed.zone, params),
    gun.spec.gunFamily,
    gun.spec.weaponCategory,
    gun,
    params,
    lines,
    containedUnits,
    1,
    null,
    false,
  );
}

function readLauncherPlacement(
  reader: Reader,
  entry: LoadoutEntryData,
  launcher: Extract<FlattenedPart, { readonly family: "torpedo_launcher" }>,
  path: string,
): Resolved | null {
  if (entry.id === undefined) {
    fail(reader, "RESOLVE_NO_ENTRY_ID", path, "an entry needs an id to name its instance.");
    return null;
  }
  const placed = placementSlot(reader, entry, path);
  if (placed === null) return null;
  const mountCount = entry.mountCount ?? 1;
  const params: Record<string, number> = { tubes: mountCount, ...entry.params };
  const lines = quantityLines(launcher.quantities, "launcher", launcher.id, mountCount, 1);
  const componentId = launcher.origin.prototype?.id ?? launcher.id;
  const torpedoMount = launcherTorpedoMount(reader, launcher, path);
  const spec = placementSpec(
    { ...entry, id: entry.id },
    componentId,
    placed.zone,
    params,
    torpedoMount?.compiledTorpedo,
  );
  return resolvedFrom(
    spec,
    componentId,
    "TORPEDO_TUBE",
    launcher,
    params,
    lines,
    mountCount,
    1,
    torpedoMount,
    false,
  );
}

function launcherTorpedoMount(
  reader: Reader,
  launcher: Extract<FlattenedPart, { readonly family: "torpedo_launcher" }>,
  path: string,
): ResolvedTorpedoMount | null {
  const torpedoId = launcher.spec.loadsTorpedo;
  if (torpedoId === undefined) return null;
  const torpedo = reader.partOf(torpedoId);
  if (torpedo === undefined || torpedo.family !== "torpedo") {
    fail(
      reader,
      "RESOLVE_TORPEDO_UNRESOLVED",
      path,
      `launcher '${launcher.id}' names torpedo '${torpedoId}', which is no torpedo part.`,
    );
    return null;
  }
  const compiled = compileTorpedo(torpedo, "9999-12");
  if (!compiled.ok) {
    fail(
      reader,
      "RESOLVE_TORPEDO_UNRESOLVED",
      path,
      `torpedo '${torpedoId}' does not compile: ${compiled.failures.map((f) => f.code).join(", ")}.`,
    );
    return null;
  }
  return {
    mountType: launcher.spec.launchType,
    torpedoModelId: torpedoId,
    compiledTorpedo: compiled.value,
  };
}

function readFittingPlacement(
  reader: Reader,
  entry: LoadoutEntryData,
  part: Extract<FlattenedPart, { readonly family: "fitting" | "sensor" }>,
  path: string,
): Resolved | null {
  if (entry.id === undefined) {
    fail(reader, "RESOLVE_NO_ENTRY_ID", path, "an entry needs an id to name its instance.");
    return null;
  }
  const placed = placementSlot(reader, entry, path);
  if (placed === null) return null;
  const category =
    part.family === "sensor" ? "RANGEFINDER" : FITTING_CATEGORY_BY_INTERFACE[part.provides];
  if (category === undefined) {
    fail(
      reader,
      "RESOLVE_UNSUPPORTED_FAMILY",
      path,
      `fitting '${part.id}' provides '${part.provides}', which has no component category.`,
    );
    return null;
  }
  const countParameter = countParameterOf(part);
  const mountCount = entry.mountCount ?? 1;
  const params: Record<string, number> = {
    ...(countParameter === null ? {} : { [countParameter]: mountCount }),
    ...entry.params,
  };
  const lines = quantityLines(part.quantities, "fitting", part.id, mountCount, 1);
  const critical = part.family === "fitting" ? (part.spec.critical ?? false) : false;
  return resolvedFrom(
    placementSpec({ ...entry, id: entry.id }, part.id, placed.zone, params),
    part.id,
    category,
    part,
    params,
    lines,
    mountCount,
    1,
    null,
    critical,
  );
}

interface EntryRead {
  readonly plant: {
    readonly part: FlattenedPlantPart;
    readonly entry: LoadoutEntryData;
    readonly zone: ZoneId;
  } | null;
  readonly regions: readonly {
    readonly region: ArmourRegion;
    readonly material: FlattenedArmourPart;
  }[];
  readonly resolved: readonly Resolved[];
}

function readEntry(reader: Reader, entry: LoadoutEntryData, read: EntryRead): EntryRead {
  const path = `entries[${entry.id ?? entry.slot}]`;
  const part = reader.partOf(entry.part);
  if (part === undefined) {
    fail(reader, "RESOLVE_UNKNOWN_PART", `${path}.part`, `no part '${entry.part}'.`);
    return read;
  }
  switch (part.family) {
    case "propulsion_plant": {
      if (read.plant !== null) return read;
      const placed = placementSlot(reader, entry, path);
      if (placed === null) return read;
      const installedKw = entry.params?.[INSTALLED_KW];
      if (installedKw === undefined || part.parameters?.[INSTALLED_KW] === undefined) {
        fail(
          reader,
          "RESOLVE_NO_PLANT_PARAMETER",
          `${path}.params.${INSTALLED_KW}`,
          `plant '${part.id}' carries no ${INSTALLED_KW}.`,
        );
        return read;
      }
      return { ...read, plant: { part, entry, zone: placed.zone } };
    }
    case "armour_material": {
      const slot = reader.slotOf(entry.slot);
      if (slot?.region === undefined) {
        fail(
          reader,
          "RESOLVE_NO_REGION",
          `${path}.slot`,
          `slot '${entry.slot}' names no armour region.`,
        );
        return read;
      }
      if (entry.shape === undefined) {
        fail(
          reader,
          "RESOLVE_NO_ARMOUR_SHAPE",
          `${path}.shape`,
          `armour entry '${entry.slot}' has no plate shape.`,
        );
        return read;
      }
      return {
        ...read,
        regions: [
          ...read.regions,
          {
            region: armourRegionFromEntry(entry, slot.region as ArmourRegion["region"]),
            material: part,
          },
        ],
      };
    }
    case "gun_mount": {
      const resolved = readGunPlacement(reader, entry, part, path);
      return resolved === null ? read : { ...read, resolved: [...read.resolved, resolved] };
    }
    case "torpedo_launcher": {
      const resolved = readLauncherPlacement(reader, entry, part, path);
      return resolved === null ? read : { ...read, resolved: [...read.resolved, resolved] };
    }
    case "fitting":
    case "sensor": {
      const resolved = readFittingPlacement(reader, entry, part, path);
      return resolved === null ? read : { ...read, resolved: [...read.resolved, resolved] };
    }
    default:
      fail(
        reader,
        "RESOLVE_UNSUPPORTED_FAMILY",
        path,
        `family '${part.family}' has no placement reader.`,
      );
      return read;
  }
}

function machineryPlan(
  header: DesignHeaderData,
  plant: {
    readonly part: FlattenedPlantPart;
    readonly entry: LoadoutEntryData;
    readonly zone: ZoneId;
  },
): DesignIntent["machinery"] {
  const { entry } = plant;
  return {
    plantId: plant.part.id,
    installedKw: entry.params![INSTALLED_KW]!,
    zoneId: plant.zone,
    stationPermille: entry.stationPermille ?? 0,
    fuelCapacityKg: header.machinery.fuelCapacityKg,
    fuelZoneId: header.machinery.fuelZoneId,
    fuelStationPermille: header.machinery.fuelStationPermille,
    foulingBp: header.machinery.foulingBp,
    ...(header.machinery.enginePriorityBp !== undefined
      ? { enginePriorityBp: header.machinery.enginePriorityBp }
      : {}),
    ...(header.machinery.rooms !== undefined
      ? { rooms: header.machinery.rooms.map((r) => ({ ...r })) }
      : {}),
  };
}

export function resolveLoadout(input: {
  readonly designId: string;
  readonly header: DesignHeaderData;
  readonly loadout: LoadoutData;
  readonly partOf: PartLookup;
  readonly slotOf: SlotLookup;
}): LoadoutResolution {
  const reader: Reader = {
    designId: input.designId,
    partOf: input.partOf,
    slotOf: input.slotOf,
    issues: [],
  };
  let read: EntryRead = { plant: null, regions: [], resolved: [] };
  for (const entry of input.loadout.entries) read = readEntry(reader, entry, read);

  if (read.plant === null) {
    fail(reader, "RESOLVE_NO_MACHINERY", "machinery", "no propulsion-plant entry.");
  }
  const issues = [...reader.issues].sort(
    (a, b) => compareCodePoints(a.path, b.path) || compareCodePoints(a.code, b.code),
  );
  if (issues.length > 0 || read.plant === null) return { status: "UNRESOLVED", issues };

  let plant: PropulsionPlant;
  try {
    plant = propulsionPlantFromPart(read.plant.part);
  } catch (e) {
    fail(
      reader,
      "RESOLVE_PLANT_PART_INVALID",
      `entries[${read.plant.entry.id ?? read.plant.entry.slot}]`,
      e instanceof Error ? e.message : String(e),
    );
    return {
      status: "UNRESOLVED",
      issues: [...reader.issues].sort(
        (a, b) => compareCodePoints(a.path, b.path) || compareCodePoints(a.code, b.code),
      ),
    };
  }

  const intent: DesignIntent = {
    nationId: input.header.nation,
    requirement: input.header.requirement as DesignRequirement,
    hull: input.header.hull as HullSpec,
    machinery: machineryPlan(input.header, read.plant),
    armour: {
      regions: read.regions.map((r) => r.region),
      citadelLengthMm: input.header.protection.citadelLengthMm,
      torpedoWarheadKg: input.header.protection.torpedoWarheadKg,
      bunkerProtectionBp: input.header.protection.bunkerProtectionBp,
      ...(input.header.protection.schemeId !== undefined
        ? { schemeId: input.header.protection.schemeId }
        : {}),
    },
    ...(input.header.tertiary !== undefined
      ? {
          tertiary: {
            caliberUm: input.header.tertiary.caliberUm,
            count: input.header.tertiary.count,
          },
        }
      : {}),
    ...(input.header.fireControl !== undefined
      ? { fireControl: { positions: input.header.fireControl.positions } }
      : {}),
    ...(input.header.colonialServiceFitted === true ? { colonialServiceFitted: true } : {}),
  };
  return {
    status: "RESOLVED",
    intent,
    plant,
    resolved: [...read.resolved].sort((a, b) =>
      compareCodePoints(a.spec.instanceId, b.spec.instanceId),
    ),
    armourParts: read.regions.map((r) => r.material),
  };
}
