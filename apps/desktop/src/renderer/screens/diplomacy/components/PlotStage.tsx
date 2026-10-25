import { Layers } from "lucide-react";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "../../../components/ui/button.js";
import { ButtonGroup } from "../../../components/ui/button-group.js";
import { Checkbox } from "../../../components/ui/checkbox.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover.js";
import { cn } from "../../../lib/utils.js";
import type { BattleRecord } from "../diplomacy-hover.js";
import type { DiplomacyViewModel } from "../diplomacy-view-model.js";
import { PLOT_LAYERS, PLOT_VIEWS, type PlotLayer, type PlotView } from "./plot-layers.js";
import { TensionBands } from "./TensionBands.js";
import { TensionPlot } from "./TensionPlot.js";
import { Tip } from "../../../components/ui/tip.js";

export interface PlotStageProps {
  readonly vm: DiplomacyViewModel;
  readonly records: ReadonlyMap<string, BattleRecord>;
  readonly selectedId: string | null;
  readonly view: PlotView;
  readonly onView: (view: PlotView) => void;
  readonly layers: ReadonlySet<PlotLayer>;
  readonly onToggleLayer: (layer: PlotLayer) => void;
  readonly onSelect: (partnerNationId: string) => void;
  readonly wars: ReactNode;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

export function PlotStage({
  vm,
  records,
  selectedId,
  view,
  onView,
  layers,
  onToggleLayer,
  onSelect,
  wars,
}: PlotStageProps) {
  const { posture } = vm;
  return (
    <section aria-label="Diplomatic view" className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <ButtonGroup aria-label="Diplomatic view mode">
          {PLOT_VIEWS.map((v) => (
            <Tip label={v.hint}>
              <Button
                key={v.id}
                type="button"
                size="sm"
                variant={view === v.id ? "default" : "outline"}
                aria-pressed={view === v.id}

                onClick={() => onView(v.id)}
              >
                {v.label}
              </Button>
            </Tip>
          ))}
        </ButtonGroup>
        {view === "plot" && (
          <Popover>
            <PopoverTrigger
              title="Show or hide chart layers"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <Layers aria-hidden="true" className="size-4" />
              Layers
              <span className="tabular-nums text-muted-foreground">
                {layers.size}/{PLOT_LAYERS.length}
              </span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div role="group" aria-label="Chart layers" className="flex flex-col gap-1.5">
                {PLOT_LAYERS.map((layer) => (
                  <div key={layer.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      aria-label={layer.label}
                      checked={layers.has(layer.id)}
                      onCheckedChange={() => onToggleLayer(layer.id)}
                    />
                    <span aria-hidden="true">{layer.label}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="themed-scrollbar min-h-0 flex-1 space-y-4 overflow-auto p-3">
        {wars}

        <p className="text-sm text-muted-foreground">
          {view === "plot"
            ? "You at the centre; the nearer a nation, the nearer war. Select a contact for its dossier."
            : "Every nation in a column by its tension, from cordial on the left to war imminent on the right."}
        </p>

        {vm.relations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No relations recorded yet</p>
        ) : view === "plot" ? (
          <TensionPlot
            rows={vm.relations}
            playerFlagUrl={vm.playerFlagUrl}
            records={records}
            selectedId={selectedId}
            layers={layers}
            onSelect={onSelect}
          />
        ) : (
          <TensionBands
            rows={vm.relations}
            records={records}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}

        <ul className="flex flex-wrap gap-2 text-xs" aria-label="Chart legend">
          <li className="flex items-center gap-1.5 rounded-md border px-2 py-1">
            <span className="h-0.5 w-5 bg-success" />
            {plural(posture.allies, "alliance", "alliances")}
          </li>
          <li className="flex items-center gap-1.5 rounded-md border px-2 py-1">
            <span className="w-5 border-t-2 border-dashed border-muted-foreground" />
            {plural(posture.pacts, "pact", "pacts")}
          </li>
          <li className="flex items-center gap-1.5 rounded-md border px-2 py-1">
            <span className="h-0.5 w-5 bg-destructive" />
            {posture.activeWars === 0 ? "No wars yet" : plural(posture.activeWars, "war", "wars")}
          </li>
          <li className="rounded-md border px-2 py-1">
            {posture.blockades === 0
              ? "No blockades yet"
              : plural(posture.blockades, "blockade", "blockades")}
          </li>
        </ul>
      </div>
    </section>
  );
}
