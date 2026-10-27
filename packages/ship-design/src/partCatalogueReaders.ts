import type {
  DesignHeaderData,
  DesignLoadoutData,
  FlattenedPart,
  LoadoutData,
  LoadoutEntryData,
  SlotData,
} from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import { armourRegionFromEntry } from "./armourPartAdapter.js";
import type { ArmourRegion } from "./armour.js";
import { compileTorpedo } from "./compileTorpedo.js";
import { armourRegionSlotId, compatibilitySlotId } from "./partCompatibility.js";
import type { ZoneId } from "./arrangement.js";
import type {
  DesignDraft,
  DesignRequirement,
  MachineryPlan,
  PlacementSpec,
} from "./compileShared.js";
import { machineryPlanFromEntry, type MachineryTranslation } from "./plantPartAdapter.js";
import type { HullSpec } from "./hull.js";

export type InverseReaderCode =
  | "READER_UNKNOWN_PART"
  | "READER_UNSUPPORTED_FAMILY"
  | "READER_NO_ENTRY_ID"
  | "READER_NO_NESTED_GUN"
  | "READER_MISSING_GUN_FAMILY"
  | "READER_NO_SLOT"
  | "READER_NO_ZONE"
  | "READER_NO_REGION"
  | "READER_INVALID_VALUE"
  | "READER_NO_MACHINERY"
  | "READER_NO_PLANT_PARAMETER"
  | "READER_TORPEDO_UNRESOLVED";

export interface InverseReaderIssue {
  readonly code: InverseReaderCode;
  readonly path: string;
  readonly message: string;
}

export interface InverseResult<T> {
  readonly value: T | null;
  readonly issues: readonly InverseReaderIssue[];
}

export type PartLookup = (id: string) => FlattenedPart | undefined;
export type SlotLookup = (id: string) => SlotData | undefined;

interface Reader {
  readonly partOf: PartLookup;
  readonly slotOf: SlotLookup;
  readonly designId: string;
  readonly issues: InverseReaderIssue[];
}

const fail = (reader: Reader, code: InverseReaderCode, path: string, message: string): void => {
  reader.issues.push({ code, path: `${reader.designId}.${path}`, message });
};

const SKIPPED_FAMILIES: ReadonlySet<string> = new Set(["propulsion_plant", "armour_material"]);

function readGunPlacement(reader: Reader, entry: LoadoutEntryData): PlacementSpec | null {
  const path = `entries[${entry.id ?? entry.slot}]`;
  if (entry.id === undefined) {
    fail(reader, "READER_NO_ENTRY_ID", path, "a gun entry needs an id to rebuild its instance id.");
    return null;
  }
  const mount = reader.partOf(entry.part);
  if (mount === undefined || mount.family !== "gun_mount") {
    fail(reader, "READER_UNKNOWN_PART", `${path}.part`, `no gun-mount part '${entry.part}'.`);
    return null;
  }
  const gunEntry = entry.entries?.["guns"]?.[0];
  if (gunEntry === undefined) {
    fail(
      reader,
      "READER_NO_NESTED_GUN",
      `${path}.entries.guns`,
      "a mount entry needs one nested gun.",
    );
    return null;
  }
  const gun = reader.partOf(gunEntry.part);
  if (gun === undefined || gun.family !== "gun") {
    fail(
      reader,
      "READER_UNKNOWN_PART",
      `${path}.entries.guns[0]`,
      `no gun part '${gunEntry.part}'.`,
    );
    return null;
  }
  const componentId = gun.spec.gunFamily;
  if (componentId === undefined) {
    fail(
      reader,
      "READER_MISSING_GUN_FAMILY",
      `${path}.entries.guns[0]`,
      "the gun part names no family.",
    );
    return null;
  }
  const slot = reader.slotOf(entry.slot);
  if (slot === undefined) {
    fail(reader, "READER_NO_SLOT", `${path}.slot`, `no slot '${entry.slot}'.`);
    return null;
  }
  if (slot.zone === undefined) {
    fail(reader, "READER_NO_ZONE", `${path}.slot`, `slot '${entry.slot}' names no zone.`);
    return null;
  }
  const mountCount = entry.mountCount ?? 1;
  const barrels = mountCount * mount.spec.gunsPerMount;
  const params: Record<string, number> = { barrels, ...gunEntry.params };
  return {
    instanceId: entry.id,
    componentId,
    zoneId: slot.zone as ZoneId,
    stationPermille: entry.stationPermille ?? 0,
    ...(entry.side !== undefined ? { side: entry.side } : {}),
    params,
    ...(entry.magazineEntry !== undefined ? { magazineRef: entry.magazineEntry } : {}),
  };
}

