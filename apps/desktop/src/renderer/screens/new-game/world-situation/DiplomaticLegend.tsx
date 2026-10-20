import { TENSION_LABEL_BANDS } from "@bluewave/campaign-engine";
import { attitudeLabel, worldText } from "../world-situation-copy.js";

/** `0–2`, `3–5`… derived from the engine's own band bounds, never retyped. */
function bandRanges() {
  const ascending = [...TENSION_LABEL_BANDS].sort((a, b) => a.min - b.min);
  return ascending.map((band, index) => {
    const next = ascending[index + 1];
    const max = next === undefined ? 10 : next.min - 1;
    return {
      label: band.label,
      range: max === band.min ? String(band.min) : `${band.min}–${max}`,
    };
  });
}

/**
 * An always-available key to the four relationship concepts and the tension
 * scale. A native disclosure keeps it keyboard-operable and out of the way; none
 * of its content depends on hover.
 */
export function DiplomaticLegend() {
  return (
    <details className="group rounded-md border border-border bg-background/40 px-4 py-3">
      <summary className="cursor-pointer rounded-sm text-sm font-semibold text-foreground outline-none marker:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring">
        {worldText("legend.heading")}
      </summary>
      <div className="mt-3 grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p>{worldText("legend.status")}</p>
          <p>{worldText("legend.attitude")}</p>
          <p>{worldText("legend.outlook")}</p>
          <p>{worldText("legend.confidence")}</p>
        </div>
        <div>
          <p className="mb-1.5 font-medium text-foreground">{worldText("legend.scale")}</p>
          <ul className="flex flex-col gap-0.5">
            {bandRanges().map(({ label, range }) => (
              <li key={label} className="tabular-nums">
                {worldText("legend.band", { band: attitudeLabel(label), range })}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
