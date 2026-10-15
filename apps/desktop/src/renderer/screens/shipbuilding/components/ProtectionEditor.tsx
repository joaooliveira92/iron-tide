import { useState, type ReactNode } from "react";
import {
  newArmourRegion,
  type ArmourRegion,
  type ArmourRegionId,
  type DraftEdit,
} from "@bluewave/ship-design";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Checkbox } from "../../../components/ui/checkbox.js";
import { Advanced } from "../../../components/design-workspace/Advanced.js";
import { NumberField, SelectField } from "../../../components/design-workspace/fields.js";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import {
  armourMaterialChoices,
  FLAT_COS_BP,
  INCLINED_COS_BP,
  type ProtectionField,
  type ProtectionModel,
} from "../protection-view.js";

const tonnes = (kg: number) => (kg / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 });
const m2 = (area: number) => area.toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * The Protection section's armour editor: the design's armour regions grouped spatially (belt, deck, conning tower,
 * armament, underwater), each field showing its compiled consequences and editing the draft. Advanced settings
 * (material, inclination) sit behind a disclosure. Selecting a field highlights that armour on the ship plan.
 * Presentation only: every readout and edit input comes from the view model, and every control is a draft edit.
 */
export function ProtectionEditor({
  model,
  edit,
  onSelectRegion,
  selectedRegion,
}: {
  readonly model: ProtectionModel;
  readonly edit: (e: DraftEdit) => void;
  /** Pins the region for the ship-plan highlight; null clears it. */
  readonly onSelectRegion?: (region: ArmourRegionId | null) => void;
  readonly selectedRegion?: ArmourRegionId | null;
}) {
  const [toAdd, setToAdd] = useState("");
  const patch = (region: ArmourRegion, change: Partial<ArmourRegion>) =>
    edit({ kind: "set_armour_region", region: { ...region, ...change } });
  const remove = (region: ArmourRegionId) => edit({ kind: "remove_armour_region", region });
  const add = () => {
    const region = (toAdd === "" ? model.availableRegions[0]?.id : toAdd) as
      | ArmourRegionId
      | undefined;
    if (region === undefined || model.defaultMaterialId === "") return;
    edit({
      kind: "set_armour_region",
      region: newArmourRegion(region, model.regionSizing, model.defaultMaterialId),
    });
    setToAdd("");
  };
  const schemeChanges =
    JSON.stringify(model.allOrNothing) !== JSON.stringify(model.fitted.map((f) => f.armour));

  return (
    <Panel title="Protection">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Belt coverage</span>
        <Badge variant="outline" className="tabular-nums">
          {(model.coverageBp / 100).toFixed(0)}%
        </Badge>
        <span className="text-muted-foreground">Armour weight</span>
        <Badge variant="outline" className="tabular-nums">
          {tonnes(model.totalWeightKg)} t
        </Badge>
        <Button
          variant="outline"
          size="sm"
          disabled={!schemeChanges || model.regionSizing.citadelLengthMm <= 0}
          onClick={() => edit({ kind: "set_armour_regions", regions: model.allOrNothing })}
        >
          All or nothing
        </Button>
      </div>

      {model.fitted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No armour fitted. The brief{" "}
          {model.protectionGoal === "NONE" ? "accepts" : "does not accept"} an unprotected ship.
        </p>
      ) : (
        <div className="space-y-4">
          {model.groups.map((group) => (
            <section key={group.id} aria-label={group.label} className="space-y-2">
              <h3 className="text-sm font-medium">{group.label}</h3>
              <ul className="space-y-2">
                {group.fields.map((field) => (
                  <ProtectionFieldRow
                    key={field.region}
                    field={field}
                    materials={model.materials}
                    selected={selectedRegion === field.region}
                    onSelect={() =>
                      onSelectRegion?.(selectedRegion === field.region ? null : field.region)
                    }
                    onPatch={patch}
                    onRemove={() => remove(field.region)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {model.availableRegions.length > 0 && (
        <div className="flex items-end gap-2">
          <SelectField
            className="flex-1"
            label="Add armour region"
            value={toAdd === "" ? (model.availableRegions[0]?.id ?? "") : toAdd}
            options={model.availableRegions.map((r) => ({ value: r.id, label: r.label }))}
            onChange={setToAdd}
          />
          <Button variant="outline" size="sm" onClick={add}>
            Add region
          </Button>
        </div>
      )}

      <details className="rounded-md border p-2 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          What the model does not carry
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          {model.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
    </Panel>
  );
}

function ProtectionFieldRow({
  field,
  materials,
  selected,
  onSelect,
  onPatch,
  onRemove,
}: {
  readonly field: ProtectionField;
  readonly materials: ProtectionModel["materials"];
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onPatch: (region: ArmourRegion, change: Partial<ArmourRegion>) => void;
  readonly onRemove: () => void;
}) {
  const region = field.armour;
  return (
    <li
      data-armour-region={field.region}
      className={`space-y-2 rounded-md border p-2 ${selected ? "border-primary ring-1 ring-primary/40" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={selected}
          aria-label={`Select ${field.label} on the ship`}
          onClick={onSelect}
        >
          {field.label}
        </Button>
        <span className="flex items-center gap-2">
          <Badge variant="outline" className="tabular-nums">
            {tonnes(field.weightKg)} t
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove ${field.region}`}
            onClick={onRemove}
          >
            Remove
          </Button>
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <Readout label="Thickness">{`${field.thicknessMm.toLocaleString("en-US")} mm`}</Readout>
        <Readout label="Length coverage">{`${(field.coveragePermille / 10).toFixed(0)}% of length`}</Readout>
        <Readout label="Weight">{`${tonnes(field.weightKg)} t`}</Readout>
        <Readout label="Protected area">{`${m2(field.protectedAreaM2)} m²`}</Readout>
        <Readout label="Material">{field.materialLabel}</Readout>
        <Readout label="Effective thickness">{`${field.effectiveThicknessMm.toFixed(0)} mm`}</Readout>
        <Readout label="Effectiveness">
          {field.marginBp === null
            ? "n/a"
            : field.defeatsDesignThreat
              ? `defeats (margin ${field.marginBp} bp)`
              : `penetrated (margin ${field.marginBp} bp)`}
        </Readout>
      </dl>

      <div className="grid grid-cols-3 gap-2">
        <NumberField
          label={`Thickness of ${field.region}`}
          shortLabel="Thickness"
          unit="mm"
          value={region.thicknessUm}
          scale={1000}
          recommended={field.recommended.thicknessUm}
          onCommit={(v) => onPatch(region, { thicknessUm: v })}
        />
        <NumberField
          label={`Length of ${field.region}`}
          shortLabel="Length"
          unit="m"
          value={region.lengthMm}
          scale={1000}
          decimals={1}
          recommended={field.recommended.lengthMm}
          onCommit={(v) => onPatch(region, { lengthMm: v })}
        />
        <NumberField
          label={`Height of ${field.region}`}
          shortLabel="Height"
          unit="m"
          value={region.heightMm}
          scale={1000}
          decimals={1}
          recommended={field.recommended.heightMm}
          onCommit={(v) => onPatch(region, { heightMm: v })}
        />
      </div>

      <Advanced className="text-xs text-muted-foreground">
        <div className="grid grid-cols-2 items-end gap-2">
          <SelectField
            label={`Material of ${field.region}`}
            shortLabel="Material"
            value={region.materialId}
            options={armourMaterialChoices(materials, region.materialId)}
            onChange={(v) => onPatch(region, { materialId: v })}
          />
          <label className="flex items-center gap-2">
            <Checkbox
              aria-label={`Inclined ${field.region}`}
              checked={field.inclined}
              onCheckedChange={(v) =>
                onPatch(region, { cosObliquityBp: v === true ? INCLINED_COS_BP : FLAT_COS_BP })
              }
            />
            Inclined (30°)
          </label>
        </div>
      </Advanced>
    </li>
  );
}

function Readout({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
