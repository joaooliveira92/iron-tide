import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs.js";
import type { NameGroup } from "../class-name-suggestions.js";

/**
 * The nation's authored ship names: one vertical tab per ship type (with its name count), the names of the chosen
 * type beside it, and a filter across all types. Choosing a name hands it to `onPick`; the host decides what that
 * does (here: sets the class name and closes). The design's own type opens first.
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
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const q = query.trim().toLowerCase();
  const shown = groups
    .map((g) => ({ ...g, names: g.names.filter((n) => n.toLowerCase().includes(q)) }))
    .filter((g) => g.names.length > 0);
  const active = shown.find((g) => g.type === chosen) ?? shown.find((g) => g.current) ?? shown[0];
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <label className="relative block">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          aria-label="Filter names"
          className="h-9 w-full rounded-md border bg-background pl-8 pr-2 text-sm"
          placeholder="Filter names across all ship types"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {active === undefined ? (
        <p role="status" className="text-sm text-muted-foreground">
          {groups.length === 0
            ? "This nation has no authored names."
            : "No name matches the filter."}
        </p>
      ) : (
        <Tabs
          value={active.type}
          onValueChange={(v) => setChosen(String(v))}
          orientation="vertical"
          className="flex min-h-0 gap-6"
        >
          <TabsList
            variant="line"
            className="themed-scrollbar max-h-[50vh] w-72 shrink-0 flex-col items-stretch justify-start overflow-y-auto pl-2 pr-2"
          >
            {shown.map((g) => (
              <TabsTrigger key={g.type} value={g.type} className="justify-start gap-2 py-1.5">
                <span className="truncate">{g.label}</span>
                <Badge variant="secondary" className="ml-auto px-1.5 py-0">
                  {g.names.length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          {shown.map((g) => (
            <TabsContent
              key={g.type}
              value={g.type}
              className="themed-scrollbar mt-0 max-h-[50vh] min-w-0 flex-1 space-y-3 overflow-y-auto"
            >
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
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
