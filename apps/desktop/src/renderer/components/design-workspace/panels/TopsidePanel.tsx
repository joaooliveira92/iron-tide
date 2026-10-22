import {
  TOPSIDE_WARN_BP,
  topsideLoad,
  type TopsideStatus,
  type WorkshopView,
} from "@bluewave/ship-design";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { Panel } from "./Panel.js";

const LABEL: Record<TopsideStatus, string> = {
  normal: "Within capacity",
  warning: `Crowded (over ${TOPSIDE_WARN_BP / 100}% of deck area)`,
  exceeded: "Over capacity: fittings would overlap on deck",
};
const BAR: Record<TopsideStatus, string> = {
  normal: "bg-primary",
  warning: "bg-amber-500",
  exceeded: "bg-red-600",
};

/** Deck-area load of the placed fittings. All numbers come from the domain `topsideLoad`; this only displays them. */
export function TopsidePanel({ view }: { readonly view: WorkshopView }) {
  const format = usePresentationFormat();
  const m2 = (mm2: number) => format.number(mm2 / 1_000_000, { maximumFractionDigits: 1 });
  const load = topsideLoad(view.compiled.arrangement);
  const pct = load.utilizationBp === null ? null : load.utilizationBp / 100;
  const full = load.zones.filter((z) => z.status === "exceeded");
  return (
    <Panel title="Topside load">
      <div
        role="meter"
        aria-label="Topside load"
        aria-valuemin={0}
        aria-valuemax={Math.round(load.capacityMm2 / 1000) / 1000}
        aria-valuenow={Math.round(load.usedMm2 / 1000) / 1000}
        aria-valuetext={`${m2(load.usedMm2)} of ${m2(load.capacityMm2)} square metres, ${LABEL[load.status]}`}
        className="h-3 w-full overflow-hidden rounded bg-muted"
      >
        <div
          className={`h-full ${BAR[load.status]}`}
          style={{ width: `${Math.min(100, pct ?? (load.usedMm2 > 0 ? 100 : 0))}%` }}
        />
      </div>
      <p className="text-sm tabular-nums">
        {m2(load.usedMm2)} of {m2(load.capacityMm2)} m² deck area
        {load.utilizationBp !== null && ` (${format.percent(load.utilizationBp, 1)})`} ·{" "}
        {m2(Math.abs(load.remainingMm2))} m² {load.remainingMm2 < 0 ? "over" : "spare"}
      </p>
      <p role="status" className="text-xs text-muted-foreground">
        {LABEL[load.status]}
        {full.length > 0 &&
          `: ${full.map((z) => z.zoneId.replaceAll("_", " ").toLowerCase()).join(", ")}`}
        . Warning threshold is provisional.
      </p>
    </Panel>
  );
}
