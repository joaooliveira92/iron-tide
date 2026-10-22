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
import { FieldError } from "../../../components/ui/field.js";
import { NumberField, SelectField } from "../../../components/design-workspace/fields.js";
import { ArmourSchemeSelector } from "./ArmourSchemeSelector.js";
import { Panel } from "../../../components/design-workspace/panels/Panel.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import {
  armourMaterialChoices,
  FLAT_COS_BP,
  INCLINED_COS_BP,
  type ProtectionField,
  type ProtectionModel,
} from "../protection-view.js";

export function ProtectionEditor({
  model,
  edit,
  errorFor,
  onSelectRegion,
  selectedRegion,
}: {
  readonly model: ProtectionModel;
  readonly edit: (e: DraftEdit) => void;
  readonly errorFor?: (field: string) => string | undefined;
  readonly onSelectRegion?: (region: ArmourRegionId | null) => void;
  readonly selectedRegion?: ArmourRegionId | null;
}) {
  const format = usePresentationFormat();
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
  return (
    <Panel title="Protection">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Belt coverage</span>
        <Badge variant="outline" className="tabular-nums">
          {format.percent(model.coverageBp, 0)}
        </Badge>
        <span className="text-muted-foreground">Armour weight</span>
        <Badge variant="outline" className="tabular-nums">
          {format.measurement(model.totalWeightKg, "mass", { maximumFractionDigits: 0 })}
        </Badge>
      </div>
      <ArmourSchemeSelector model={model} edit={edit} />
      <MagazineBoxToggle model={model} edit={edit} />

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
                    error={errorFor?.(`set_armour_region:${field.region}`)}
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
  error,
  onSelect,
  onPatch,
  onRemove,
}: {
  readonly field: ProtectionField;
  readonly materials: ProtectionModel["materials"];
  readonly selected: boolean;
  readonly error?: string | undefined;
  readonly onSelect: () => void;
  readonly onPatch: (region: ArmourRegion, change: Partial<ArmourRegion>) => void;
  readonly onRemove: () => void;
}) {
  const format = usePresentationFormat();
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
            {format.measurement(field.weightKg, "mass", { maximumFractionDigits: 0 })}
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
        <Readout label="Thickness">{`${format.number(field.thicknessMm)} mm`}</Readout>
        <Readout label="Length coverage">{`${format.percent(field.coveragePermille * 10, 0)} of length`}</Readout>
        <Readout label="Weight">
          {format.measurement(field.weightKg, "mass", { maximumFractionDigits: 0 })}
        </Readout>
        <Readout label="Protected area">{`${format.number(field.protectedAreaM2)} m²`}</Readout>
        <Readout label="Material">{field.materialLabel}</Readout>
        <Readout label="Effective thickness">{`${format.number(field.effectiveThicknessMm)} mm`}</Readout>
        <Readout label="Effectiveness">
          {field.marginBp === null
            ? "n/a"
            : field.defeatsDesignThreat
              ? `defeats (margin ${format.number(field.marginBp)} bp)`
              : `penetrated (margin ${format.number(field.marginBp)} bp)`}
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
      {error && <FieldError>{error}</FieldError>}

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

function MagazineBoxToggle({
  model,
  edit,
}: {
  readonly model: ProtectionModel;
  readonly edit: (e: DraftEdit) => void;
}) {
  const fitted = model.fitted.some((f) => f.region === "MAGAZINE_BOX");
  const canAdd = model.defaultMaterialId !== "";
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        aria-label="Magazine box"
        checked={fitted}
        disabled={!fitted && !canAdd}
        onCheckedChange={(on) =>
          edit(
            on === true
              ? {
                  kind: "set_armour_region",
                  region: newArmourRegion(
                    "MAGAZINE_BOX",
                    model.regionSizing,
                    model.defaultMaterialId,
                  ),
                }
              : { kind: "remove_armour_region", region: "MAGAZINE_BOX" },
          )
        }
      />
      <span aria-hidden="true">Magazine box</span>
      <span className="text-xs text-muted-foreground">
        Armoured box round the magazines; adjust it below.
      </span>
    </label>
  );
}
