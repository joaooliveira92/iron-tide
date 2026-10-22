import type { MountPart, PartCatalog } from "./catalog.js";
import { resolveMount, type FallbackStep } from "./resolve.js";
import {
  MULTI_GUN_CLASSES,
  mountClassOf,
  sizeBandOf,
  type MountClass,
  type NationStyle,
  type SizeBand,
  type VisualEra,
} from "./vocabulary.js";

export interface VisualMountInput {
  readonly instanceId: string;
  readonly stationPermille: number;
  readonly side: "CENTRE" | "PORT" | "STBD" | undefined;
  readonly category: string;
  readonly mountType: string | undefined;
  readonly gunCount: number;
  readonly caliberUm: number | undefined;
}

export interface ProfileSurface {
  readonly x: (permille: number) => number;
  readonly deckY: (permille: number) => number;
  readonly houseTopY: (permille: number) => number | undefined;
  readonly pxPerM: number;
}

export interface PlacedSymbol {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface PlacedMount {
  readonly instanceId: string;
  readonly stationPermille: number;
  readonly part: MountPart;
  readonly partId: string;
  readonly step: FallbackStep;
  readonly mountClass: MountClass;
  readonly size: SizeBand;
  readonly caliberUm: number;
  readonly guns: number;
  readonly gunCount: number;
  readonly side: "CENTRE" | "PORT" | "STBD";
  readonly facing: "BOW" | "STERN";
  readonly far: boolean;
  readonly symbols: readonly PlacedSymbol[];
}

export interface MountPlacement {
  readonly placed: readonly PlacedMount[];
  readonly unresolved: readonly string[];
}

const REFERENCE_CALIBER_UM = 304_800;
const CALIBER_FACTOR = { min: 0.3, max: 1.5 } as const;
const MIN_SYMBOL_PX = 4;
const ROW_PITCH = 1.15;
const MAX_ROW = 8;
const MAX_MOUNT_GUNS = 4;

const SIDE_RANK = { PORT: 0, CENTRE: 1, STBD: 2 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function placeMounts(
  catalog: PartCatalog,
  inputs: readonly VisualMountInput[],
  look: { readonly style: NationStyle; readonly era: VisualEra },
  surface: ProfileSurface,
): MountPlacement {
  const placed: PlacedMount[] = [];
  const unresolved: string[] = [];
  const ordered = [...inputs].sort(
    (a, b) =>
      SIDE_RANK[a.side ?? "CENTRE"] - SIDE_RANK[b.side ?? "CENTRE"] ||
      a.stationPermille - b.stationPermille ||
      (a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0),
  );
  for (const input of ordered) {
    const mountClass = mountClassOf(input.category, input.mountType);
    if (mountClass === null) continue;
    if (input.caliberUm === undefined || !(input.caliberUm > 0)) {
      unresolved.push(input.instanceId);
      continue;
    }
    const size = sizeBandOf(input.caliberUm);
    const multi = MULTI_GUN_CLASSES.has(mountClass);
    const gunCount = Math.max(1, Math.trunc(input.gunCount));
    const guns = multi ? Math.min(gunCount, MAX_MOUNT_GUNS) : 1;
    const resolution = resolveMount(catalog, { ...look, size, mountClass, guns });
    if (resolution === null) {
      unresolved.push(input.instanceId);
      continue;
    }
    const { part } = resolution;
    const factor = clamp(
      input.caliberUm / REFERENCE_CALIBER_UM,
      CALIBER_FACTOR.min,
      CALIBER_FACTOR.max,
    );
    const scale = Math.max(surface.pxPerM * factor, MIN_SYMBOL_PX / part.profile.widthM);
    const station = clamp(input.stationPermille, 0, 1000);
    const deckY = surface.deckY(station);
    const y = mountClass === "CASEMATE" ? deckY : (surface.houseTopY(station) ?? deckY);
    const count = multi ? 1 : Math.min(gunCount, MAX_ROW);
    const pitch = ROW_PITCH * part.profile.widthM * scale;
    const cx = surface.x(station);
    const side = input.side ?? "CENTRE";
    placed.push({
      instanceId: input.instanceId,
      stationPermille: station,
      part,
      partId: part.id,
      step: resolution.step,
      mountClass,
      size,
      caliberUm: input.caliberUm,
      guns,
      gunCount,
      side,
      facing: station < 500 ? "BOW" : "STERN",
      far: side === "PORT",
      symbols: Array.from({ length: count }, (_, i) => ({
        x: cx + (i - (count - 1) / 2) * pitch,
        y,
        scale,
      })),
    });
  }
  return { placed, unresolved };
}
