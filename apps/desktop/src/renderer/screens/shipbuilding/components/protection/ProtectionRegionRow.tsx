import type { ReactNode } from "react";
import { Badge } from "../../../../components/ui/badge.js";
import { Button } from "../../../../components/ui/button.js";
import { Checkbox } from "../../../../components/ui/checkbox.js";
import { Advanced } from "../../../../components/design-workspace/Advanced.js";
import { FieldError } from "../../../../components/ui/field.js";
import { NumberField, SelectField } from "../../../../components/design-workspace/fields.js";
import {
  armourMaterialChoices,
  FLAT_COS_BP,
  INCLINED_COS_BP,
  type ProtectionField,
} from "../../protection-view.js";
import {
  useProtectionActions,
  useProtectionEditing,
  useProtectionMeta,
} from "./ProtectionEditing.js";

export function ProtectionRegionRow({ field }: { readonly field: ProtectionField }) {
  const { model, selectedRegion, errorFor } = useProtectionEditing();
  const { patch, remove, toggleRegion } = useProtectionActions();
  const { format } = useProtectionMeta();
  const region = field.armour;
  const selected = selectedRegion === field.region;
  const error = errorFor?.(`set_armour_region:${field.region}`);
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
          onClick={() => toggleRegion(field.region)}
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
            onClick={() => remove(field.region)}
          >
            Remove
          </Button>
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
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
          onCommit={(value) => patch(region, { thicknessUm: value })}
        />
        <NumberField
          label={`Length of ${field.region}`}
          shortLabel="Length"
          unit="m"
          value={region.lengthMm}
          scale={1000}
          decimals={1}
          recommended={field.recommended.lengthMm}
          onCommit={(value) => patch(region, { lengthMm: value })}
        />
        <NumberField
          label={`Height of ${field.region}`}
          shortLabel="Height"
          unit="m"
          value={region.heightMm}
          scale={1000}
          decimals={1}
          recommended={field.recommended.heightMm}
          onCommit={(value) => patch(region, { heightMm: value })}
        />
      </div>
      {error && <FieldError>{error}</FieldError>}

      <Advanced className="text-xs text-muted-foreground">
        <div className="grid grid-cols-2 items-end gap-2">
          <SelectField
            label={`Material of ${field.region}`}
            shortLabel="Material"
            value={region.materialId}
            options={armourMaterialChoices(model.materials, region.materialId)}
            onChange={(value) => patch(region, { materialId: value })}
          />
          <label className="flex items-center gap-2">
            <Checkbox
              aria-label={`Inclined ${field.region}`}
              checked={field.inclined}
              onCheckedChange={(on) =>
                patch(region, { cosObliquityBp: on === true ? INCLINED_COS_BP : FLAT_COS_BP })
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
