import { createContext, use, useMemo, useState, type ReactNode } from "react";
import type {
  DesignDraft,
  DraftEdit,
  MountSide,
  PartCatalogueEntry,
  ZoneId,
} from "@bluewave/ship-design";
import { BluewaveError } from "@bluewave/contracts";
import type { DrawingBoardContent } from "../../../../components/design-workspace/content.js";
import type { BoardFinding } from "../../../../components/design-workspace/validation/boardFindings.js";
import type { ShipEntity } from "../../../../components/design-workspace/selection/store.js";
import { usePresentationFormat } from "../../../../shell/usePresentationFormat.js";
import {
  allMounts,
  conflictsFor,
  mirrorOf,
  oppositeSide,
  type ArmamentEntry,
  type ArmamentMount,
} from "../../armament.js";

export interface ArmamentEditingState {
  readonly entries: readonly ArmamentEntry[];
  readonly month: string;
  readonly mounts: readonly ArmamentMount[];
  readonly activeId: string | null;
  readonly selected: ArmamentMount | null;
  readonly mirror: ArmamentMount | null;
  readonly entry: PartCatalogueEntry | undefined;
  readonly replaceCandidates: readonly PartCatalogueEntry[];
  readonly conflicts: readonly BoardFinding[];
  readonly linked: boolean;
  readonly replaceTo: string;
}

export interface ArmamentEditingActions {
  readonly select: (mount: ArmamentMount) => void;
  readonly setLinked: (linked: boolean) => void;
  readonly setReplaceTo: (componentId: string) => void;
  readonly setNumber: (mount: ArmamentMount, param: "barrels" | "rounds", value: number) => void;
  readonly setStation: (mount: ArmamentMount, value: number) => void;
  readonly setSide: (mount: ArmamentMount, side: MountSide) => void;
  readonly moveZone: (mount: ArmamentMount, zoneId: ZoneId) => void;
  readonly duplicate: (mount: ArmamentMount) => void;
  readonly duplicateSymmetrically: (mount: ArmamentMount) => void;
  readonly mirrorSide: (mount: ArmamentMount) => void;
  readonly remove: (mount: ArmamentMount) => void;
  readonly replace: (mount: ArmamentMount, componentId: string) => void;
}

export interface ArmamentEditingMeta {
  readonly format: ReturnType<typeof usePresentationFormat>;
}

const StateContext = createContext<ArmamentEditingState | null>(null);
const ActionsContext = createContext<ArmamentEditingActions | null>(null);
const MetaContext = createContext<ArmamentEditingMeta | null>(null);

export interface ArmamentEditingProviderProps {
  readonly entries: readonly ArmamentEntry[];
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly findings: readonly BoardFinding[];
  readonly month: string;
  readonly edit: (edit: DraftEdit) => void;
  readonly onSelect?: (entity: ShipEntity) => void;
  readonly selectedInstanceId?: string | null;
  readonly children: ReactNode;
}

