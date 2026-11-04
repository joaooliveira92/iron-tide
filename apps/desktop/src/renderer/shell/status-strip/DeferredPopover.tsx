import { Eye, Info } from "lucide-react";

import { Badge } from "../../components/ui/badge.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.js";
import { NOT_YET_MODELLED } from "../status-strip-state.js";
import { useStatusStripState } from "./StatusStripContext.js";

export function DeferredPopover() {
  const { model } = useStatusStripState();
  const rows = model.deferredRows;
  if (rows.length === 0) return null;
  const groups = [
    { name: "Nation", rows: model.nation.filter((row) => row.deferred) },
    { name: "Budget", rows: model.budget.filter((row) => row.deferred) },
  ].filter((group) => group.rows.length > 0);
  return (
    <Popover>
      <PopoverTrigger
        render={<button type="button" />}
        className="inline-flex h-5 items-center gap-1 rounded-md border bg-transparent px-1.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring data-popup-open:bg-accent"
      >
        <Eye className="size-3.5" aria-hidden="true" />
        <span>
          {NOT_YET_MODELLED} ({rows.length})
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" aria-label={NOT_YET_MODELLED} className="w-96 p-0">
        <div className="border-b px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Info className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {NOT_YET_MODELLED}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Named in RTW3 but not modelled by the campaign yet. These are never shown as numbers.
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {groups.map((group) => (
            <section key={group.name} aria-label={`${group.name} readouts`}>
              <p className="sticky top-0 flex items-center justify-between bg-popover/95 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
                {group.name}
                <span className="tabular-nums">{group.rows.length}</span>
              </p>
              <ul className="divide-y divide-border/60">
                {group.rows.map((row) => (
                  <li
                    key={row.id}
                    data-row={row.id}
                    data-tone={row.tone}
                    data-deferred={row.deferred}
                    className="px-3 py-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{row.label}</span>
                      <Badge
                        variant="outline"
                        className="shrink-0 px-1.5 py-0 text-xs text-muted-foreground"
                      >
                        {NOT_YET_MODELLED}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{row.note}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
