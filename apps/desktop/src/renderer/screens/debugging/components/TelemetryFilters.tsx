import { ToggleGroup, ToggleGroupItem } from "../../../components/ui/toggle-group.js";
import type { OutcomeFilter } from "../types.js";
import { SearchInput } from "./SearchInput.js";

export interface TelemetryFiltersProps {
  readonly searchTerm: string;
  readonly outcomeFilter: OutcomeFilter;
  readonly onSearchChange: (term: string) => void;
  readonly onOutcomeFilterChange: (filter: OutcomeFilter) => void;
}

function isOutcomeFilter(value: string): value is OutcomeFilter {
  return value === "all" || value === "success" || value === "rejected";
}

export function TelemetryFilters({
  searchTerm,
  outcomeFilter,
  onSearchChange,
  onOutcomeFilterChange,
}: TelemetryFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <SearchInput
        placeholder="Filter by action…"
        value={searchTerm}
        onChange={onSearchChange}
        className="flex-1"
      />
      <ToggleGroup
        size="sm"
        value={[outcomeFilter]}
        onValueChange={(value) => {
          const v = value[0];
          if (v !== undefined && isOutcomeFilter(v)) onOutcomeFilterChange(v);
        }}
      >
        <ToggleGroupItem value="all" aria-label="All outcomes">
          All
        </ToggleGroupItem>
        <ToggleGroupItem value="success" aria-label="Successful only">
          OK
        </ToggleGroupItem>
        <ToggleGroupItem value="rejected" aria-label="Rejected only">
          Rejected
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
