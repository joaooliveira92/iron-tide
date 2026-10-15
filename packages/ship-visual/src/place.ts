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

/** One placed component as the drawing sees it, read from the compiled design. */
export interface VisualMountInput {
  readonly instanceId: string;
  readonly stationPermille: number;
  readonly side: "CENTRE" | "PORT" | "STBD" | undefined;
  /** The component category (`MAIN_GUN`, …); non-guns are ignored. */
  readonly category: string;
  /** The compiled armament mount type, when the design compiled one. */
  readonly mountType: string | undefined;
  readonly gunCount: number;
  readonly caliberUm: number | undefined;
}

/** The side profile a mount is seated on, in px. Bow at the left, y down. */
export interface ProfileSurface {
  readonly x: (permille: number) => number;
  /** Deck-edge y at a station. */
  readonly deckY: (permille: number) => number;
  /** The superstructure's lower top at a station inside it, else undefined. */
  readonly houseTopY: (permille: number) => number | undefined;
  /** The profile's uniform vertical scale. */
  readonly pxPerM: number;
}

export interface PlacedSymbol {
  readonly x: number;
  readonly y: number;
  /** px per authored metre. */
  readonly scale: number;
}

export interface PlacedMount {
  readonly instanceId: string;
  /** The placement's station, clamped to the hull. */
  readonly stationPermille: number;
  readonly part: MountPart;
  readonly partId: string;
  readonly step: FallbackStep;
  readonly mountClass: MountClass;
  readonly size: SizeBand;
  readonly caliberUm: number;
  /** Guns drawn per symbol (1–4); single-gun classes draw one symbol per gun instead. */
  readonly guns: number;
  /** The placement's true gun count. */
  readonly gunCount: number;
  readonly side: "CENTRE" | "PORT" | "STBD";
  /** Forward mounts train toward the bow, the rest toward the stern (a convention). */
  readonly facing: "BOW" | "STERN";
  /** On the port side: seen through the ship from starboard. */
  readonly far: boolean;
  readonly symbols: readonly PlacedSymbol[];
}

export interface MountPlacement {
  readonly placed: readonly PlacedMount[];
  /** Guns that could not be sized (no calibre), so are not drawn. */
  readonly unresolved: readonly string[];
}

/** The manual's reference calibre: symbols are drawn at the size of a 12-inch gun (p142). */
const REFERENCE_CALIBER_UM = 304_800;
/** DISPLAY clamp on the calibre resize, so tiny and huge guns stay legible against the hull. */
const CALIBER_FACTOR = { min: 0.3, max: 1.5 } as const;
/** DISPLAY floor on a drawn body's width, px. */
const MIN_SYMBOL_PX = 4;
/** CONVENTION: single-gun rows are spaced at this multiple of the body width. */
const ROW_PITCH = 1.15;
/** Single-gun rows longer than this are drawn at this length (the title keeps the true count). */
const MAX_ROW = 8;
const MAX_MOUNT_GUNS = 4;

const SIDE_RANK = { PORT: 0, CENTRE: 1, STBD: 2 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Resolve and seat every gun mount of a design in the side profile. Pure and deterministic: output order is port
 * before centre before starboard (far side drawn first), then station, then instance id.
 */
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
    // CONVENTION: a casemate hangs in the hull side from the deck edge (its drawing extends below the seat); any
    // other mount stands on the superstructure inside it, otherwise on the deck, exactly as funnels do.
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
