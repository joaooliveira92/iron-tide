import type { DesignDraft } from "@bluewave/ship-design";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { ConfirmAction } from "../ConfirmAction.js";
import type { BatteryCard } from "../batteryView.js";
import { batterySymmetry, clearBatteryEdit, setRoundsEdit } from "../batteryView.js";
import type { DrawingBoardContent } from "../content.js";
import { NumberField, SelectField } from "../fields.js";
import type { ShipEntity } from "../selection/store.js";
import { Panel } from "./Panel.js";
import { gunQualityLine, NEUTRAL_GUN_QUALITY } from "./gun-quality.js";
import type { Edit } from "./types.js";
import { batteryAttrs, shipLinkAttrs } from "../selection/navigation.js";

const tonnes = (kg: number) => (kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 });
/** "gun"/"guns", "tube"/"tubes". */
const unitWord = (role: string, n: number) =>
  `${role === "TORPEDO" ? "tube" : "gun"}${n === 1 ? "" : "s"}`;
/** Light-gun calibres a tertiary battery can carry, micrometres (3-pdr, 6-pdr and 3-inch classes). */
const TERTIARY_CALIBRES_UM = [47_000, 57_000, 76_200] as const;
const sideText = { CENTRE: "centreline", PORT: "port", STBD: "starboard" } as const;

/** The guns and tubes grouped as batteries: named mounts, totals, rounds per gun, and clearing a whole battery. */
export function BatteryPanel({
  cards,
  draft,
  content,
  edit,
  onSelect,
  selectedInstanceId,
}: {
  readonly cards: readonly BatteryCard[];
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
  readonly edit: Edit;
  /** When given, each mount is a control that pins it in the drawing's selection. */
  readonly onSelect?: (entity: ShipEntity) => void;
  /** The mount the drawing has pinned, so the control shows its pressed state. */
  readonly selectedInstanceId?: string | null;
}) {
  const defOf = (id: string) => content.catalogue.find((e) => e.id === id);
  return (
    <Panel title="Batteries">
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No guns or torpedo tubes are fitted. Add them under Components and arrangement.
        </p>
      ) : (
        <ul className="space-y-3">
          {cards.map(({ row, title, mounts }) => (
            <li
              key={row.key}
              className="space-y-2 rounded-md border p-3"
              {...batteryAttrs(
                row.key,
                mounts.map((m) => m.instanceId),
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {title}
                  {batterySymmetry({ mounts }) === "asymmetric" && (
                    <Badge variant="secondary" className="ml-2" title="Port and starboard differ">
                      Asymmetric
                    </Badge>
                  )}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {row.mounts} mount{row.mounts === 1 ? "" : "s"} · {row.barrels}{" "}
                  {unitWord(row.role, row.barrels)} · {tonnes(row.weightKg)} t
                </span>
              </div>
              <ul className="flex flex-wrap gap-1.5" aria-label={`${title} mounts`}>
                {mounts.map((m) => (
                  <li key={m.instanceId}>
                    {onSelect ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedInstanceId === m.instanceId ? "default" : "outline"}
                        aria-pressed={selectedInstanceId === m.instanceId}
                        aria-label={`Select mount ${m.name}`}
                        className="tabular-nums"
                        onClick={() => onSelect({ kind: "fitting", instanceId: m.instanceId })}
                        {...shipLinkAttrs([{ kind: "fitting", instanceId: m.instanceId }])}
                      >
                        {m.name} · {sideText[m.side]} · {m.stationPermille}‰
                      </Button>
                    ) : (
                      <Badge variant="outline" className="tabular-nums">
                        {m.name} · {sideText[m.side]} · {m.stationPermille}‰
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
              {row.role !== "TORPEDO" && (
                <p className="text-xs text-muted-foreground">
                  {gunQualityLine(NEUTRAL_GUN_QUALITY)}
                </p>
              )}
              <div className="flex flex-wrap items-end gap-3">
                {row.role !== "TORPEDO" && (
                  <NumberField
                    className="w-40"
                    label={`Rounds per gun, ${title}`}
                    shortLabel="Rounds per gun"
                    value={row.roundsPerGun ?? 0}
                    onCommit={(v) => {
                      const e = setRoundsEdit(row, v, draft, defOf);
                      if (e) edit(e);
                    }}
                  />
                )}
                {row.role !== "TORPEDO" && row.roundsPerGun === null && (
                  <span className="pb-2 text-xs text-muted-foreground">
                    Mounts differ; setting a value applies it to all.
                  </span>
                )}
                <ConfirmAction
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  confirm={row.mounts > 0}
                  title={`Clear ${title.toLowerCase()}?`}
                  description={`Removes all ${row.mounts} mount${row.mounts === 1 ? "" : "s"} as one step. Undo restores them.`}
                  confirmLabel="Clear battery"
                  onConfirm={() => {
                    const e = clearBatteryEdit(row);
                    if (e) edit(e);
                  }}
                  aria-label={`Clear ${title}`}
                >
                  Clear
                </ConfirmAction>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-3 pt-2">
        <SelectField
          label="Tertiary gun"
          value={String(draft.tertiary?.caliberUm ?? TERTIARY_CALIBRES_UM[1])}
          options={TERTIARY_CALIBRES_UM.map((um) => ({
            value: String(um),
            label: `${um / 1000} mm`,
          }))}
          onChange={(v) =>
            edit({
              kind: "set_tertiary",
              tertiary: { caliberUm: Number(v), count: draft.tertiary?.count ?? 0 },
            })
          }
        />
        <NumberField
          className="w-40"
          label="Tertiary guns"
          min={0}
          value={draft.tertiary?.count ?? 0}
          onCommit={(v) =>
            edit({
              kind: "set_tertiary",
              tertiary:
                v === 0
                  ? null
                  : { caliberUm: draft.tertiary?.caliberUm ?? TERTIARY_CALIBRES_UM[1], count: v },
            })
          }
        />
        <span className="pb-2 text-xs text-muted-foreground">
          A count of light guns against torpedo craft: no placement or fire arc.
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-3 pt-2">
        <NumberField
          className="w-48"
          label="Fire-control positions"
          min={0}
          value={draft.fireControl?.positions ?? 0}
          onCommit={(v) => edit({ kind: "set_fire_control", positions: v })}
        />
        <span className="pb-2 text-xs text-muted-foreground">
          Spotting tops and plotting rooms; more positions keep fire control working after hits.
        </span>
      </div>
    </Panel>
  );
}
