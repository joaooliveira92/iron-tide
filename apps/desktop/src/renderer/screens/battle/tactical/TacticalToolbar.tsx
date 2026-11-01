import { translate } from "../../../lib/strings.js";
import { Button } from "../../../components/ui/button.js";
import type { MapOverlays } from "./TacticalMap.js";
import { TACTICAL_TIME_SCALES, type TacticalTimeScale } from "./tactical-time.js";

export interface TacticalToolbarProps {
  readonly running: boolean;
  readonly scale: TacticalTimeScale;
  readonly busy: boolean;
  readonly ended: boolean;
  readonly canFocus: boolean;
  readonly overlays: MapOverlays;
  readonly onToggleRunning: () => void;
  readonly onScale: (scale: TacticalTimeScale) => void;
  readonly onStep: () => void;
  readonly onFightToEnd: () => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onFit: () => void;
  readonly onFocus: () => void;
  readonly onOverlay: (overlay: keyof MapOverlays, on: boolean) => void;
}

const OVERLAY_KEYS: readonly (keyof MapOverlays)[] = ["labels", "tracks", "rings", "fire"];

export function TacticalToolbar(props: TacticalToolbarProps) {
  const { running, scale, busy, ended } = props;
  return (
    <div
      role="toolbar"
      aria-label={translate("tactical.toolbar.label")}
      data-testid="tactical-toolbar"
      className="flex flex-wrap items-center gap-2 rounded border border-border bg-card/60 p-1.5 text-xs"
    >
      <Button
        type="button"
        size="sm"
        variant={running ? "secondary" : "default"}
        data-testid="tactical-run-toggle"
        aria-pressed={running}
        disabled={ended}
        onClick={props.onToggleRunning}
      >
        {running ? translate("tactical.toolbar.pause") : translate("tactical.toolbar.resume")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="battle-advance"
        disabled={busy || ended || running}
        title={running ? translate("tactical.toolbar.pause") : undefined}
        onClick={props.onStep}
      >
        {translate("tactical.toolbar.step")}
      </Button>
      <div
        role="group"
        aria-label={translate("tactical.toolbar.speed_group")}
        className="flex gap-1"
      >
        {TACTICAL_TIME_SCALES.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={option === scale ? "default" : "outline"}
            aria-pressed={option === scale}
            data-testid={`tactical-speed-${String(option)}`}
            onClick={() => props.onScale(option)}
          >
            {translate("tactical.toolbar.speed_option", { scale: option })}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="battle-auto"
        disabled={busy || ended}
        onClick={props.onFightToEnd}
      >
        {translate("tactical.toolbar.fight_to_end")}
      </Button>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="tactical-zoom-in"
        onClick={props.onZoomIn}
      >
        {translate("tactical.toolbar.zoom_in")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="tactical-zoom-out"
        onClick={props.onZoomOut}
      >
        {translate("tactical.toolbar.zoom_out")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="tactical-fit"
        onClick={props.onFit}
      >
        {translate("tactical.toolbar.fit")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="tactical-focus"
        disabled={!props.canFocus}
        title={props.canFocus ? undefined : translate("tactical.toolbar.focus_disabled")}
        onClick={props.onFocus}
      >
        {translate("tactical.toolbar.focus")}
      </Button>
      <fieldset
        className="flex items-center gap-2"
        aria-label={translate("tactical.toolbar.overlays")}
      >
        {OVERLAY_KEYS.map((key) => (
          <label key={key} className="flex items-center gap-1">
            <input
              type="checkbox"
              data-testid={`tactical-overlay-${key}`}
              checked={props.overlays[key]}
              onChange={(event) => props.onOverlay(key, event.target.checked)}
            />
            {translate(`tactical.overlay.${key}`)}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
