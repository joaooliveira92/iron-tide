/**
 * The inverse readers (ship-part-model ticket 11b, ADR-0154 §19).
 *
 * The whole-catalogue builder (`partCatalogue.ts`) and the per-placement read-path adapters
 * (tickets 03–05) turn today's content into **parts**. These readers go the other way: given a
 * design's header and loadout — the parts representation — they rebuild the legacy runtime
 * shapes the compile reads (`PlacementSpec`, `MachineryPlan`, `ArmourRegion`, `DesignDraft`).
 *
 * They consume the generated parts, never the original legacy placements: a value the parts do
 * not carry is a typed, path-specific failure, never a zero, a `false`, an empty list or a
 * guess. The candidate pipeline (and the round-trip tests) prove that `source → parts → inverse`
 * preserves every represented value.
 */
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

// Failures

/** One typed, path-specific reason a part could not rebuild a legacy runtime shape. */
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
  /** `<design>.<entry>[.<field>]`, e.g. `havock_like.gun_main.entries.guns`. */
  readonly path: string;
  readonly message: string;
}

/** The outcome of an inverse read: a value, or the issues that stopped it. */
export interface InverseResult<T> {
  readonly value: T | null;
  readonly issues: readonly InverseReaderIssue[];
}

/** A part lookup by id (the whole-catalogue index, or a design's part map). */
export type PartLookup = (id: string) => FlattenedPart | undefined;
/** A slot lookup by id (a platform's slots). */
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

// Placements

/** The families the placement reader rebuilds; plant and armour entries are read separately. */
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

/** The one count parameter a part declares, or `null` when it declares none. */
function countParameterOf(part: FlattenedPart): string | null {
  const names = Object.keys(part.parameters ?? {}).sort(compareCodePoints);
  return names[0] ?? null;
}

/**
 * Attach the launcher's compiled torpedo to its placement (ticket 13b). The launcher part names
 * the torpedo part it loads (`spec.loadsTorpedo`); compiling it at a far-future month resolves the
 * model's effective (latest) revision — the part's current authored spec. A launcher whose named
 * torpedo cannot be resolved (missing, not a torpedo, or a malformed spec) is reported as a typed
 * `READER_TORPEDO_UNRESOLVED` issue, never silently dropped: the placement is still built, but the
 * mount will carry no compiled torpedo and combat fails closed rather than defaulting.
 */
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

/**
 * Rebuild the legacy placements from a design's entries. Gun mounts rebuild from their nested
 * gun; launchers and fittings rebuild from their part. A plant or armour entry is skipped: the
 * machinery plan and armour regions are read from the header (below), not as placements.
 */
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
      // A national launcher variant keeps its base launcher's component id as its prototype.
      const componentId = part.origin.prototype?.id ?? part.id;
      const placement = readUnitEntry(reader, entry, componentId, "tubes", entry.mountCount ?? 1);
      if (placement !== null)
        placements.push(
          withCompiledTorpedo(reader, part, placement, `entries[${entry.id ?? entry.slot}]`),
        );
    } else if (part.family === "fitting" || part.family === "sensor") {
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
    // Entry order is the loadout order, which the adapters build in placement order.
    placements,
    issues: [...reader.issues].sort(
      (a, b) => compareCodePoints(a.path, b.path) || compareCodePoints(a.code, b.code),
    ),
  };
}

// The design header: forward and inverse

/** The header facts a design draft carries into the parts representation. */
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
    protection: {
      citadelLengthMm: draft.armour.citadelLengthMm,
      torpedoWarheadKg: draft.armour.torpedoWarheadKg,
      bunkerProtectionBp: draft.armour.bunkerProtectionBp,
      ...(draft.armour.schemeId !== undefined ? { schemeId: draft.armour.schemeId } : {}),
    },
  };
}

/** The machinery plan rebuilt from the plant entry and the header's machinery facts. */
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

/** The armour regions rebuilt from the armour entries and the header's protection figures. */
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

/**
 * Rebuild a whole `DesignDraft` from the parts representation: the header supplies the
 * requirement, hull, machinery residue and protection figures; the entries supply the
 * placements (guns, tubes, fittings), the plant and the armour regions.
 */
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
    },
    issues,
  };
}

/** The compatibility slot a gun mount, launcher or fitting of `iface` in `zone` uses (forward). */
export const zoneSlotId = compatibilitySlotId;
/** The slot an armour region uses (forward). */
export const armourSlotId = armourRegionSlotId;

/** The loadout of a design as the parts representation (no reader: the adapters build it). */
export type DesignLoadout = DesignLoadoutData;
