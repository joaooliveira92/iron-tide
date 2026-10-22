import { useId, type ReactNode } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "../../ui/button.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { sectionFacts, SECTIONS } from "../panels/hull-plan/sections.js";
import { findingsFor } from "../validation/boardFindings.js";
import { FindingList } from "../validation/FindingList.js";
import { fittingFacts, machineryRooms, sectionOfZone, type EntityContext } from "./facts.js";
import { destinationFor, type Destination } from "./navigation.js";
import type { ShipEntity } from "./store.js";
import { useSelectionStore, useShipSelection } from "./useShipSelection.js";

const SIDE = { CENTRE: "centreline", PORT: "port", STBD: "starboard" } as const;
const UNAVAILABLE = "Not available for this design";

function Facts({ rows }: { readonly rows: readonly (readonly [string, ReactNode | undefined])[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs tabular-nums">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value ?? <span className="text-muted-foreground">{UNAVAILABLE}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

function SelectLink({
  entity,
  children,
}: {
  readonly entity: ShipEntity;
  readonly children: ReactNode;
}) {
  const store = useSelectionStore();
  return (
    <button
      type="button"
      className="rounded-sm text-left underline decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      onClick={() => store.select(entity)}
    >
      {children}
    </button>
  );
}

interface Body {
  readonly kind: string;
  readonly title: string;
  readonly content: ReactNode;
}

function bodyFor(entity: ShipEntity, ctx: EntityContext, format: PresentationFormat): Body | null {
  const num = (v: number, digits = 0) =>
    format.number(v, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const pct = (bp: number) => format.percent(bp, 0);
  const tonnes = (kg: number | undefined) =>
    kg === undefined ? undefined : format.measurement(kg, "mass", { maximumFractionDigits: 1 });
  switch (entity.kind) {
    case "ship":
      return {
        kind: "Ship",
        title: "Whole ship",
        content: (
          <p className="text-xs text-muted-foreground">
            Findings about the design as a whole, which no one part of the drawing carries.
          </p>
        ),
      };
    case "section": {
      const f = sectionFacts(entity.id, ctx);
      const z = f.zone;
      return {
        kind: "Section",
        title: f.meta.name,
        content: (
          <div className="space-y-2">
            <Facts
              rows={[
                [
                  "Range",
                  z &&
                    `${z.startPermille}–${z.endPermille}‰ · ${num(f.fromBowM, 1)}–${num(f.fromBowM + f.lengthM, 1)} m from the bow`,
                ],
                ["Weight fitted", tonnes(f.load?.weightKg)],
                [
                  "Internal volume",
                  f.load &&
                    `${num(f.load.volumeUsedLitre / 1000)} of ${num(f.load.volumeCapacityLitre / 1000)} m³ used`,
                ],
                [
                  "Deck area",
                  f.load &&
                    `${num(f.load.deckUsedMm2 / 1e6)} of ${num(f.load.deckCapacityMm2 / 1e6)} m² used`,
                ],
                [
                  "Machinery",
                  f.machineryRooms.length === 0
                    ? "None in this section"
                    : f.machineryRooms.map((r) => {
                        const index = machineryRooms(ctx.draft).findIndex(
                          (x) =>
                            x.stationPermille === r.stationPermille &&
                            x.zoneId === SECTIONS[entity.id].zoneId,
                        );
                        return (
                          <span key={r.stationPermille} className="mr-2">
                            <SelectLink entity={{ kind: "machinery-room", index }}>
                              Room at {r.stationPermille}‰
                            </SelectLink>{" "}
                            ({pct(r.shareBp)} of plant)
                          </span>
                        );
                      }),
                ],
                [
                  "Fuel",
                  f.fuelStationPermille === undefined
                    ? "Not stowed in this section"
                    : `Bunkers at ${f.fuelStationPermille}‰`,
                ],
              ]}
            />
            {f.fittings.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No fittings are placed in this section.
              </p>
            ) : (
              <ul
                className="flex flex-wrap gap-x-3 gap-y-1 text-xs"
                aria-label="Fittings in this section"
              >
                {f.fittings.map((x) => (
                  <li key={x.instanceId}>
                    <SelectLink entity={{ kind: "fitting", instanceId: x.instanceId }}>
                      {x.name}
                    </SelectLink>{" "}
                    <span className="text-muted-foreground">({x.instanceId})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ),
      };
    }
    case "fitting": {
      const f = fittingFacts(entity.instanceId, ctx);
      if (!f) return null;
      const armed = f.kind === "gun" || f.kind === "torpedo";
      return {
        kind: "Fitting",
        title: f.battery ? `${f.name} · mount ${f.battery.mount}` : f.name,
        content: (
          <Facts
            rows={[
              ["Type", f.category],
              [
                "Battery",
                f.battery ? f.battery.title : armed ? undefined : "Not part of a battery",
              ],
              [
                "Position",
                `${f.section ? SECTIONS[f.section].name : "Outside the drawn sections"} · ${f.stationPermille}‰ · ${SIDE[f.side]}`,
              ],
              ["Weight", tonnes(f.weightKg)],
              ...(armed
                ? ([
                    [
                      "Magazine",
                      f.magazine ? `${f.magazine.name} (${f.magazine.instanceId})` : undefined,
                    ],
                    ["Beam arc", f.arcDeg === undefined ? undefined : `${num(f.arcDeg)}°`],
                  ] as const)
                : []),
              ...(f.kind === "magazine"
                ? ([
                    [
                      "Protection margin",
                      f.protectionBp === undefined ? undefined : pct(f.protectionBp),
                    ],
                  ] as const)
                : []),
            ]}
          />
        ),
      };
    }
    case "machinery-room": {
      const room = machineryRooms(ctx.draft)[entity.index];
      if (!room) return null;
      const section = sectionOfZone(room.zoneId);
      return {
        kind: "Machinery room",
        title: `Machinery room ${entity.index + 1}`,
        content: (
          <Facts
            rows={[
              ["Plant", ctx.draft.machinery.plantId.replaceAll("_", " ")],
              ["Section", section ? SECTIONS[section].name : undefined],
              ["Station", `${room.stationPermille}‰`],
              ["Share of plant", pct(room.shareBp)],
            ]}
          />
        ),
      };
    }
  }
}

export function SelectionInspector({
  ctx,
  onGoTo,
  onClear,
}: {
  readonly ctx: EntityContext;
  readonly onGoTo: (d: Destination) => void;
  readonly onClear: () => void;
}) {
  const selected = useShipSelection((s) => s.selected);
  const focused = useShipSelection((s) => s.finding);
  const headingId = useId();
  const format = usePresentationFormat();
  if (selected === null) return null;
  const body = bodyFor(selected, ctx, format);
  if (!body) return null;
  const destination = destinationFor(selected, ctx);
  return (
    <section
      aria-labelledby={headingId}
      data-testid="selection-inspector"
      data-selection-scope=""
      className="mt-3 space-y-2 rounded-lg border border-primary/40 bg-card p-3 text-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Selected {body.kind.toLowerCase()}</p>
          <h2 id={headingId} className="font-medium">
            {body.title}
          </h2>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onClear}>
          <X aria-hidden="true" />
        </Button>
      </div>
      {body.content}
      <FindingList
        entityKey={JSON.stringify(selected)}
        findings={findingsFor(selected, ctx.findings)}
        focused={focused}
        onGoTo={onGoTo}
      />
      {destination && (
        <Button variant="outline" size="sm" onClick={() => onGoTo(destination)}>
          {destination.label}
          <ArrowRight aria-hidden="true" className="ml-1 size-4" />
        </Button>
      )}
    </section>
  );
}
