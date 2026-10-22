import { useState } from "react";
import {
  allOrNothingRegions,
  ARMOUR_REGIONS,
  newArmourRegion,
  type ArmourMaterialOption,
  type ArmourRegion,
  type DesignDraft,
  type WorkshopView,
} from "@bluewave/ship-design";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { Checkbox } from "../../ui/checkbox.js";
import { FieldError } from "../../ui/field.js";
import { NumberField, SelectField } from "../fields.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { Panel } from "./Panel.js";
import type { Edit } from "./types.js";

/** cos(30 degrees) in bp: the "inclined" setting. A flat-on plate is 10_000. */
const INCLINED_COS_BP = 8_660;
const FLAT_COS_BP = 10_000;

const words = (s: string) => s.replaceAll("_", " ").toLowerCase();

/** Everything about protection: coverage, every region's size and plate, the armour scheme. All numbers are draft or compiled values. */
export function ArmourPanel({
  draft,
  view,
  materials,
  edit,
  errorFor,
}: {
  readonly draft: DesignDraft;
  readonly view: WorkshopView;
  readonly materials: readonly ArmourMaterialOption[];
  readonly edit: Edit;
  /** The inline message for an edit, filed as `set_armour_region:<region>` (see `editField`), while it breaks the design. */
  readonly errorFor?: (field: string) => string | undefined;
}) {
  const format = usePresentationFormat();
  const tonnes = (kg: number) => format.measurement(kg, "mass", { maximumFractionDigits: 0 });
  const [toAdd, setToAdd] = useState("");
  const fitted = new Set<string>(draft.armour.regions.map((r) => r.region));
  const free = ARMOUR_REGIONS.filter((r) => !fitted.has(r));
  const armour = view.compiled.armour;
  const weightOf = (r: ArmourRegion) => armour?.weightByRegionKg[r.region] ?? 0;
  const materialOptions = (current: string) =>
    materials.map((m) => ({
      value: m.id,
      label: `${words(m.id)}${m.available ? "" : ` (${m.unavailableReason})`}`,
      disabled: !m.available && m.id !== current,
    }));
  const startMaterial =
    draft.armour.regions[0]?.materialId ?? materials.find((m) => m.available)?.id ?? "";
  const add = () => {
    const region = toAdd === "" ? free[0] : (toAdd as (typeof ARMOUR_REGIONS)[number]);
    if (region === undefined || startMaterial === "") return;
    const size = {
      lengthWlMm: draft.hull.lengthWl,
      beamMm: draft.hull.beam,
      depthMm: draft.hull.depthToMainDeck,
      citadelLengthMm: draft.armour.citadelLengthMm,
    };
    edit({
      kind: "set_armour_region",
      region: newArmourRegion(region, size, startMaterial),
    });
    setToAdd("");
  };
  const allOrNothing = allOrNothingRegions(draft.armour.regions, draft.armour.citadelLengthMm);
  const schemeChanges = JSON.stringify(allOrNothing) !== JSON.stringify(draft.armour.regions);
  const patch = (r: ArmourRegion, change: Partial<ArmourRegion>) =>
    edit({ kind: "set_armour_region", region: { ...r, ...change } });

  return (
    <Panel title="Protection">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Coverage</span>
        <Badge variant="outline" className="tabular-nums">
          {armour ? format.percent(armour.coverageBp, 0) : "n/a"}
        </Badge>
        <span className="text-muted-foreground">Armour weight</span>
        <Badge variant="outline" className="tabular-nums">
          {armour ? tonnes(armour.totalWeightKg) : "n/a"}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          disabled={!schemeChanges || draft.armour.citadelLengthMm <= 0}
          onClick={() => edit({ kind: "set_armour_regions", regions: allOrNothing })}
        >
          All or nothing
        </Button>
      </div>
      {draft.armour.regions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No armour fitted. The brief{" "}
          {draft.requirement.protectionGoal === "NONE" ? "accepts" : "does not accept"} an
          unprotected ship.
        </p>
      ) : (
        <ul className="space-y-3">
          {draft.armour.regions.map((r) => (
            <li key={r.region} className="space-y-1 rounded-md border p-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{words(r.region)}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-muted-foreground">{tonnes(weightOf(r))}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${r.region}`}
                    onClick={() => edit({ kind: "remove_armour_region", region: r.region })}
                  >
                    Remove
                  </Button>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <NumberField
                  label={`Thickness of ${r.region}`}
                  shortLabel="Thickness"
                  unit="mm"
                  value={r.thicknessUm}
                  scale={1000}
                  onCommit={(v) => patch(r, { thicknessUm: v })}
                />
                <NumberField
                  label={`Length of ${r.region}`}
                  shortLabel="Length"
                  unit="m"
                  value={r.lengthMm}
                  scale={1000}
                  decimals={1}
                  onCommit={(v) => patch(r, { lengthMm: v })}
                />
                <NumberField
                  label={`Height of ${r.region}`}
                  shortLabel="Height"
                  unit="m"
                  value={r.heightMm}
                  scale={1000}
                  decimals={1}
                  onCommit={(v) => patch(r, { heightMm: v })}
                />
                <SelectField
                  label={`Material of ${r.region}`}
                  shortLabel="Material"
                  value={r.materialId}
                  options={materialOptions(r.materialId)}
                  onChange={(v) => patch(r, { materialId: v })}
                />
              </div>
              {errorFor?.(`set_armour_region:${r.region}`) && (
                <FieldError>{errorFor(`set_armour_region:${r.region}`)}</FieldError>
              )}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  aria-label={`Inclined ${r.region}`}
                  checked={r.cosObliquityBp < FLAT_COS_BP}
                  onCheckedChange={(v) =>
                    patch(r, { cosObliquityBp: v === true ? INCLINED_COS_BP : FLAT_COS_BP })
                  }
                />
                Inclined (30°): a sloped plate stops more than a flat one of the same thickness
              </label>
            </li>
          ))}
        </ul>
      )}
      {free.length > 0 && (
        <div className="flex items-end gap-2">
          <SelectField
            className="flex-1"
            label="Add armour region"
            value={toAdd === "" ? (free[0] ?? "") : toAdd}
            options={free.map((r) => ({ value: r, label: words(r) }))}
            onChange={setToAdd}
          />
          <Button variant="outline" size="sm" onClick={add}>
            Add region
          </Button>
        </div>
      )}
    </Panel>
  );
}
