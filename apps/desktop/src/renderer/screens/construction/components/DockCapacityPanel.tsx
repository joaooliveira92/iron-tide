import { memo, useState } from "react";
import { Anchor, ArrowUpFromLine } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { DockGauge } from "./DockGauge.js";

export interface DockCapacityPanelProps {
  readonly dockMaxBuildDisplacementKg: number | null;
  readonly maxConcurrentConstructionMassKg: number;
  readonly committedNewConstructionMassKg: number;
  readonly exemptNewConstructionMassKg: number;
  readonly dockExpansionDurationMonths: number;
  readonly dockExpansionNextStepKg: number | null;
  readonly dockPossessions: readonly { readonly id: string; readonly name: string }[];
  readonly pending: boolean;
  readonly onAuthorizeDockExpansion: (possessionId: string) => void;
}

function Plate({
  label,
  testId,
  value,
}: {
  readonly label: string;
  readonly testId: string;
  readonly value: string;
}) {
  return (
    <li className="space-y-1 rounded-lg border bg-card p-3">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="block font-mono text-lg font-semibold tabular-nums" data-testid={testId}>
        {value}
      </span>
    </li>
  );
}

export const DockCapacityPanel = memo(function DockCapacityPanel({
  dockMaxBuildDisplacementKg,
  maxConcurrentConstructionMassKg,
  committedNewConstructionMassKg,
  exemptNewConstructionMassKg,
  dockExpansionDurationMonths,
  dockExpansionNextStepKg,
  dockPossessions,
  pending,
  onAuthorizeDockExpansion,
}: DockCapacityPanelProps) {
  const format = usePresentationFormat();
  const [chosenPossessionId, setChosenPossessionId] = useState<string | null>(null);
  const selectedPossessionId =
    chosenPossessionId !== null && dockPossessions.some((p) => p.id === chosenPossessionId)
      ? chosenPossessionId
      : dockPossessions[0]?.id;
  const canExpand = dockExpansionNextStepKg !== null && selectedPossessionId !== undefined;
  const mass = (kg: number) => format.measurement(kg, "mass", { maximumFractionDigits: 0 });
  const expansionValue =
    dockExpansionNextStepKg === null
      ? `${format.count(dockExpansionDurationMonths)} months · no era step`
      : `${format.count(dockExpansionDurationMonths)} months · next step ${mass(dockExpansionNextStepKg)}`;

  return (
    <section aria-label="Dock and capacity" className="space-y-4">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Anchor aria-hidden="true" className="size-4" />
          Dock and capacity
        </h3>
        <p className="max-w-prose text-sm text-muted-foreground">
          The largest hull your dock can build, the national cap on tonnage under construction at
          once, and the expansion you can authorize.
        </p>
      </div>
      <DockGauge
        economy={{
          dockMaxBuildDisplacementKg,
          maxConcurrentConstructionMassKg,
          committedNewConstructionMassKg,
          exemptNewConstructionMassKg,
        }}
      />
      <ul aria-label="Dock and capacity figures" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Plate
          label="Dock size"
          testId="dock-size"
          value={dockMaxBuildDisplacementKg === null ? "no dock" : mass(dockMaxBuildDisplacementKg)}
        />
        <Plate
          label="Concurrency cap"
          testId="concurrency-cap"
          value={mass(maxConcurrentConstructionMassKg)}
        />
        <Plate
          label="Capacity in use"
          testId="capacity-in-use"
          value={mass(committedNewConstructionMassKg)}
        />
        <Plate
          label="Exempt (AMC / small corvette)"
          testId="capacity-exempt"
          value={mass(exemptNewConstructionMassKg)}
        />
        <li className="col-span-2 space-y-1 rounded-lg border bg-card p-3 lg:col-span-2">
          <span className="block text-xs text-muted-foreground">Expansion</span>
          <span className="block font-mono text-lg font-semibold" data-testid="dock-expansion">
            {expansionValue}
          </span>
        </li>
      </ul>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-3">
        {dockPossessions.length > 1 && (
          <label className="space-y-0.5 text-xs text-muted-foreground">
            <span>Expansion possession</span>
            <select
              aria-label="Dock expansion possession"
              className="block h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm"
              value={selectedPossessionId ?? ""}
              onChange={(event) => setChosenPossessionId(event.target.value)}
            >
              {dockPossessions.map((possession) => (
                <option key={possession.id} value={possession.id}>
                  {possession.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !canExpand}
          onClick={() => {
            if (selectedPossessionId !== undefined) onAuthorizeDockExpansion(selectedPossessionId);
          }}
        >
          <ArrowUpFromLine aria-hidden="true" />
          Authorize dock expansion
        </Button>
        {dockExpansionNextStepKg === null && (
          <p className="text-xs text-muted-foreground">No expansion step is open in this era.</p>
        )}
      </div>
    </section>
  );
});