function readUnitEntry(
  reader: Reader,
  entry: LoadoutEntryData,
  componentId: string,
  countParameter: string | null,
  count: number,
): PlacementSpec | null {
  const path = `entries[${entry.id ?? entry.slot}]`;
  if (entry.id === undefined) {
    fail(reader, "READER_NO_ENTRY_ID", path, "an entry needs an id to rebuild its instance id.");
    return null;
  }
  const slot = reader.slotOf(entry.slot);
  if (slot === undefined) {
    fail(reader, "READER_NO_SLOT", `${path}.slot`, `no slot '${entry.slot}'.`);
    return null;
  }
  if (slot.zone === undefined) {
    fail(reader, "READER_NO_ZONE", `${path}.slot`, `slot '${entry.slot}' names no zone.`);
    return null;
  }
  const params: Record<string, number> = countParameter === null ? {} : { [countParameter]: count };
  for (const [name, value] of Object.entries(entry.params ?? {})) params[name] = value;
  return {
    instanceId: entry.id,
    componentId,
    zoneId: slot.zone as ZoneId,
    stationPermille: entry.stationPermille ?? 0,
    ...(entry.side !== undefined ? { side: entry.side } : {}),
    ...(Object.keys(params).length > 0 ? { params } : {}),
    ...(entry.magazineEntry !== undefined ? { magazineRef: entry.magazineEntry } : {}),
  };
}

function countParameterOf(part: FlattenedPart): string | null {
  const names = Object.keys(part.parameters ?? {}).sort(compareCodePoints);
  return names[0] ?? null;
}

function withCompiledTorpedo(
  reader: Reader,
  launcherPart: Extract<FlattenedPart, { readonly family: "torpedo_launcher" }>,
  placement: PlacementSpec,
  entryPath: string,
): PlacementSpec {
  const torpedoId = launcherPart.spec.loadsTorpedo;
  if (torpedoId === undefined) return placement;
  const torpedo = reader.partOf(torpedoId);
  if (torpedo === undefined || torpedo.family !== "torpedo") {
    fail(
      reader,
      "READER_TORPEDO_UNRESOLVED",
      entryPath,
      `launcher '${launcherPart.id}' names torpedo '${torpedoId}', which is no torpedo part.`,
    );
    return placement;
  }
  const compiled = compileTorpedo(torpedo, "9999-12");
  if (!compiled.ok) {
    fail(
      reader,
      "READER_TORPEDO_UNRESOLVED",
      entryPath,
      `torpedo '${torpedoId}' does not compile: ${compiled.failures.map((f) => f.code).join(", ")}.`,
    );
    return placement;
  }
  return { ...placement, compiledTorpedo: compiled.value };
}

export interface ReadPlacementsInput {
  readonly designId: string;
  readonly entries: readonly LoadoutEntryData[];
  readonly partOf: PartLookup;
  readonly slotOf: SlotLookup;
}

export interface ReadPlacementsResult {
  readonly placements: readonly PlacementSpec[];
  readonly issues: readonly InverseReaderIssue[];
}

