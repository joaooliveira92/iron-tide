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

export type MountPosition = "Fore" | "Aft" | "Port wing" | "Starboard wing";

export interface ArmamentMount {
  readonly instanceId: string;
  readonly componentId: string;
  readonly name: string;
  readonly side: MountSide;
  readonly position: MountPosition;
  readonly zoneId: string;
  readonly stationPermille: number;
  readonly barrels: number;
  readonly rounds: number | null;
  readonly caliberUm: number;
  readonly displayName: string;
  readonly mountType: string | null;
  readonly fcClass: string | null;
  readonly weightKg: number;
  readonly costMicro: number;
  readonly arcDeg: number | null;
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

export function barrelWord(n: number): string {
  return BARREL_WORDS[n] ?? `${n}-barrel`;
}

export function positionOf(side: MountSide, stationPermille: number): MountPosition {
  if (side === "PORT") return "Port wing";
  if (side === "STBD") return "Starboard wing";
  return stationPermille < 500 ? "Fore" : "Aft";
}

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

export function conflictsFor(
  instanceId: string,
  findings: readonly BoardFinding[],
): readonly BoardFinding[] {
  return findings.filter((f) =>
    f.entities.some((e) => e.kind === "fitting" && e.instanceId === instanceId),
  );
}

export function oppositeSide(side: MountSide): MountSide {
  return side === "PORT" ? "STBD" : side === "STBD" ? "PORT" : "CENTRE";
}

const isWing = (side: MountSide): boolean => side === "PORT" || side === "STBD";

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

export function allMounts(entries: readonly ArmamentEntry[]): ArmamentMount[] {
  return entries.flatMap((e) => [...e.mounts]);
}
