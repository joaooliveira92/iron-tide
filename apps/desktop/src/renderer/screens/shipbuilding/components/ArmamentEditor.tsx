import { useState, type ReactNode } from "react";
import {
  ZONE_IDS,
  type DesignDraft,
  type DraftEdit,
  type MountSide,
  type ZoneId,
} from "@bluewave/ship-design";
import {
  formatCalibreInches,
  formatPoundsFromMicro,
  formatTonnes,
} from "../../../lib/presentation-format/index.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Checkbox } from "../../../components/ui/checkbox.js";
import type { DrawingBoardContent } from "../../../components/design-workspace/content.js";
import { NumberField, SelectField } from "../../../components/design-workspace/fields.js";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import { batterySymmetry } from "../../../components/design-workspace/batteryView.js";
import { plural } from "../../../components/design-workspace/plural.js";
import {
  placementAttrs,
  shipLinkAttrs,
} from "../../../components/design-workspace/selection/navigation.js";
import type { ShipEntity } from "../../../components/design-workspace/selection/store.js";
import type { BoardFinding } from "../../../components/design-workspace/validation/boardFindings.js";
import { SEVERITY_STYLE } from "../../../components/design-workspace/validation/severity.js";
import {
  allMounts,
  conflictsFor,
  mirrorOf,
  oppositeSide,
  type ArmamentEntry,
  type ArmamentMount,
} from "../armament.js";

const zoneLabel = (z: string) => z.replaceAll("_", " ").toLowerCase();

const isMountSide = (v: string): v is MountSide => v === "CENTRE" || v === "PORT" || v === "STBD";

const SIDE_OPTIONS = [
  { value: "CENTRE", label: "Centreline" },
  { value: "PORT", label: "Port" },
  { value: "STBD", label: "Starboard" },
] as const;

/**
 * The Armament master-detail editor: a mount list grouped by battery, and the selected mount's editor with its
 * editable properties, placement actions and conflicts. Pure presentation: every value comes from the compiled
 * design, every control produces a draft edit.
 */