export function ArmamentEditingProvider({
  entries,
  draft,
  content,
  findings,
  month,
  edit,
  onSelect,
  selectedInstanceId,
  children,
}: ArmamentEditingProviderProps) {
  const format = usePresentationFormat();
  const mounts = allMounts(entries);
  const [picked, setPicked] = useState<string | null>(null);
  const activeId =
    selectedInstanceId !== undefined &&
    selectedInstanceId !== null &&
    mounts.some((mount) => mount.instanceId === selectedInstanceId)
      ? selectedInstanceId
      : picked;
  const selected = mounts.find((mount) => mount.instanceId === activeId) ?? null;
  const [linked, setLinked] = useState(false);
  const [replaceTo, setReplaceTo] = useState("");

  const takenIds = useMemo(
    () => new Set(draft.placements.map((p) => p.instanceId)),
    [draft.placements],
  );
  const entryOf = (componentId: string) => content.catalogue.find((e) => e.id === componentId);
  const nextId = (componentId: string) => {
    let n = 1;
    while (takenIds.has(`${componentId}_${n}`)) n++;
    return `${componentId}_${n}`;
  };
  const mirror = selected === null ? null : mirrorOf(selected, entries);
  const linkedTargets = (mount: ArmamentMount): ArmamentMount[] =>
    linked && mount === selected && mirror !== null ? [mount, mirror] : [mount];

  const apply = (edits: readonly DraftEdit[]) => {
    if (edits.length === 0) return;
    edit(
      edits.length === 1
        ? edits[0]!
        : { kind: "batch", edits: edits as Exclude<DraftEdit, { kind: "batch" }>[] },
    );
  };
  const setNumber = (mount: ArmamentMount, param: "barrels" | "rounds", value: number) => {
    const edits = linkedTargets(mount).flatMap((target): DraftEdit[] => {
      const range = entryOf(target.componentId)?.parameters?.[param];
      if (range === undefined) return [];
      const clamped = Math.min(range.max, Math.max(range.min, Math.round(value)));
      const current = param === "barrels" ? target.barrels : target.rounds;
      return current === clamped
        ? []
        : [{ kind: "set_param", instanceId: target.instanceId, param, value: clamped }];
    });
    apply(edits);
  };
  const setStation = (mount: ArmamentMount, value: number) => {
    apply(
      linkedTargets(mount).map((target): DraftEdit => ({
        kind: "move_placement",
        instanceId: target.instanceId,
        zoneId: target.zoneId as ZoneId,
        stationPermille: Math.min(1000, Math.max(0, Math.round(value))),
      })),
    );
  };
  const setSide = (mount: ArmamentMount, side: MountSide) =>
    edit({ kind: "set_side", instanceId: mount.instanceId, side });
  const moveZone = (mount: ArmamentMount, zoneId: ZoneId) =>
    edit({
      kind: "move_placement",
      instanceId: mount.instanceId,
      zoneId,
      stationPermille: mount.stationPermille,
    });
  const addCopy = (mount: ArmamentMount, side: MountSide) =>
    edit({
      kind: "add_placement",
      placement: {
        instanceId: nextId(mount.componentId),
        componentId: mount.componentId,
        zoneId: mount.zoneId as ZoneId,
        stationPermille: mount.stationPermille,
        side,
      },
    });
  const duplicate = (mount: ArmamentMount) => addCopy(mount, mount.side);
  const duplicateSymmetrically = (mount: ArmamentMount) => addCopy(mount, oppositeSide(mount.side));
  const mirrorSide = (mount: ArmamentMount) =>
    edit({ kind: "set_side", instanceId: mount.instanceId, side: oppositeSide(mount.side) });
  const remove = (mount: ArmamentMount) =>
    edit({ kind: "remove_placement", instanceId: mount.instanceId });
  const replace = (mount: ArmamentMount, componentId: string) =>
    edit({
      kind: "batch",
      edits: [
        { kind: "remove_placement", instanceId: mount.instanceId },
        {
          kind: "add_placement",
          placement: {
            instanceId: mount.instanceId,
            componentId,
            zoneId: mount.zoneId as ZoneId,
            stationPermille: mount.stationPermille,
            side: mount.side,
          },
        },
      ],
    });
  const select = (mount: ArmamentMount) => {
    setPicked(mount.instanceId);
    setReplaceTo("");
    onSelect?.({ kind: "fitting", instanceId: mount.instanceId });
  };

  const entryComponentId = selected?.componentId;
  const entry = useMemo(
    () =>
      entryComponentId === undefined
        ? undefined
        : content.catalogue.find((e) => e.id === entryComponentId),
    [entryComponentId, content.catalogue],
  );
  const replaceCandidates = useMemo(
    () =>
      entry === undefined
        ? []
        : content.catalogue.filter((e) => e.category === entry.category && e.id !== entry.id),
    [entry, content.catalogue],
  );
  const conflicts = selected === null ? [] : conflictsFor(selected.instanceId, findings);

  const state = useMemo<ArmamentEditingState>(
    () => ({
      entries,
      month,
      mounts,
      activeId,
      selected,
      mirror,
      entry,
      replaceCandidates,
      conflicts,
      linked,
      replaceTo,
    }),
    [
      entries,
      month,
      mounts,
      activeId,
      selected,
      mirror,
      entry,
      replaceCandidates,
      conflicts,
      linked,
      replaceTo,
    ],
  );
  const actions: ArmamentEditingActions = {
    select,
    setLinked,
    setReplaceTo,
    setNumber,
    setStation,
    setSide,
    moveZone,
    duplicate,
    duplicateSymmetrically,
    mirrorSide,
    remove,
    replace,
  };
  const meta: ArmamentEditingMeta = { format };
  return (
    <ActionsContext.Provider value={actions}>
      <MetaContext.Provider value={meta}>
        <StateContext.Provider value={state}>{children}</StateContext.Provider>
      </MetaContext.Provider>
    </ActionsContext.Provider>
  );
}

function missing(hook: string): never {
  throw new BluewaveError("ARMAMENT_EDITOR_PROVIDER_MISSING", { hook });
}

export function useArmamentEditing(): ArmamentEditingState {
  return use(StateContext) ?? missing("useArmamentEditing");
}

export function useArmamentActions(): ArmamentEditingActions {
  return use(ActionsContext) ?? missing("useArmamentActions");
}

export function useArmamentMeta(): ArmamentEditingMeta {
  return use(MetaContext) ?? missing("useArmamentMeta");
}