export function readPlacements(input: ReadPlacementsInput): ReadPlacementsResult {
  const reader: Reader = {
    partOf: input.partOf,
    slotOf: input.slotOf,
    designId: input.designId,
    issues: [],
  };
  const placements: PlacementSpec[] = [];
  for (const entry of input.entries) {
    const part = input.partOf(entry.part);
    if (part === undefined) {
      fail(
        reader,
        "READER_UNKNOWN_PART",
        `entries[${entry.id ?? entry.slot}].part`,
        `no part '${entry.part}'.`,
      );
      continue;
    }
    if (SKIPPED_FAMILIES.has(part.family)) continue;
    if (part.family === "gun_mount") {
      const placement = readGunPlacement(reader, entry);
      if (placement !== null) placements.push(placement);
    } else if (part.family === "torpedo_launcher") {
      const componentId = part.origin.prototype?.id ?? part.id;
      const placement = readUnitEntry(reader, entry, componentId, "tubes", entry.mountCount ?? 1);
      if (placement !== null)
        placements.push(
          withCompiledTorpedo(reader, part, placement, `entries[${entry.id ?? entry.slot}]`),
        );
    } else if (
      part.family === "fitting" ||
      part.family === "sensor" ||
      part.family === "radar" ||
      part.family === "sonar" ||
      part.family === "asw_weapon" ||
      part.family === "aa_weapon" ||
      part.family === "missile_launcher" ||
      part.family === "hangar"
    ) {
      const placement = readUnitEntry(
        reader,
        entry,
        entry.part,
        countParameterOf(part),
        entry.mountCount ?? 1,
      );
      if (placement !== null) placements.push(placement);
    } else {
      fail(
        reader,
        "READER_UNSUPPORTED_FAMILY",
        `entries[${entry.id ?? entry.slot}]`,
        `family '${part.family}' has no placement reader.`,
      );
    }
  }
  return {
    placements,
    issues: [...reader.issues].sort(
      (a, b) => compareCodePoints(a.path, b.path) || compareCodePoints(a.code, b.code),
    ),
  };
}

export function headerFromDraft(draft: DesignDraft): DesignHeaderData {
  return {
    nation: draft.nationId,
    requirement: draft.requirement,
    hull: draft.hull,
    machinery: {
      fuelCapacityKg: draft.machinery.fuelCapacityKg,
      fuelZoneId: draft.machinery.fuelZoneId,
      fuelStationPermille: draft.machinery.fuelStationPermille,
      foulingBp: draft.machinery.foulingBp,
      ...(draft.machinery.enginePriorityBp !== undefined
        ? { enginePriorityBp: draft.machinery.enginePriorityBp }
        : {}),
      ...(draft.machinery.rooms !== undefined
        ? { rooms: draft.machinery.rooms.map((r) => ({ ...r })) }
        : {}),
    },
    ...(draft.tertiary !== undefined
      ? { tertiary: { caliberUm: draft.tertiary.caliberUm, count: draft.tertiary.count } }
      : {}),
    ...(draft.fireControl !== undefined
      ? { fireControl: { positions: draft.fireControl.positions } }
      : {}),
    ...(draft.colonialServiceFitted === true ? { colonialServiceFitted: true as const } : {}),
    ...(draft.aluminiumSuperstructure === true ? { aluminiumSuperstructure: true as const } : {}),
    ...(draft.antiAircraft !== undefined ? { antiAircraft: { ...draft.antiAircraft } } : {}),
    protection: {
      citadelLengthMm: draft.armour.citadelLengthMm,
      torpedoWarheadKg: draft.armour.torpedoWarheadKg,
      bunkerProtectionBp: draft.armour.bunkerProtectionBp,
      ...(draft.armour.schemeId !== undefined ? { schemeId: draft.armour.schemeId } : {}),
    },
  };
}

