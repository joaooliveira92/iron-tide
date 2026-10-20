import { useState } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import type { NameGroup } from "../class-name-suggestions.js";

/**
 * The nation's authored ship names, grouped by ship type, with a filter. Choosing one hands it to `onPick`; the host
 * decides what that does (here: sets the class name and closes). The design's own type is listed first.
 */
export function ClassNameBrowser({
  groups,
  current,
  onPick,
}: {
  readonly groups: readonly NameGroup[];
  /** The class name now in the field; its button shows as pressed. */
  readonly current: string;
  readonly onPick: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, names: g.names.filter((n) => n.toLowerCase().includes(q)) }))
    .filter((g) => g.names.length > 0);
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="shrink-0 text-muted-foreground">Filter names</span>
        <input
          aria-label="Filter names"
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
          placeholder="Type part of a name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {shown.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {groups.length === 0
            ? "This nation has no authored names."
            : "No name matches the filter."}
        </p>
      ) : (
        <div className="themed-scrollbar max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {shown.map((g) => (
            <section key={g.type} aria-label={g.label} className="space-y-1.5">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                {g.label}
                {g.current && <Badge variant="secondary">This design's type</Badge>}
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {g.names.map((name) => (
                  <li key={name}>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-pressed={name === current.trim()}
                      onClick={() => onPick(name)}
                    >
                      {name}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
