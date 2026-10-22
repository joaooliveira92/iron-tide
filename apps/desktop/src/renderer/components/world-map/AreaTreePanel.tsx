import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../../lib/utils.js";
import { buildAreaTree, type AreaTreeMode, type AreaTreeRow } from "./area-tree.js";

export interface AreaTreePanelProps {
  readonly rows: readonly AreaTreeRow[];
  readonly onSelectArea: (row: AreaTreeRow) => void;
  readonly className?: string;
}

const MODES: readonly { readonly id: AreaTreeMode; readonly label: string }[] = [
  { id: "ships", label: "Ships" },
  { id: "possessions", label: "Possessions" },
];

function rowDetail(row: AreaTreeRow, mode: AreaTreeMode): string {
  if (mode === "ships") return `${row.ships} ${row.ships === 1 ? "ship" : "ships"}`;
  return row.owner ?? "Unclaimed";
}

export function AreaTreePanel({ rows, onSelectArea, className }: AreaTreePanelProps) {
  const [mode, setMode] = useState<AreaTreeMode>("ships");
  const [query, setQuery] = useState("");
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const groups = useMemo(
    () => buildAreaTree({ rows, mode, query, toggled }),
    [rows, mode, query, toggled],
  );

  function toggle(id: string): void {
    setToggled((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={cn("space-y-1.5", className)} data-testid="area-tree">
      <div role="group" aria-label="Show in the area tree" className="flex gap-1">
        {MODES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={mode === option.id}
            onClick={() => setMode(option.id)}
            className={cn(
              "h-6 flex-1 rounded border border-white/25 px-1.5 text-xs hover:bg-white/10",
              mode === option.id ? "bg-white/15" : "opacity-75",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by name or owner"
        aria-label="Filter areas"
        className="h-7 w-full rounded-md border border-white/25 bg-transparent px-2 text-xs placeholder:opacity-60"
      />
      <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-1" aria-label="Areas by region">
        {groups.length === 0 && (
          <li className="px-1 py-1 opacity-75">
            {mode === "ships" ? "No areas with your ships." : "No areas under your control."}
          </li>
        )}
        {groups.map((group) => (
          <li key={group.id}>
            <button
              type="button"
              aria-expanded={group.expanded}
              onClick={() => toggle(group.id)}
              className="flex w-full items-center gap-1 rounded px-1 py-1 text-left font-medium hover:bg-white/10"
            >
              {group.expanded ? (
                <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
              )}
              <span className="flex-1 truncate">{group.label}</span>
              <span
                className="shrink-0 rounded bg-white/15 px-1.5 tabular-nums"
                aria-label={`${group.badge} ${mode === "ships" ? "ships" : "areas"}`}
              >
                {group.badge}
              </span>
            </button>
            {group.expanded && (
              <ul className="ml-4 space-y-0.5" aria-label={group.label}>
                {group.rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onSelectArea(row)}
                      aria-current={row.selected ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-white/10",
                        row.selected && "bg-white/15",
                      )}
                    >
                      <span className="truncate">{row.name}</span>
                      <span className="shrink-0 tabular-nums opacity-75">
                        {rowDetail(row, mode)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
