import { ZONE_IDS, type PartCatalogueEntry, type ZoneId } from "@bluewave/ship-design";
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
import { zoneLabel } from "./placement-helpers.js";

export function AddComponentBar({
  catalogue,
  month,
  zoneId,
  onAdd,
  onZoneChange,
}: {
  readonly catalogue: readonly PartCatalogueEntry[];
  readonly month: string;
  readonly zoneId: ZoneId;
  readonly onAdd: (entry: PartCatalogueEntry) => void;
  readonly onZoneChange: (zone: ZoneId) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-t pt-3">
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "default" }))}>
          Add component
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-96 overflow-y-auto">
          {componentsByCategory(catalogue).map((g, i) => (
            <DropdownMenuGroup key={g.category}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{g.category}</DropdownMenuLabel>
              {g.items.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  disabled={c.introduction.fromMonth > month}
                  onClick={() => onAdd(c)}
                >
                  {c.displayName}
                  {c.introduction.fromMonth > month && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      from {c.introduction.fromMonth}
                    </span>
                  )}
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
    </div>
  );
}