export function readMachineryPlan(
  header: DesignHeaderData,
  entries: readonly LoadoutEntryData[],
  partOf: PartLookup,
  slotOf: SlotLookup,
  designId: string,
): InverseResult<MachineryPlan> {
  const reader: Reader = { partOf, slotOf, designId, issues: [] };
  const entry = entries.find((e) => {
    const part = partOf(e.part);
    return part?.family === "propulsion_plant";
  });
  if (entry === undefined) {
    fail(reader, "READER_NO_MACHINERY", "machinery", "no propulsion-plant entry.");
    return { value: null, issues: reader.issues };
  }
  const slot = slotOf(entry.slot);
  if (slot?.zone === undefined) {
    fail(
      reader,
      "READER_NO_ZONE",
      `entries[${entry.id ?? entry.slot}].slot`,
      `slot '${entry.slot}' names no zone.`,
    );
    return { value: null, issues: reader.issues };
  }
  const installedKw = entry.params?.["installedKw"];
  if (installedKw === undefined) {
    fail(
      reader,
      "READER_NO_PLANT_PARAMETER",
      `entries[${entry.id ?? entry.slot}].params.installedKw`,
      "the plant entry carries no installedKw.",
    );
    return { value: null, issues: reader.issues };
  }
  const plantPart = partOf(entry.part);
  if (plantPart === undefined || plantPart.family !== "propulsion_plant") {
    fail(
      reader,
      "READER_UNKNOWN_PART",
      `entries[${entry.id ?? entry.slot}].part`,
      `no plant part '${entry.part}'.`,
    );
    return { value: null, issues: reader.issues };
  }
  const residue = {
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
  const translation: MachineryTranslation = {
    designId,
    plantPart,
    entry,
    legacy: residue,
  };
  return { value: machineryPlanFromEntry(translation, slot.zone as ZoneId), issues: reader.issues };
}

export function readArmourRegions(
  header: DesignHeaderData,
  entries: readonly LoadoutEntryData[],
  partOf: PartLookup,
  slotOf: SlotLookup,
  designId: string,
): InverseResult<readonly ArmourRegion[]> {
  const reader: Reader = { partOf, slotOf, designId, issues: [] };
  const regions: ArmourRegion[] = [];
  for (const entry of entries) {
    const part = partOf(entry.part);
    if (part === undefined) {
      fail(
        reader,
        "READER_UNKNOWN_PART",
        `entries[${entry.id ?? entry.slot}].part`,
        `no part '${entry.part}'.`,
      );
      continue;
    }
    if (part.family !== "armour_material") continue;
    const slot = slotOf(entry.slot);
    const region = slot?.region;
    if (region === undefined) {
      fail(
        reader,
        "READER_NO_REGION",
        `entries[${entry.id ?? entry.slot}].slot`,
        `slot '${entry.slot}' names no armour region.`,
      );
      continue;
    }
    regions.push(armourRegionFromEntry(entry, region as ArmourRegion["region"]));
  }
  return {
    value: regions,
    issues: reader.issues,
  };
}

export interface RebuildDraftResult {
  readonly draft: DesignDraft | null;
  readonly issues: readonly InverseReaderIssue[];
}

export function rebuildDraft(input: {
  readonly designId: string;
  readonly header: DesignHeaderData;
  readonly loadout: LoadoutData;
  readonly partOf: PartLookup;
  readonly slotOf: SlotLookup;
}): RebuildDraftResult {
  const places = readPlacements({
    designId: input.designId,
    entries: input.loadout.entries,
    partOf: input.partOf,
    slotOf: input.slotOf,
  });
  const machinery = readMachineryPlan(
    input.header,
    input.loadout.entries,
    input.partOf,
    input.slotOf,
    input.designId,
  );
  const armour = readArmourRegions(
    input.header,
    input.loadout.entries,
    input.partOf,
    input.slotOf,
    input.designId,
  );
  const issues = [...places.issues, ...machinery.issues, ...armour.issues];
  if (machinery.value === null || armour.value === null) {
    return { draft: null, issues };
  }
  return {
    draft: {
      nationId: input.header.nation,
      requirement: input.header.requirement as DesignRequirement,
      hull: input.header.hull as HullSpec,
      machinery: machinery.value,
      armour: {
        regions: armour.value,
        citadelLengthMm: input.header.protection.citadelLengthMm,
        torpedoWarheadKg: input.header.protection.torpedoWarheadKg,
        bunkerProtectionBp: input.header.protection.bunkerProtectionBp,
        ...(input.header.protection.schemeId !== undefined
          ? { schemeId: input.header.protection.schemeId }
          : {}),
      },
      placements: places.placements,
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
      ...(input.header.aluminiumSuperstructure === true ? { aluminiumSuperstructure: true } : {}),
      ...(input.header.antiAircraft !== undefined
        ? { antiAircraft: { ...input.header.antiAircraft } }
        : {}),
    },
    issues,
  };
}

export const zoneSlotId = compatibilitySlotId;
export const armourSlotId = armourRegionSlotId;

export type DesignLoadout = DesignLoadoutData;
