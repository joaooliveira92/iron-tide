import type {
  ComponentCategory,
  DesignDraft,
  MountSide,
  WorkshopView,
} from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../content.js";
import { SECTIONS, type SectionId, type SectionMeta, type ZoneRange } from "./section-meta.js";

export type FittingKind = "gun" | "torpedo" | "magazine" | "machinery" | "funnel" | "other";

const GUN: readonly ComponentCategory[] = [
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
];
const MACHINERY: readonly ComponentCategory[] = [
  "BOILER",
  "ENGINE",
  "SHAFT_PROPELLER",
  "GENERATOR",
  "FUEL_BUNKER",
];

export function fittingKind(category: ComponentCategory, tags: readonly string[]): FittingKind {
  if (tags.includes("funnel")) return "funnel";
  if (GUN.includes(category)) return "gun";
  if (category === "TORPEDO_TUBE") return "torpedo";
  if (category === "MAGAZINE" || category === "AMMUNITION") return "magazine";
  if (MACHINERY.includes(category)) return "machinery";
  return "other";
}

export interface SectionFitting {
  readonly n: number;
  readonly instanceId: string;
  readonly name: string;
  readonly kind: FittingKind;
  readonly stationPermille: number;
  readonly side: MountSide;
  readonly placementIndex: number;
  readonly weightKg: number | undefined;
  readonly arcDeg: number | undefined;
  readonly protectionBp: number | undefined;
}

export interface SectionFacts {
  readonly id: SectionId;
  readonly meta: SectionMeta;
  readonly zone: ZoneRange | undefined;
  readonly lengthM: number;
  readonly fromBowM: number;
  readonly fittings: readonly SectionFitting[];
  readonly machineryRooms: readonly { stationPermille: number; shareBp: number }[];
  readonly fuelStationPermille: number | undefined;
  readonly load:
    | {
        readonly weightKg: number;
        readonly volumeUsedLitre: number;
        readonly volumeCapacityLitre: number;
        readonly deckUsedMm2: number;
        readonly deckCapacityMm2: number;
      }
    | undefined;
}

export function sectionFacts(
  id: SectionId,
  {
    draft,
    view,
    content,
    zones,
  }: {
    readonly draft: DesignDraft;
    readonly view: WorkshopView;
    readonly content: DrawingBoardContent;
    readonly zones: readonly ZoneRange[];
  },
): SectionFacts {
  const meta = SECTIONS[id];
  const zone = zones.find((z) => z.id === meta.zoneId);
  const lengthWlM = Number(draft.hull.lengthWl) / 1000;
  const entries = new Map(content.catalogue.map((e) => [e.id, e]));
  const weights = new Map(view.compiled.components.map((c) => [c.instanceId, c.weightKg]));
  const arcs = new Map(
    (view.compiled.weapons?.mounts ?? []).map((m) => [m.instanceId, m.effectiveBeamArcDeg]),
  );
  const protection = view.compiled.armour?.magazineProtectionBp ?? {};
  const fittings: SectionFitting[] = [];
  draft.placements.forEach((p, placementIndex) => {
    if (p.zoneId !== meta.zoneId) return;
    const entry = entries.get(p.componentId);
    const kind = entry ? fittingKind(entry.category, entry.tags) : "other";
    fittings.push({
      n: fittings.length + 1,
      instanceId: p.instanceId,
      name: entry?.displayName ?? p.componentId,
      kind,
      stationPermille: p.stationPermille,
      side: p.side ?? "CENTRE",
      placementIndex,
      weightKg: weights.get(p.instanceId),
      arcDeg: arcs.get(p.instanceId),
      protectionBp: kind === "magazine" ? protection[p.instanceId] : undefined,
    });
  });
  const m = draft.machinery;
  const rooms = m.rooms ?? [
    { zoneId: m.zoneId, stationPermille: m.stationPermille, shareBp: 10_000 },
  ];
  const summary = view.compiled.arrangement?.zones.find((z) => z.zoneId === meta.zoneId);
  const span = zone ? zone.endPermille - zone.startPermille : 0;
  return {
    id,
    meta,
    zone,
    lengthM: (span / 1000) * lengthWlM,
    fromBowM: ((zone?.startPermille ?? 0) / 1000) * lengthWlM,
    fittings,
    machineryRooms: rooms
      .filter((r) => r.zoneId === meta.zoneId)
      .map((r) => ({ stationPermille: r.stationPermille, shareBp: r.shareBp })),
    fuelStationPermille: m.fuelZoneId === meta.zoneId ? m.fuelStationPermille : undefined,
    load: summary && {
      weightKg: summary.weightKg,
      volumeUsedLitre: summary.volumeUsedLitre,
      volumeCapacityLitre: summary.volumeCapacityLitre,
      deckUsedMm2: summary.deckUsedMm2,
      deckCapacityMm2: summary.deckCapacityMm2,
    },
  };
}
