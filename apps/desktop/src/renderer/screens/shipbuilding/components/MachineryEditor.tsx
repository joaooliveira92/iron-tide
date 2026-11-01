import { useState } from "react";
import type { DraftEdit } from "@bluewave/ship-design";
import { Advanced } from "../../../components/design-workspace/Advanced.js";
import { DeltaPreview } from "../../../components/design-workspace/DeltaPreview.js";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import { NumberField, SelectField } from "../../../components/design-workspace/fields.js";
import type { Delta } from "../../../components/design-workspace/optionDelta.js";
import type { MachineryModel } from "../machinery-view.js";

export interface MachineryRecommended {
  readonly targetSpeedMilliKnots: number;
  readonly cruiseSpeedMilliKnots: number;
  readonly rangeNm: number;
}

export function MachineryEditor({
  model,
  edit,
  errorFor,
  previewDeltas,
  recommended,
}: {
  readonly model: MachineryModel;
  readonly edit: (e: DraftEdit) => void;
  readonly errorFor?: (field: string) => string | undefined;
  readonly previewDeltas?: ReadonlyMap<string, readonly Delta[]>;
  readonly recommended?: MachineryRecommended;
}) {
  const { inputs, outputs, notes } = model;
  const [previewPlant, setPreviewPlant] = useState<string | null>(null);
  const plantPreview = previewPlant === null ? [] : (previewDeltas?.get(previewPlant) ?? []);
  return (
    <Panel title="Machinery, fuel and range" hideTitle>
      <div className="grid gap-5">
        <section aria-label="Propulsion configuration" className="space-y-3">
          <h3 className="text-sm font-medium">Targets and configuration</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Target speed"
              shortLabel="Target speed"
              unit="kn"
              value={inputs.targetSpeedMilliKnots}
              scale={1000}
              decimals={1}
              step={0.5}
              recommended={recommended?.targetSpeedMilliKnots}
              error={errorFor?.("set_requirement:requiredSpeedMilliKnots")}
              onCommit={(v) =>
                edit({ kind: "set_requirement", patch: { requiredSpeedMilliKnots: v } })
              }
            />
            <NumberField
              label="Cruising speed"
              shortLabel="Cruising speed"
              unit="kn"
              value={inputs.cruiseSpeedMilliKnots}
              scale={1000}
              decimals={1}
              step={0.5}
              recommended={recommended?.cruiseSpeedMilliKnots}
              error={errorFor?.("set_requirement:cruiseSpeedMilliKnots")}
              onCommit={(v) =>
                edit({ kind: "set_requirement", patch: { cruiseSpeedMilliKnots: v } })
              }
            />
            <NumberField
              label="Operational range"
              shortLabel="Range"
              unit="nm"
              value={inputs.rangeNm}
              step={50}
              recommended={recommended?.rangeNm}
              error={errorFor?.("set_requirement:requiredRangeNm")}
              onCommit={(v) => edit({ kind: "set_requirement", patch: { requiredRangeNm: v } })}
            />
            <SelectField
              label="Propulsion plant"
              shortLabel="Propulsion plant"
              className="col-span-2"
              value={inputs.plantId}
              options={inputs.plantOptions.map((p) => ({
                value: p.id,
                label: p.reason === null ? p.label : `${p.label} — ${p.reason}`,
                disabled: p.disabled,
              }))}
              error={errorFor?.("set_machinery:plantId")}
              onChange={(v) => edit({ kind: "set_machinery", patch: { plantId: v } })}
              onActiveValueChange={setPreviewPlant}
            />
            <NumberField
              label="Installed power"
              shortLabel="Installed power"
              unit="kW"
              value={inputs.installedKw}
              step={100}
              error={errorFor?.("set_machinery:installedKw")}
              onCommit={(v) => edit({ kind: "set_machinery", patch: { installedKw: v } })}
            />
            <p className="col-span-2 text-xs text-muted-foreground">{inputs.installedPowerText}</p>
          </div>
          <DeltaPreview deltas={plantPreview} label="Effect of the highlighted plant" />
          <Advanced>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Fuel capacity"
                shortLabel="Fuel capacity"
                unit="t"
                value={inputs.fuelCapacityKg}
                scale={1000}
                error={errorFor?.("set_machinery:fuelCapacityKg")}
                onCommit={(v) => edit({ kind: "set_machinery", patch: { fuelCapacityKg: v } })}
              />
            </div>
          </Advanced>
        </section>

        <section aria-label="Calculated results" className="space-y-3">
          <h3 className="text-sm font-medium">Calculated results</h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm" data-testid="machinery-outputs">
            {outputs.map((o) => (
              <div
                key={o.id}
                className="flex items-baseline justify-between gap-3"
                data-output={o.id}
              >
                <dt className="text-muted-foreground">{o.label}</dt>
                <dd className="tabular-nums">{o.value}</dd>
              </div>
            ))}
          </dl>
          {notes.map((n) => (
            <p key={n} className="text-xs text-muted-foreground">
              {n}
            </p>
          ))}
        </section>
      </div>
    </Panel>
  );
}
