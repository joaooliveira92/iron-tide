import { useMemo } from "react";
import {
  pickerOptions,
  ZONE_IDS,
  type PartCatalogueEntry,
  type ZoneId,
} from "@bluewave/ship-design";
import { usePresentationFormat } from "../../../../shell/usePresentationFormat.js";
import { buttonVariants } from "../../../ui/button.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu.js";
import { cn } from "../../../../lib/utils.js";
import { componentsByCategory } from "../../componentFacts.js";
import { SelectField } from "../../fields.js";
import { PickerFilterControls } from "../../PickerFilterControls.js";
import {
  HIDDEN_REASON_LABEL,
  inchesOf,
  nationLabel,
  pickerQueryOf,
  usePickerFilters,
  type PickerContext,
} from "../../pickerFilters.js";
import { zoneLabel } from "./placement-helpers.js";

const byCaliber = (a: PartCatalogueEntry, b: PartCatalogueEntry): number =>
  (a.caliberUm ?? 0) - (b.caliberUm ?? 0);

export function AddComponentBar({
  catalogue,
  picker,
  zoneId,
  onAdd,
  onZoneChange,
}: {
  readonly catalogue: readonly PartCatalogueEntry[];
  readonly picker: PickerContext;
  readonly zoneId: ZoneId;
  readonly onAdd: (entry: PartCatalogueEntry) => void;
  readonly onZoneChange: (zone: ZoneId) => void;
}) {
  const format = usePresentationFormat();
  const [filters, setFilters] = usePickerFilters();
  const { available, hidden } = useMemo(
    () => pickerOptions(catalogue, pickerQueryOf(picker, filters)),
    [catalogue, picker, filters],
  );
  const hiddenReasons = useMemo(() => new Map(hidden.map((h) => [h.entry.id, h.reason])), [hidden]);
  const listed = filters.showUnavailable
    ? [...available, ...hidden.map((h) => h.entry)]
    : available;
  const groups = componentsByCategory(listed).map((g) => ({
    ...g,
    items: [...g.items].sort(byCaliber),
  }));
  const detail = (c: PartCatalogueEntry): string => {
    const parts: string[] = [];
    if (c.caliberUm !== undefined) {
      parts.push(
        `${format.number(inchesOf(c.caliberUm), { maximumFractionDigits: 1, minimumFractionDigits: 1 })}-inch`,
      );
    }
    const nation = nationLabel(c);
    if (nation !== null) parts.push(nation);
    parts.push(c.introduction.fromMonth.slice(0, 4));
    const reason = hiddenReasons.get(c.id);
    if (reason !== undefined) parts.push(HIDDEN_REASON_LABEL[reason]);
    return parts.join(" · ");
  };
  return (
    <div className="flex flex-wrap items-end gap-3 border-t pt-3">
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "default" }))}>
          Add component
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-96 overflow-y-auto">
          {groups.length === 0 && (
            <DropdownMenuLabel>No parts match the current filters</DropdownMenuLabel>
          )}
          {groups.map((g, i) => (
            <DropdownMenuGroup key={g.category}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{g.category}</DropdownMenuLabel>
              {g.items.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  disabled={hiddenReasons.has(c.id)}
                  onClick={() => onAdd(c)}
                >
                  {c.displayName}
                  <span className="ml-auto pl-3 text-xs text-muted-foreground">{detail(c)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <SelectField
        className="min-w-44"
        label="Add to zone"
        value={zoneId}
        options={ZONE_IDS.map((z) => ({ value: z, label: zoneLabel(z) }))}
        onChange={(v) => onZoneChange(v as ZoneId)}
      />
      <PickerFilterControls
        catalogue={catalogue}
        filters={filters}
        onChange={setFilters}
        allowShowUnavailable
      />
    </div>
  );
}
