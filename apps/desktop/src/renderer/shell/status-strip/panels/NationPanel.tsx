import { cn } from "../../../lib/utils.js";
import type { StatusStripModel, StripRow } from "../../status-strip-state.js";
import { PrestigeCard } from "../cards/PrestigeCard.js";
import { ShipyardCard } from "../cards/ShipyardCard.js";
import { StationsCard } from "../cards/StationsCard.js";
import { StripCard } from "../StripCard.js";
import { StripGlyph } from "../StripGlyph.js";
import { StripPanel } from "../StripPanel.js";
import { rowById } from "../rows.js";
import { FIELD_LABEL } from "../strip-styles.js";
import { useStatusStripMeta, useStatusStripState } from "../StatusStripContext.js";

const MAX_PORT_BARS = 14;

function PrestigeTile({ model }: { readonly model: StatusStripModel }) {
  const row = rowById(model.nation, "prestige");
  if (row === undefined) return null;
  const { prestige } = model;
  return (
    <StripCard
      row={row}
      className="col-span-2"
      detail={
        <PrestigeCard gauge={prestige} note={row.note} explanation={model.prestigeExplanation} />
      }
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className={FIELD_LABEL}>{row.label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          sacked at {prestige.threshold}
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "font-display text-xl leading-6 font-semibold tabular-nums",
            prestige.atRisk && "text-destructive",
          )}
        >
          {row.value}
        </span>
        <StripGlyph
          variant="meter"
          fraction={prestige.fraction}
          mark={prestige.thresholdFraction}
          fill={prestige.atRisk ? "bg-destructive" : "bg-admiralty-accent"}
        />
      </span>
    </StripCard>
  );
}

function StationsTile({
  row,
  model,
}: {
  readonly row: StripRow;
  readonly model: StatusStripModel;
}) {
  const { stations } = model;
  const share =
    stations.foreignTonsFraction ?? (stations.total === 0 ? 0 : stations.foreign / stations.total);
  return (
    <StripCard row={row} width="w-80" detail={<StationsCard stations={stations} />}>
      <span className={FIELD_LABEL}>{row.label}</span>
      <span className="flex items-center gap-2">
        <span className="font-display text-base leading-5 font-semibold tabular-nums">
          {row.value}
        </span>
        <StripGlyph
          variant="meter"
          fraction={stations.unknown ? 0 : share}
          fill="bg-admiralty-signal"
        />
      </span>
    </StripCard>
  );
}

function ShipyardTile({
  row,
  model,
}: {
  readonly row: StripRow;
  readonly model: StatusStripModel;
}) {
  return (
    <StripCard
      row={row}
      width="w-80"
      detail={<ShipyardCard ports={model.ports} total={row.value} />}
    >
      <span className={FIELD_LABEL}>{row.label}</span>
      <span className="flex items-end gap-2">
        <span className="font-display text-base leading-5 font-semibold tabular-nums">
          {row.value}
        </span>
        <StripGlyph
          variant="histogram"
          className="h-4"
          fractions={model.ports.slice(0, MAX_PORT_BARS).map((port) => port.fraction)}
        />
      </span>
    </StripCard>
  );
}

export function NationPanel() {
  const { model } = useStatusStripState();
  const { nationRows } = useStatusStripMeta();
  const rows = nationRows.filter((row) => row.id !== "prestige");
  return (
    <StripPanel name="Nation" aside={model.nationName}>
      <div className="grid grid-cols-2 content-start gap-1">
        <PrestigeTile model={model} />
        {rows.map((row) => {
          if (row.id === "foreign-stations") {
            return <StationsTile key={row.id} row={row} model={model} />;
          }
          if (row.id === "shipyard-capacity") {
            return <ShipyardTile key={row.id} row={row} model={model} />;
          }
          return (
            <StripCard key={row.id} row={row}>
              <span className={FIELD_LABEL}>{row.label}</span>
              <span
                className={cn(
                  "font-display text-base leading-6 font-semibold tabular-nums",
                  row.tone === "alert" && "text-destructive",
                )}
              >
                {row.value}
              </span>
            </StripCard>
          );
        })}
      </div>
    </StripPanel>
  );
}
