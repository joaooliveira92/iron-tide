import {
  UM_PER_INCH,
  type BatteryRole,
  type DesignDraft,
  type MountSide,
  type WorkshopView,
} from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../components/design-workspace/content.js";
import type { BatteryCard, BatteryMount } from "../../components/design-workspace/batteryView.js";
import type { BoardFinding } from "../../components/design-workspace/validation/boardFindings.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";

/**
 * The Armament section's master-detail view model. Pure: it reads the compiled design, the draft and the
 * findings and returns everything the editor draws. Nothing here edits the design.
 */

/** Where a mount sits, in words: fore/aft on the centreline, or on a wing. */
export type MountPosition = "Fore" | "Aft" | "Port wing" | "Starboard wing";

/** One mount of a battery, with everything the selected-mount editor shows. */
export interface ArmamentMount {
  readonly instanceId: string;
  readonly componentId: string;
  /** Conventional name: A, B, X, Y for centreline mounts; "Port 1" for wings. */
  readonly name: string;
  readonly side: MountSide;
  readonly position: MountPosition;
  readonly zoneId: string;
  readonly stationPermille: number;
  /** Barrels of a gun, or tubes of a torpedo mount. */
  readonly barrels: number;
  /** Rounds per gun; null for torpedo tubes and when the mount carries no `rounds` parameter. */
  readonly rounds: number | null;
  /** Calibre, micrometres; 0 for torpedo tubes. */
  readonly caliberUm: number;
  /** Catalogue name, e.g. "RML 16-inch 80-ton gun in turret". */
  readonly displayName: string;
  /** Installation type from the compiled armament identity (turret, barbette, casemate...); null when unresolved. */
  readonly mountType: string | null;
  /** Fire-control class of the gun, when the catalogue sets one. */
  readonly fcClass: string | null;
  readonly weightKg: number;
  readonly costMicro: number;
  /** Effective beam arc in degrees, when the compile carries one. */
  readonly arcDeg: number | null;
  /** The one-line layout the master list shows, e.g. "A Twin 13-inch Fore". */
  readonly layout: string;
}

export interface ArmamentEntry {
  readonly row: BatteryCard["row"];
  readonly title: string;
  readonly mounts: readonly ArmamentMount[];
}

const BARREL_WORDS: Readonly<Record<number, string>> = {
  1: "Single",
  2: "Twin",
  3: "Triple",
  4: "Quadruple",
};

/** "Single"/"Twin"/"Triple"/"Quadruple", else "5-barrel". */
export function barrelWord(n: number): string {
  return BARREL_WORDS[n] ?? `${n}-barrel`;
}

/** Where a mount sits: a wing by its side, else fore or aft of midships. */
export function positionOf(side: MountSide, stationPermille: number): MountPosition {
  if (side === "PORT") return "Port wing";
  if (side === "STBD") return "Starboard wing";
  return stationPermille < 500 ? "Fore" : "Aft";
}

/** The master list's one-line layout label. Tubes have no calibre. */
export function layoutOf(
  m: {
    readonly name: string;
    readonly barrels: number;
    readonly caliberUm: number;
    readonly position: MountPosition;
  },
  format: PresentationFormat,
): string {
  const arms =
    m.caliberUm === 0
      ? `${m.barrels}-tube`
      : `${barrelWord(m.barrels)} ${format.number(m.caliberUm / UM_PER_INCH, {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        })}-inch`;
  return `${m.name} ${arms} ${m.position}`;
}

function enrich(
  mount: BatteryMount,
  draft: DesignDraft,
  view: WorkshopView,
  content: DrawingBoardContent,
  format: PresentationFormat,
): ArmamentMount {
  const placed = draft.placements.find((p) => p.instanceId === mount.instanceId);
  const summary = view.compiled.components.find((c) => c.instanceId === mount.instanceId);
  const entry =
    placed === undefined ? undefined : content.catalogue.find((e) => e.id === placed.componentId);
  const barrels = summary?.params.barrels ?? summary?.params.tubes ?? 1;
  const caliberUm = summary?.attr.caliberUm ?? 0;
  const position = positionOf(mount.side, mount.stationPermille);
  return {
    instanceId: mount.instanceId,
    componentId: placed?.componentId ?? "",
    name: mount.name,
    side: mount.side,
    position,
    zoneId: placed?.zoneId ?? "",
    stationPermille: mount.stationPermille,
    barrels,
    rounds: caliberUm === 0 ? null : (summary?.params.rounds ?? null),
    caliberUm,
    displayName: entry?.displayName ?? placed?.componentId ?? mount.instanceId,
    mountType: summary?.armament?.mountType ?? null,
    fcClass: entry?.fcClass ?? null,
    weightKg: summary?.weightKg ?? 0,
    costMicro: summary?.costMicro ?? 0,
    arcDeg:
      view.compiled.weapons?.mounts.find((w) => w.instanceId === mount.instanceId)
        ?.effectiveBeamArcDeg ?? null,
    layout: layoutOf({ name: mount.name, barrels, caliberUm, position }, format),
  };
}

/** The mounts of one battery role, each with its compiled detail. */
export function armamentEntries(
  role: BatteryRole,
  cards: readonly BatteryCard[],
  draft: DesignDraft,
  view: WorkshopView,
  content: DrawingBoardContent,
  format: PresentationFormat,
): ArmamentEntry[] {
  return cards
    .filter((c) => c.row.role === role)
    .map((c) => ({
      row: c.row,
      title: c.title,
      mounts: c.mounts.map((m) => enrich(m, draft, view, content, format)),
    }));
}

/** The design's findings about one mount, most severe first (that is how `boardFindings` orders them). */
export function conflictsFor(
  instanceId: string,
  findings: readonly BoardFinding[],
): readonly BoardFinding[] {
  return findings.filter((f) =>
    f.entities.some((e) => e.kind === "fitting" && e.instanceId === instanceId),
  );
}

/** The opposite side of a mount: port becomes starboard, starboard becomes port; the centreline is unchanged. */
export function oppositeSide(side: MountSide): MountSide {
  return side === "PORT" ? "STBD" : side === "STBD" ? "PORT" : "CENTRE";
}

const isWing = (side: MountSide): boolean => side === "PORT" || side === "STBD";

/**
 * The mount a wing mount is paired with: the one on the opposite side at (or nearest to) the same station.
 * Null for centreline mounts and for wings with no counterpart.
 */
export function mirrorOf(
  mount: ArmamentMount,
  entries: readonly ArmamentEntry[],
): ArmamentMount | null {
  if (!isWing(mount.side)) return null;
  const opposite = oppositeSide(mount.side);
  const candidates = entries
    .flatMap((e) => e.mounts)
    .filter((m) => m.side === opposite)
    .sort(
      (a, b) =>
        Math.abs(a.stationPermille - mount.stationPermille) -
          Math.abs(b.stationPermille - mount.stationPermille) ||
        (a.instanceId < b.instanceId ? -1 : 1),
    );
  return candidates[0] ?? null;
}

/** Every mount across the batteries, in display order. */
export function allMounts(entries: readonly ArmamentEntry[]): ArmamentMount[] {
  return entries.flatMap((e) => [...e.mounts]);
}
