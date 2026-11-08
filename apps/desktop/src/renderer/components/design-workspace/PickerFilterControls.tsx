import type { PartCatalogueEntry } from "@bluewave/ship-design";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import { Checkbox } from "../ui/checkbox.js";
import { SelectField } from "./fields.js";
import { caliberChoices, inchesOf, roleChoices, type PickerFilters } from "./pickerFilters.js";

const ANY = "any";

export function PickerFilterControls({
  catalogue,
  filters,
  onChange,
  allowShowUnavailable = false,
}: {
  readonly catalogue: readonly PartCatalogueEntry[];
  readonly filters: PickerFilters;
  readonly onChange: (patch: Partial<PickerFilters>) => void;
  readonly allowShowUnavailable?: boolean;
}) {
  const format = usePresentationFormat();
  const roles = roleChoices(catalogue);
  const calibers = caliberChoices(catalogue);
  const inches = (um: number) =>
    `${format.number(inchesOf(um), { maximumFractionDigits: 1, minimumFractionDigits: 1 })}-inch`;
  return (
    <div className="flex flex-wrap items-end gap-3" aria-label="Picker filters" role="group">
      {calibers.length > 1 && (
        <SelectField
          className="min-w-32"
          label="Minimum calibre"
          shortLabel="Calibre from"
          value={filters.minCaliberUm === null ? ANY : String(filters.minCaliberUm)}
          options={[
            { value: ANY, label: "Any" },
            ...calibers.map((um) => ({ value: String(um), label: inches(um) })),
          ]}
          onChange={(v) => onChange({ minCaliberUm: v === ANY ? null : Number(v) })}
        />
      )}
      {roles.length > 1 && (
        <SelectField
          className="min-w-32"
          label="Role"
          value={filters.role ?? ANY}
          options={[
            { value: ANY, label: "Any" },
            ...roles.map((role) => ({ value: role, label: role })),
          ]}
          onChange={(v) => onChange({ role: v === ANY ? null : v })}
        />
      )}
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox
          aria-label="Show all nations"
          checked={filters.showAllNations}
          onCheckedChange={(value) => onChange({ showAllNations: value === true })}
        />
        All nations
      </label>
      {allowShowUnavailable && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            aria-label="Show unavailable parts"
            checked={filters.showUnavailable}
            onCheckedChange={(value) => onChange({ showUnavailable: value === true })}
          />
          Show unavailable
        </label>
      )}
    </div>
  );
}
