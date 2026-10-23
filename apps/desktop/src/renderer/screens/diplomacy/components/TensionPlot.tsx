import { Anchor } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import {
  PLOT_CENTER,
  PLOT_HEIGHT,
  PLOT_MARGIN_X,
  PLOT_MARGIN_Y,
  PLOT_OUTER_RADIUS,
  PLOT_RINGS,
  PLOT_WIDTH,
  percentAt,
  plotLayout,
  pointAt,
  shortNationName,
  tensionRadius,
  type PlotNode,
} from "../diplomacy-plot.js";
import { TENSION_TONES } from "../diplomacy-presentation.js";
import type { DiplomacyRelationRow } from "../diplomacy-view-model.js";
import type { BattleRecord } from "../diplomacy-hover.js";
import { NationFlag } from "./NationFlag.js";
import { NationHoverCard } from "./NationHoverCard.js";
import type { PlotLayer } from "./plot-layers.js";

export interface TensionPlotProps {
  readonly rows: readonly DiplomacyRelationRow[];
  readonly playerFlagUrl: string | null;
  readonly records: ReadonlyMap<string, BattleRecord>;
  readonly selectedId: string | null;
  readonly layers: ReadonlySet<PlotLayer>;
  readonly onSelect: (partnerNationId: string) => void;
}

const LABEL_GAP = 30;
const BEARING_STEP = 30;
const TICK_STEP = 10;
const MAX_HEIGHT_REM = 28;

function linkClass(row: DiplomacyRelationRow): string {
  if (row.atWar) return "stroke-destructive";
  if (row.allied) return "stroke-success";
  if (row.nap) return "stroke-muted-foreground";
  return "stroke-border";
}

function linkWidth(row: DiplomacyRelationRow): number {
  return row.atWar ? 3 : row.allied ? 2.5 : row.nap ? 1.5 : 1;
}

function linkDash(row: DiplomacyRelationRow): string | undefined {
  if (row.atWar || row.allied) return undefined;
  return row.nap ? "6 5" : "2 5";
}

const ticks = Array.from({ length: 360 / TICK_STEP }, (_, index) => index * TICK_STEP);

