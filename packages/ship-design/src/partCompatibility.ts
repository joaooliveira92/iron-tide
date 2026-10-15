/**
 * Today's hull forms read as part-model **platforms** with **compatibility slot templates**
 * (ship-part-model SPM-R3, SPM-R19). One slot per zone and interface, accepting whatever is
 * allowed there today; no component authors `allowedZones`, so every zone accepts every
 * read-path interface. Armour materials go in **armour-region slots** (`armour.<region>`),
 * one per region of the closed region list, shared by every hull (D9) — not mount points.
 * Real mount-point slots are P7 work.
 *
 * The records are the strict `@bluewave/content-schema` shapes (`SlotTemplateSchema`,
 * `PlatformSchema`); the read-path tests decode them through those schemas.
 */
import { compareCodePoints } from "@bluewave/deterministic";
import type {
  PartInterface,
  PlatformData,
  SlotData,
  SlotTemplateData,
} from "@bluewave/content-schema";
import { ARMOUR_REGIONS, type ArmourRegionId } from "./armour.js";
import { ZONE_IDS, type ZoneId } from "./arrangement.js";

/**
 * The interfaces the read path places in hull zones: guns (ticket 03), launchers (ticket 04),
 * and the machinery, sensor and ship-system fittings (ticket 05).
 */
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

/** The shared template holding one interface's zone slots. */
export function compatibilityTemplateId(iface: CompatibilityInterface | "armour_material"): string {
  return `compatibility_${iface}`;
}

/** The armour-region slot of one region: `armour.<region>`, lower snake. */
export function armourRegionSlotId(region: ArmourRegionId): string {
  return `armour.${region.toLowerCase()}`;
}

/** Every hull's armour-region slots: one per region, accepting `armour_material` only. */
function armourRegionTemplate(): SlotTemplateData {
  return {
    id: compatibilityTemplateId("armour_material"),
    slots: [...ARMOUR_REGIONS]
      .sort(compareCodePoints)
      .map((region) => ({ id: armourRegionSlotId(region), accepts: ["armour_material"], region })),
  };
}

/** The slot one interface occupies in one zone: `<zone>.<interface>`, lower snake. */
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

/**
 * Read hull forms as platforms. Each interface's template carries the zones every hull
 * shares; a zone only some hulls have becomes a slot on those platforms directly, so no
 * platform offers a zone it does not have. Templates, slots and platforms are in codepoint
 * order, so the result does not depend on the input order.
 */
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
        throw new Error(`partCompatibility: hull form '${hull.id}' has unknown zone '${zone}'`);
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

/** Every slot a platform offers: its templates' slots, then its own (SPM-R3). */
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