export function ArmamentEditor({
  entries,
  draft,
  content,
  findings,
  month,
  edit,
  onSelect,
  selectedInstanceId,
}: {
  readonly entries: readonly ArmamentEntry[];
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly findings: readonly BoardFinding[];
  readonly month: string;
  readonly edit: (e: DraftEdit) => void;
  /** When given, selecting a mount pins it in the drawing's selection. */
  readonly onSelect?: (entity: ShipEntity) => void;
  /** The mount the drawing has pinned, so its row shows its pressed state and its editor opens. */
  readonly selectedInstanceId?: string | null;
}) {
  const mounts = allMounts(entries);
  const [picked, setPicked] = useState<string | null>(null);
  const activeId =
    selectedInstanceId !== undefined &&
    selectedInstanceId !== null &&
    mounts.some((m) => m.instanceId === selectedInstanceId)
      ? selectedInstanceId
      : picked;
  const selected = mounts.find((m) => m.instanceId === activeId) ?? null;
  const [linked, setLinked] = useState(false);
  const [replaceTo, setReplaceTo] = useState("");

  const entryOf = (componentId: string) => content.catalogue.find((e) => e.id === componentId);
  const nextId = (componentId: string) => {
    let n = 1;
    while (draft.placements.some((p) => p.instanceId === `${componentId}_${n}`)) n++;
    return `${componentId}_${n}`;
  };
  const mirror = selected === null ? null : mirrorOf(selected, entries);
  const linkedTargets = (m: ArmamentMount): ArmamentMount[] =>
    linked && m === selected && mirror !== null ? [m, mirror] : [m];

  const setNumber = (m: ArmamentMount, param: "barrels" | "rounds", value: number) => {
    const edits = linkedTargets(m).flatMap((t): DraftEdit[] => {
      const range = entryOf(t.componentId)?.parameters?.[param];
      if (range === undefined) return [];
      const clamped = Math.min(range.max, Math.max(range.min, Math.round(value)));
      const current = param === "barrels" ? t.barrels : t.rounds;
      return current === clamped
        ? []
        : [{ kind: "set_param", instanceId: t.instanceId, param, value: clamped }];
    });
    apply(edits);
  };
  const setStation = (m: ArmamentMount, value: number) => {
    const edits = linkedTargets(m).map((t): DraftEdit => ({
      kind: "move_placement",
      instanceId: t.instanceId,
      zoneId: t.zoneId as ZoneId,
      stationPermille: Math.min(1000, Math.max(0, Math.round(value))),
    }));
    apply(edits);
  };
  const setSide = (m: ArmamentMount, side: MountSide) =>
    edit({ kind: "set_side", instanceId: m.instanceId, side });
  const moveZone = (m: ArmamentMount, zoneId: ZoneId) =>
    edit({
      kind: "move_placement",
      instanceId: m.instanceId,
      zoneId,
      stationPermille: m.stationPermille,
    });
  const addCopy = (m: ArmamentMount, side: MountSide) =>
    edit({
      kind: "add_placement",
      placement: {
        instanceId: nextId(m.componentId),
        componentId: m.componentId,
        zoneId: m.zoneId as ZoneId,
        stationPermille: m.stationPermille,
        side,
      },
    });
  const duplicate = (m: ArmamentMount) => addCopy(m, m.side);
  const duplicateSymmetrically = (m: ArmamentMount) => addCopy(m, oppositeSide(m.side));
  const mirrorSide = (m: ArmamentMount) =>
    edit({ kind: "set_side", instanceId: m.instanceId, side: oppositeSide(m.side) });
  const remove = (m: ArmamentMount) => edit({ kind: "remove_placement", instanceId: m.instanceId });
  const replace = (m: ArmamentMount, componentId: string) =>
    edit({
      kind: "batch",
      edits: [
        { kind: "remove_placement", instanceId: m.instanceId },
        {
          kind: "add_placement",
          placement: {
            instanceId: m.instanceId,
            componentId,
            zoneId: m.zoneId as ZoneId,
            stationPermille: m.stationPermille,
            side: m.side,
          },
        },
      ],
    });

  function apply(edits: readonly DraftEdit[]) {
    if (edits.length === 0) return;
    edit(
      edits.length === 1
        ? edits[0]!
        : { kind: "batch", edits: edits as Exclude<DraftEdit, { kind: "batch" }>[] },
    );
  }

  const entry = selected === null ? undefined : entryOf(selected.componentId);
  const conflicts = selected === null ? [] : conflictsFor(selected.instanceId, findings);
  const replaceCandidates =
    entry === undefined
      ? []
      : content.catalogue.filter((e) => e.category === entry.category && e.id !== entry.id);

  return (
    <Panel title="Batteries">
      {mounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No guns or torpedo tubes are fitted here. Add them under Components and arrangement.
        </p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.row.key} className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">
                  {entry.title}
                  {batterySymmetry(entry) === "asymmetric" && (
                    <Badge variant="secondary" className="ml-2" title="Port and starboard differ">
                      Asymmetric
                    </Badge>
                  )}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {plural(entry.mounts.length, "mount")} · {formatTonnes(entry.row.weightKg)} t
                </span>
              </div>
              <ul className="flex flex-wrap gap-1.5" aria-label={`${entry.title} mounts`}>
                {entry.mounts.map((m) => (
                  <li key={m.instanceId}>
                    <Button
                      type="button"
                      size="sm"
                      variant={activeId === m.instanceId ? "default" : "outline"}
                      aria-pressed={activeId === m.instanceId}
                      aria-label={`Select mount ${m.layout}`}
                      className="tabular-nums"
                      onClick={() => {
                        setPicked(m.instanceId);
                        setReplaceTo("");
                        onSelect?.({ kind: "fitting", instanceId: m.instanceId });
                      }}
                      {...shipLinkAttrs([{ kind: "fitting", instanceId: m.instanceId }])}
                    >
                      {m.layout}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {selected !== null && (
        <div className="space-y-3 rounded-md border p-3" {...placementAttrs(selected.instanceId)}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{selected.layout}</span>
            <Badge variant="outline">{selected.displayName}</Badge>
          </div>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <Readout label="Mount type">{selected.mountType ?? "n/a"}</Readout>
            <Readout label="Fire control">{selected.fcClass ?? "none"}</Readout>
            <Readout label="Firing arc">
              {selected.arcDeg === null ? "n/a" : `${selected.arcDeg}°`}
            </Readout>
            <Readout label="Calibre">
              {selected.caliberUm === 0 ? "n/a" : formatCalibreInches(selected.caliberUm)}
            </Readout>
            <Readout label="Weight">{`${formatTonnes(selected.weightKg)} t`}</Readout>
            <Readout label="Cost">{formatPoundsFromMicro(selected.costMicro)}</Readout>
          </dl>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label={`Barrel count of ${selected.instanceId}`}
              shortLabel="Barrel count"
              value={selected.barrels}
              min={entry?.parameters?.barrels?.min}
              max={entry?.parameters?.barrels?.max}
              step={entry?.parameters?.barrels?.step}
              onCommit={(v) => setNumber(selected, "barrels", v)}
            />
            {selected.rounds !== null && (
              <NumberField
                label={`Ammunition per gun of ${selected.instanceId}`}
                shortLabel="Ammunition per gun"
                unit="rounds"
                value={selected.rounds}
                min={entry?.parameters?.rounds?.min}
                max={entry?.parameters?.rounds?.max}
                step={entry?.parameters?.rounds?.step}
                onCommit={(v) => setNumber(selected, "rounds", v)}
              />
            )}
            <SelectField
              label={`Mount position of ${selected.instanceId}`}
              shortLabel="Zone"
              value={selected.zoneId}
              options={ZONE_IDS.map((z) => ({ value: z, label: zoneLabel(z) }))}
              onChange={(v) => moveZone(selected, v as ZoneId)}
            />
            <NumberField
              label={`Station of ${selected.instanceId}`}
              shortLabel="Station"
              unit="‰"
              value={selected.stationPermille}
              min={0}
              max={1000}
              onCommit={(v) => setStation(selected, v)}
            />
            <SelectField
              label={`Side of ${selected.instanceId}`}
              shortLabel="Side"
              value={selected.side}
              options={[...SIDE_OPTIONS]}
              onChange={(v) => {
                if (isMountSide(v)) setSide(selected, v);
              }}
            />
          </div>

          {(selected.side === "PORT" || selected.side === "STBD") && mirror !== null && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                aria-label="Link port and starboard mounts"
                checked={linked}
                onCheckedChange={(v) => setLinked(v === true)}
              />
              Link port and starboard mounts: barrel count, ammunition and station edits apply to{" "}
              {mirror.name} too
            </label>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => duplicate(selected)}>
              Duplicate
            </Button>
            <Button variant="outline" size="sm" onClick={() => duplicateSymmetrically(selected)}>
              Duplicate to opposite side
            </Button>
            {selected.side !== "CENTRE" && (
              <Button variant="outline" size="sm" onClick={() => mirrorSide(selected)}>
                Mirror to {oppositeSide(selected.side) === "PORT" ? "port" : "starboard"}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => remove(selected)}>
              Remove
            </Button>
          </div>

          {replaceCandidates.length > 0 && (
            <div className="flex items-end gap-2">
              <SelectField
                className="flex-1"
                label={`Replace ${selected.instanceId} with`}
                shortLabel="Replace with"
                value={replaceTo}
                options={replaceCandidates.map((c) => ({
                  value: c.id,
                  label: c.displayName,
                  disabled: c.introduction.fromMonth > month,
                }))}
                onChange={setReplaceTo}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={replaceTo === ""}
                onClick={() => {
                  replace(selected, replaceTo);
                  setReplaceTo("");
                }}
              >
                Replace
              </Button>
            </div>
          )}

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              Placement conflicts ({conflicts.length})
            </div>
            {conflicts.length === 0 ? (
              <p className="text-sm text-muted-foreground">None for this mount.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {conflicts.map((f) => (
                  <li key={f.key} className="flex items-start gap-2">
                    <Badge variant={SEVERITY_STYLE[f.severity].badge}>{f.severity}</Badge>
                    <span>{f.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Readout({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </>
  );
}
