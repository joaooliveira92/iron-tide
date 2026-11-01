import type { PlayerBattleView } from "@bluewave/combat/battleResolution";
import { formatMeasurement } from "../../../lib/presentation-format/format.js";
import { UM_PER_NAUTICAL_MILE } from "../../../lib/presentation-format/units.js";
import { usePreferences } from "../../../lib/preferences-context.js";
import { translate } from "../../../lib/strings.js";
import { formatTacticalClock, type TacticalTimeScale } from "./tactical-time.js";

export function TacticalStatusBar({
  view,
  running,
  scale,
}: {
  readonly view: PlayerBattleView;
  readonly running: boolean;
  readonly scale: TacticalTimeScale;
}) {
  const { preferences } = usePreferences();
  const state = view.ended ? "finished" : running ? "running" : "paused";
  return (
    <div
      data-testid="tactical-status-bar"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded border border-border bg-card/60 px-2 py-1 text-xs"
    >
      <span
        role="status"
        data-testid="tactical-run-state"
        data-state={state}
        className={
          state === "paused"
            ? "rounded bg-amber-500 px-2 py-0.5 font-bold text-black"
            : state === "finished"
              ? "rounded bg-slate-600 px-2 py-0.5 font-bold text-white"
              : "rounded bg-emerald-600 px-2 py-0.5 font-bold text-white"
        }
      >
        {state === "paused"
          ? translate("tactical.status.paused")
          : state === "finished"
            ? translate("tactical.status.finished")
            : translate("tactical.status.running", { scale })}
      </span>
      <span data-testid="tactical-elapsed">
        {translate("tactical.status.elapsed", {
          clock: formatTacticalClock(view.minute),
          limit: formatTacticalClock(view.maxMinutes),
        })}
      </span>
      <span data-testid="battle-status">
        {view.ended ? `Ended: ${view.endReason ?? "unknown"}` : "In progress"}
      </span>
      <span>
        {"sea "}
        {view.weather.seaState.toLowerCase()}
        {" · "}
        {view.weather.daylight ? "day" : "night"}
        {" · "}
        {view.weather.precipitation.toLowerCase()}
        <span data-testid="battle-weather">
          {" · visibility "}
          {formatMeasurement(view.weather.visibilityNm * UM_PER_NAUTICAL_MILE, {
            locale: preferences.formattingLocale,
            category: "range",
            preset: preferences.measurementPreset,
            selections: preferences.measurementSelections,
          })}
        </span>
      </span>
      {view.ended && (
        <span data-testid="battle-outcome">
          Winner: {view.winnerId ?? "none"} · Loser: {view.loserId ?? "none"}
        </span>
      )}
    </div>
  );
}
