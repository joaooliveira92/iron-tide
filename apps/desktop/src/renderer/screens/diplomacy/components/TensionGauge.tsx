import type { TensionLabel } from "@bluewave/campaign-engine";
import { humanizeId } from "../../../lib/humanize-id.js";
import { cn } from "../../../lib/utils.js";
import { TENSION_TONES } from "../diplomacy-presentation.js";

export interface TensionGaugeProps {
  readonly tension: number;
  readonly band: TensionLabel;
  readonly size?: "sm" | "lg";
  readonly className?: string;
}

const PIPS = 10;

export function TensionGauge({ tension, band, size = "sm", className }: TensionGaugeProps) {
  const filled = Math.max(0, Math.min(PIPS, tension));
  const tone = TENSION_TONES[band];
  return (
    <div
      role="meter"
      aria-label="Tension"
      aria-valuemin={0}
      aria-valuemax={PIPS}
      aria-valuenow={filled}
      aria-valuetext={`${filled} of ${PIPS}, ${humanizeId(band).toLowerCase()}`}
      className={cn("flex items-center", size === "lg" ? "gap-1" : "gap-0.5", className)}
    >
      {Array.from({ length: PIPS }, (_, index) => (
        <span
          key={index}
          className={cn(
            "rounded-[2px] transition-colors duration-300 motion-reduce:transition-none",
            size === "lg" ? "h-3 flex-1" : "h-3 w-1",
            index < filled ? tone.bar : "bg-muted-foreground/15",
          )}
        />
      ))}
    </div>
  );
}
