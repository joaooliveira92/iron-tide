import type { ReactNode } from "react";

import { cn } from "../../lib/utils.js";
import { SlateBody, SlateFoot, SlateHeader } from "../ui/slate.js";
import { LAYERS, type LayerId, type MapPrototypeState } from "../world-map/map-state.js";
import { PROJECTIONS, type ProjectionId } from "../world-map/projection.js";

interface LayerGroup {
  readonly title: string;
  readonly layers: readonly LayerId[];
}

const LAYER_GROUPS: readonly LayerGroup[] = [
  { title: "Who holds what", layers: ["ownership", "borders", "possessions"] },
  { title: "What moves", layers: ["lanes", "fleets", "routes"] },
  { title: "Reading aids", layers: ["labels"] },
];

const LAYER_LABELS: Readonly<Record<LayerId, string>> = Object.fromEntries(
  LAYERS.map((layer) => [layer.id, layer.label]),
) as Record<LayerId, string>;

function Swatch({ layer }: { readonly layer: LayerId }) {
  switch (layer) {
    case "ownership":
      return <span className="size-3 rounded-[3px] bg-[#c9607a]/70 ring-1 ring-[#c9607a]" />;
    case "borders":
      return <span className="h-0 w-4 border-t-2 border-[#9cc2ae]" />;
    case "possessions":
      return <span className="size-2.5 rounded-full bg-[#ffd24a] ring-1 ring-black/60" />;
    case "lanes":
      return <span className="h-0 w-4 border-t border-[#3aa0e0]" />;
    case "fleets":
      return <span className="size-3 rounded-full bg-[#5fc0ff] ring-1 ring-black/60" />;
    case "routes":
      return <span className="h-0 w-4 border-t-2 border-dashed border-[#ff8c1a]" />;
    case "labels":
      return <span className="font-display text-xs leading-none text-[#d9f2ff]">Aa</span>;
  }
}

function LayerSwitch({
  layer,
  on,
  onToggle,
}: {
  readonly layer: LayerId;
  readonly on: boolean;
  readonly onToggle: (layer: LayerId) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(layer)}
      className="group flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-5 shrink-0 items-center justify-center transition-opacity",
          on ? "opacity-100" : "opacity-35",
        )}
      >
        <Swatch layer={layer} />
      </span>
      <span
        className={cn("min-w-0 flex-1 truncate", on ? "text-foreground" : "text-muted-foreground")}
      >
        {LAYER_LABELS[layer]}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full border transition-colors",
          on ? "border-admiralty-accent bg-admiralty-accent/40" : "border-border bg-muted/50",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-2.5 rounded-full bg-foreground transition-[left]",
            on ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className="grid gap-0.5">
      <h3 className="px-2 pb-0.5 text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function formatMeridian(centre: number): string {
  if (centre === 0) return "0°";
  return `${String(Math.abs(centre))}°${centre > 0 ? "E" : "W"}`;
}

export interface ChartLayersPanelProps {
  readonly state: MapPrototypeState;
  readonly onSetProjection: (projection: ProjectionId) => void;
  readonly onToggleLayer: (layer: LayerId) => void;
  readonly onSetCentre: (centre: number) => void;
  readonly onReset: () => void;
  readonly footer?: ReactNode;
}

export function ChartLayersPanel({
  state,
  onSetProjection,
  onToggleLayer,
  onSetCentre,
  onReset,
  footer,
}: ChartLayersPanelProps) {
  const activeCount = LAYERS.filter((layer) => state.layers[layer.id]).length;
  return (
    <div data-testid="chart-layers-panel">
      <SlateHeader title="Chart layers" aside={`${activeCount} of ${LAYERS.length} shown`} />
      <SlateBody>
        <Section title="Projection">
          <div role="radiogroup" aria-label="Projection" className="grid grid-cols-2 gap-1">
            {PROJECTIONS.map((option) => {
              const selected = state.projection === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  title={option.note}
                  onClick={() => onSetProjection(option.id)}
                  className={cn(
                    "h-8 cursor-pointer rounded-md border px-2 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-admiralty-accent bg-admiralty-accent/20 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {option.name}
                </button>
              );
            })}
          </div>
        </Section>

        {LAYER_GROUPS.map((group) => (
          <Section key={group.title} title={group.title}>
            {group.layers.map((layer) => (
              <LayerSwitch
                key={layer}
                layer={layer}
                on={state.layers[layer]}
                onToggle={onToggleLayer}
              />
            ))}
          </Section>
        ))}

        <Section title="Centre meridian">
          <div className="flex items-center gap-3 px-2">
            <input
              type="range"
              aria-label="Centre meridian"
              min={-180}
              max={180}
              step={10}
              value={state.centre}
              onChange={(event) => onSetCentre(Number(event.target.value))}
              className="h-6 min-w-0 flex-1 accent-[var(--admiralty-accent,currentColor)]"
            />
            <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
              {formatMeridian(state.centre)}
            </span>
          </div>
        </Section>
      </SlateBody>
      <SlateFoot>
        <span className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onReset}
            className="cursor-pointer rounded-md border px-2 py-1 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reset view
          </button>
          {footer}
        </span>
      </SlateFoot>
    </div>
  );
}
