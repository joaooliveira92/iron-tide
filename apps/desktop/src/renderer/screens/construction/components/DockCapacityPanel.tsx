import { memo, useState } from "react";
import { Button } from "../../../components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";

/**
 * The dock/capacity readout and dock-expansion action (DESIGN-16 sections 4-6; SB3-R15..R19/R33). Presentational: every
 * figure is a compiled value handed in by the screen; the panel never reads authoritative state or authors a number.
 */
export interface DockCapacityPanelProps {
  /** The nation's compiled dock size — the largest new-construction displacement it may build; `null` when unresolvable. */
  readonly dockMaxBuildDisplacementKg: number | null;
  /** The national concurrency cap. */
  readonly maxConcurrentConstructionMassKg: number;
  /** Non-exempt new-construction mass already committed, competing with the cap. */
  readonly committedNewConstructionMassKg: number;
  /** Exempt AMC / small-corvette mass under construction, outside the cap. */
  readonly exemptNewConstructionMassKg: number;
  /** The shipped expansion duration, in months. */
  readonly dockExpansionDurationMonths: number;
  /** The next era step an expansion would lock, or `null` when the month has no era step. */
  readonly dockExpansionNextStepKg: number | null;
  /** The nation's ports, ascending by id — the expansion targets. */
  readonly dockPossessions: readonly { readonly id: string; readonly name: string }[];
  /** True while an expansion command is in flight, so the action disables. */
  readonly pending: boolean;
  readonly onAuthorizeDockExpansion: (possessionId: string) => void;
}

function Figure({
  label,
  testId,
  value,
}: {
  readonly label: string;
  readonly testId: string;
  readonly value: string;
}) {
  return (
    <li className="space-y-0.5">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="block font-mono text-sm font-semibold tabular-nums" data-testid={testId}>
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
  const [chosenPossessionId, setChosenPossessionId] = useState<string | null>(null);
  const selectedPossessionId =
    chosenPossessionId !== null && dockPossessions.some((p) => p.id === chosenPossessionId)
      ? chosenPossessionId
      : dockPossessions[0]?.id;
  const canExpand = dockExpansionNextStepKg !== null && selectedPossessionId !== undefined;
  const expansionValue =
    dockExpansionNextStepKg === null
      ? `${dockExpansionDurationMonths} months · no era step`
      : `${dockExpansionDurationMonths} months · next step ${dockExpansionNextStepKg.toLocaleString()} kg`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Dock and capacity</CardTitle>
        <CardDescription>
          The largest hull your dock can build, the national cap on tonnage under construction at
          once, and the expansion you can authorize.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul
          aria-label="Dock and capacity figures"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          <Figure
            label="Dock size"
            testId="dock-size"
            value={
              dockMaxBuildDisplacementKg === null
                ? "no dock"
                : dockMaxBuildDisplacementKg.toLocaleString()
            }
          />
          <Figure
            label="Concurrency cap"
            testId="concurrency-cap"
            value={maxConcurrentConstructionMassKg.toLocaleString()}
          />
          <Figure
            label="Capacity in use"
            testId="capacity-in-use"
            value={committedNewConstructionMassKg.toLocaleString()}
          />
          <Figure
            label="Exempt (AMC / small corvette)"
            testId="capacity-exempt"
            value={exemptNewConstructionMassKg.toLocaleString()}
          />
          <Figure label="Expansion" testId="dock-expansion" value={expansionValue} />
        </ul>
        <div className="flex flex-wrap items-end gap-3">
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
              if (selectedPossessionId !== undefined)
                onAuthorizeDockExpansion(selectedPossessionId);
            }}
          >
            Authorize dock expansion
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
