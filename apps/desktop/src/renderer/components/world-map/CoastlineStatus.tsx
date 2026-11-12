import { CHART } from "./chart-theme.js";
import type { CoastlineState } from "./useCoastline.js";

export function CoastlineStatus({ coastline }: { readonly coastline: CoastlineState }) {
  if (coastline.status === "ready") return null;
  return (
    <div
      role="status"
      className="absolute left-1/2 top-[calc(var(--chrome-top,0px)+0.75rem)] z-10 -translate-x-1/2 rounded-md border px-2.5 py-1 text-xs"
      style={{
        background: "oklch(0.16 0.025 245 / 0.85)",
        borderColor: "oklch(0.4 0.02 245)",
        color: CHART.ink,
      }}
    >
      {coastline.status === "loading"
        ? "Loading coastline…"
        : `Coastline unavailable: ${coastline.message}`}
    </div>
  );
}
