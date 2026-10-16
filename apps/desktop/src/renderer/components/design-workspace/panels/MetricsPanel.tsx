import type { Metric, WorkshopView } from "@bluewave/ship-design";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../ui/hover-card.js";
import { cn } from "../../../lib/utils.js";
import { formatExplanation } from "../../../lib/presentation-format/index.js";
import { Panel } from "./Panel.js";

const tone: Record<string, string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-red-600",
  neutral: "",
};

const verdict: Record<Metric["tone"], string | null> = {
  ok: "Within limits.",
  warn: "Short of the requirement or close to a limit.",
  bad: "Flagged by a validation finding: see Validation above.",
  neutral: null,
};

/** What each measure means for the ship, shown when the row is hovered. */
const explain: Record<string, string> = {
  displacement:
    "Total weight of the ship as designed. It must stay within what the hull floats at its design draught.",
  speed:
    "Flat-out speed from the installed power against the hull's resistance, compared with the requirement.",
  range: "Distance steamed at cruising speed on the fuel carried, compared with the requirement.",
  stability:
    "How strongly the ship rights itself when heeled (GM). Too low and she may capsize; too high and she rolls violently and makes a poor gun platform.",
  trim: "How far the ship sits bow- or stern-down, as a share of her length. Heavy weights far forward or aft drive it.",
  stress:
    "Bending load on the hull girder against its strength. Above 100 % the hull is not strong enough.",
  crew: "Men needed to work the ship against the berths provided.",
  reserve:
    "Watertight volume above the waterline, as a share of displacement: what keeps her afloat when holed.",
};

function MetricRow({ m }: { readonly m: Metric }) {
  const note = explain[m.id];
  const row = (
    <>
      <dt className="text-muted-foreground">{m.label}</dt>
      <dd className={cn("text-right tabular-nums", tone[m.tone])}>{formatExplanation(m.value)}</dd>
    </>
  );
  if (note === undefined) return <div className="flex justify-between gap-4">{row}</div>;
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={150}
        closeDelay={100}
        render={<div />}
        className="-mx-1 flex cursor-help justify-between gap-4 rounded px-1 hover:bg-muted/60"
      >
        {row}
      </HoverCardTrigger>
      <HoverCardContent side="left" className="w-72 space-y-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium">{m.label}</span>
          <span className={cn("tabular-nums", tone[m.tone])}>{formatExplanation(m.value)}</span>
        </div>
        <p className="text-muted-foreground">{note}</p>
        {verdict[m.tone] !== null && (
          <p className={cn("text-xs", tone[m.tone])}>{verdict[m.tone]}</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export function MetricsPanel({ view }: { readonly view: WorkshopView }) {
  return (
    <Panel title="Performance">
      <dl className="grid grid-cols-1 gap-1 text-sm">
        {view.metrics.map((m) => (
          <MetricRow key={m.id} m={m} />
        ))}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Classification</dt>
          <dd>{view.naturalClass ?? "not classified"}</dd>
        </div>
      </dl>
    </Panel>
  );
}
