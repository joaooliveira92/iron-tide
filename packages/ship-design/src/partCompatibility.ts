import { compareCodePoints } from "@bluewave/deterministic";
import type {
  PartInterface,
  PlatformData,
  SlotData,
  SlotTemplateData,
} from "@bluewave/content-schema";
import { ARMOUR_REGIONS, type ArmourRegionId } from "./armour.js";
import { ZONE_IDS, type ZoneId } from "./arrangement.js";
import { designInvariant } from "./errors.js";

export const COMPATIBILITY_INTERFACES = [
  "gun_mount",
  "torpedo_launcher",
  "propulsion_plant",
  "sensor",
  "magazine",
  "funnel",
  "electrical_plant",
  "accommodation",
  "damage_control",
  "ventilation",
] as const satisfies readonly PartInterface[];
export type CompatibilityInterface = (typeof COMPATIBILITY_INTERFACES)[number];

export function compatibilityTemplateId(iface: CompatibilityInterface | "armour_material"): string {
  return `compatibility_${iface}`;
}

export function armourRegionSlotId(region: ArmourRegionId): string {
  return `armour.${region.toLowerCase()}`;
}

function armourRegionTemplate(): SlotTemplateData {
  return {
    id: compatibilityTemplateId("armour_material"),
    slots: [...ARMOUR_REGIONS]
      .sort(compareCodePoints)
      .map((region) => ({ id: armourRegionSlotId(region), accepts: ["armour_material"], region })),
  };
}

export function compatibilitySlotId(zoneId: ZoneId, iface: CompatibilityInterface): string {
  return `${zoneId.toLowerCase()}.${iface}`;
}

function zoneSlot(zone: ZoneId, iface: CompatibilityInterface): SlotData {
  return { id: compatibilitySlotId(zone, iface), accepts: [iface], zone };
}

const KNOWN_ZONES: ReadonlySet<string> = new Set(ZONE_IDS);

function isZoneId(zone: string): zone is ZoneId {
  return KNOWN_ZONES.has(zone);
}

export interface CompatibilityModel {
  readonly slotTemplates: readonly SlotTemplateData[];
  readonly platforms: readonly PlatformData[];
}

export function buildCompatibilitySlots(input: {
  readonly hullForms: readonly {
    readonly id: string;
    readonly zones: readonly { readonly id: string }[];
  }[];
}): CompatibilityModel {
  const hulls = [...input.hullForms].sort((a, b) => compareCodePoints(a.id, b.id));
  const zonesOf = (hull: (typeof hulls)[number]): ZoneId[] =>
    [...new Set(hull.zones.map((z) => z.id))].sort(compareCodePoints).map((zone) => {
      if (!isZoneId(zone)) {
        throw designInvariant(
          `partCompatibility: hull form '${hull.id}' has unknown zone '${zone}'`,
        );
      }
      return zone;
    });
  const shared = hulls
    .map(zonesOf)
    .reduce<ZoneId[] | null>(
      (acc, zones) => (acc === null ? zones : acc.filter((z) => zones.includes(z))),
      null,
    );
  const sharedZones = shared ?? [];
  const zoneTemplates: SlotTemplateData[] =
    sharedZones.length === 0
      ? []
      : COMPATIBILITY_INTERFACES.map((iface) => ({
          id: compatibilityTemplateId(iface),
          slots: sharedZones.map((zone) => zoneSlot(zone, iface)),
        }));
  const slotTemplates = [...zoneTemplates, armourRegionTemplate()].sort((a, b) =>
    compareCodePoints(a.id, b.id),
  );
  return {
    slotTemplates,
    platforms: hulls.map((hull) => {
      const own = zonesOf(hull).filter((z) => !sharedZones.includes(z));
      return {
        id: hull.id,
        hullForm: hull.id,
        slotTemplates: slotTemplates.map((t) => t.id),
        ...(own.length === 0
          ? {}
          : {
              slots: COMPATIBILITY_INTERFACES.flatMap((iface) =>
                own.map((zone) => zoneSlot(zone, iface)),
              ),
            }),
      };
    }),
  };
}

export function platformSlots(
  model: CompatibilityModel,
  platformId: string,
): readonly SlotData[] | null {
  const platform = model.platforms.find((p) => p.id === platformId);
  if (platform === undefined) return null;
  const fromTemplates = platform.slotTemplates.flatMap(
    (id) => model.slotTemplates.find((t) => t.id === id)?.slots ?? [],
  );
  return [...fromTemplates, ...(platform.slots ?? [])];
}