function Backdrop({
  nodes,
  rowById,
  layers,
}: {
  readonly nodes: readonly PlotNode[];
  readonly rowById: ReadonlyMap<string, DiplomacyRelationRow>;
  readonly layers: ReadonlySet<PlotLayer>;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`${-PLOT_MARGIN_X} ${-PLOT_MARGIN_Y} ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
      className="absolute inset-0 size-full"
    >
      {layers.has("rings") && (
        <g>
          <circle
            cx={PLOT_CENTER}
            cy={PLOT_CENTER}
            r={tensionRadius(8)}
            className="fill-destructive/[0.06]"
          />
          <circle
            cx={PLOT_CENTER}
            cy={PLOT_CENTER}
            r={tensionRadius(6)}
            className="fill-warning/[0.07]"
          />
          <circle
            cx={PLOT_CENTER}
            cy={PLOT_CENTER}
            r={PLOT_OUTER_RADIUS}
            className="fill-none stroke-border"
            strokeWidth={1.5}
          />
          {PLOT_RINGS.map((ring) => (
            <circle
              key={ring.id}
              cx={PLOT_CENTER}
              cy={PLOT_CENTER}
              r={tensionRadius(ring.tension)}
              className="fill-none stroke-muted-foreground/45"
              strokeWidth={1}
              strokeDasharray="3 5"
            />
          ))}
          <line
            x1={PLOT_CENTER}
            y1={PLOT_CENTER - PLOT_OUTER_RADIUS}
            x2={PLOT_CENTER}
            y2={PLOT_CENTER + PLOT_OUTER_RADIUS}
            className="stroke-border"
          />
          <line
            x1={PLOT_CENTER - PLOT_OUTER_RADIUS}
            y1={PLOT_CENTER}
            x2={PLOT_CENTER + PLOT_OUTER_RADIUS}
            y2={PLOT_CENTER}
            className="stroke-border"
          />
          {ticks.map((degrees) => {
            const major = degrees % BEARING_STEP === 0;
            const from = pointAt(degrees - 90, PLOT_OUTER_RADIUS + 6);
            const to = pointAt(degrees - 90, PLOT_OUTER_RADIUS + (major ? 20 : 13));
            return (
              <line
                key={degrees}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="stroke-muted-foreground/50"
              />
            );
          })}
        </g>
      )}
      {layers.has("links") &&
        nodes.map((node) => {
          const row = rowById.get(node.id)!;
          return (
            <line
              key={node.id}
              x1={PLOT_CENTER}
              y1={PLOT_CENTER}
              x2={node.x}
              y2={node.y}
              className={linkClass(row)}
              strokeWidth={linkWidth(row)}
              strokeDasharray={linkDash(row)}
              strokeLinecap="round"
            />
          );
        })}
    </svg>
  );
}

function Annotations() {
  return (
    <>
      {ticks
        .filter((degrees) => degrees % BEARING_STEP === 0)
        .map((degrees) => {
          const at = pointAt(degrees - 90, PLOT_OUTER_RADIUS + 34);
          return (
            <span
              key={degrees}
              aria-hidden="true"
              style={percentAt(at.x, at.y)}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground"
            >
              {String(degrees).padStart(3, "0")}
            </span>
          );
        })}
    </>
  );
}

function RingLegend() {
  return (
    <ul
      aria-label="Tension rings"
      className="pointer-events-none absolute left-0 top-0 space-y-0.5 rounded-md bg-background/80 p-1.5 text-xs text-muted-foreground"
    >
      {[...PLOT_RINGS].reverse().map((ring) => (
        <li key={ring.id} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full border border-muted-foreground/60" />
          {ring.label}
        </li>
      ))}
    </ul>
  );
}

function Contact({
  node,
  row,
  record,
  selected,
  showName,
  onSelect,
}: {
  readonly node: PlotNode;
  readonly row: DiplomacyRelationRow;
  readonly record: BattleRecord | undefined;
  readonly selected: boolean;
  readonly showName: boolean;
  readonly onSelect: (partnerNationId: string) => void;
}) {
  const outward = pointAt(node.angle, LABEL_GAP);
  const dx = outward.x - PLOT_CENTER;
  const dy = outward.y - PLOT_CENTER;
  const labelAt = percentAt(node.x + dx, node.y + dy);
  const shift =
    Math.abs(dx) < 6 ? "-translate-x-1/2" : dx > 0 ? "translate-x-0" : "-translate-x-full";
  return (
    <>
      <NationHoverCard row={row} record={record} side={dx > 0 ? "right" : "left"}>
        <button
          type="button"
          data-nation-id={node.id}
          aria-pressed={selected}
          aria-label={`${node.name}, ${row.relationLabel}, tension ${row.tension} of 10`}
          style={percentAt(node.x, node.y)}
          onClick={() => onSelect(node.id)}
          className={cn(
            "absolute size-11 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-[3px] bg-card outline-none",
            "shadow-md transition-transform duration-150 hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
            TENSION_TONES[row.band].border,
            selected && "z-10 scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background",
            row.atWar && "motion-safe:animate-pulse",
          )}
        >
          <NationFlag url={row.flagUrl} name={node.name} className="size-full text-xs" />
        </button>
      </NationHoverCard>
      {showName && (
        <span
          aria-hidden="true"
          style={labelAt}
          className={cn(
            "pointer-events-none absolute -translate-y-1/2 whitespace-nowrap rounded bg-background/80 px-1 text-xs",
            shift,
            selected ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {shortNationName(node.name)}
        </span>
      )}
    </>
  );
}

export function TensionPlot({
  rows,
  playerFlagUrl,
  records,
  selectedId,
  layers,
  onSelect,
}: TensionPlotProps) {
  const nodes = plotLayout(rows);
  const rowById = new Map(rows.map((row) => [row.partnerNationId, row]));
  const centre = percentAt(PLOT_CENTER, PLOT_CENTER);
  return (
    <div
      role="group"
      aria-label="Diplomatic plot"
      data-testid="tension-plot"
      style={{
        aspectRatio: `${PLOT_WIDTH} / ${PLOT_HEIGHT}`,
        maxWidth: `${(MAX_HEIGHT_REM * PLOT_WIDTH) / PLOT_HEIGHT}rem`,
      }}
      className="relative mx-auto w-full"
    >
      <Backdrop nodes={nodes} rowById={rowById} layers={layers} />
      {layers.has("rings") && <Annotations />}
      {layers.has("rings") && <RingLegend />}

      {layers.has("blockades") &&
        nodes
          .filter((node) => rowById.get(node.id)!.blockades.length > 0)
          .map((node) => {
            const at = pointAt(node.angle, node.radius * 0.5);
            return (
              <span
                key={`blockade-${node.id}`}
                aria-hidden="true"
                style={percentAt(at.x, at.y)}
                className="pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-destructive bg-background"
              >
                <Anchor className="size-3.5 text-destructive" />
              </span>
            );
          })}

      <span
        aria-hidden="true"
        style={centre}
        className="pointer-events-none absolute flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-4 border-foreground bg-foreground shadow-lg"
      >
        {playerFlagUrl !== null ? (
          <NationFlag url={playerFlagUrl} name="You" className="size-full" />
        ) : (
          <span className="text-xs font-semibold text-background">You</span>
        )}
      </span>
      <span
        aria-hidden="true"
        style={percentAt(PLOT_CENTER, PLOT_CENTER + 46)}
        className="pointer-events-none absolute -translate-x-1/2 rounded bg-foreground px-1.5 text-xs font-semibold text-background"
      >
        You
      </span>

      {nodes.map((node) => (
        <Contact
          key={node.id}
          node={node}
          row={rowById.get(node.id)!}
          record={records.get(node.name)}
          selected={node.id === selectedId}
          showName={layers.has("names")}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
