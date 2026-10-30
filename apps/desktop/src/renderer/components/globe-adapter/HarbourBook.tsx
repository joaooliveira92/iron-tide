import { Anchor, Search, Ship } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "../../lib/utils.js";
import { SlateHeader } from "../ui/slate.js";

export interface HarbourEntity {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly areaId: string;
}

export interface HarbourBookProps {
  readonly entities: readonly HarbourEntity[];
  readonly areaName: (areaId: string) => string;
  readonly onSelect: (entity: HarbourEntity) => void;
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function Group({
  title,
  icon,
  rows,
  areaName,
  onSelect,
}: {
  readonly title: string;
  readonly icon: "port" | "fleet";
  readonly rows: readonly HarbourEntity[];
  readonly areaName: (areaId: string) => string;
  readonly onSelect: (entity: HarbourEntity) => void;
}) {
  if (rows.length === 0) return null;
  const Icon = icon === "port" ? Anchor : Ship;
  return (
    <section aria-label={title} className="grid gap-0.5">
      <h3 className="px-2 pb-0.5 text-xs font-medium text-muted-foreground">
        {title} <span className="tabular-nums">({rows.length})</span>
      </h3>
      <ul className="grid gap-0.5">
        {rows.map((entity) => (
          <li key={entity.id}>
            <button
              type="button"
              onClick={() => onSelect(entity)}
              className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-xs outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded border",
                  icon === "port"
                    ? "border-[#ffd24a]/50 bg-[#ffd24a]/10 text-[#ffd24a]"
                    : "border-[#5fc0ff]/50 bg-[#5fc0ff]/10 text-[#5fc0ff]",
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {entity.name}
                <span className="sr-only"> ({entity.kind})</span>
              </span>
              <span className="max-w-[40%] shrink-0 truncate text-muted-foreground">
                {areaName(entity.areaId)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HarbourBook({ entities, areaName, onSelect }: HarbourBookProps) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      needle === ""
        ? entities
        : entities.filter(
            (entity) =>
              entity.name.toLowerCase().includes(needle) ||
              areaName(entity.areaId).toLowerCase().includes(needle),
          ),
    [areaName, entities, needle],
  );
  const ports = visible.filter((entity) => entity.kind === "port");
  const fleets = visible.filter((entity) => entity.kind === "fleet");
  const total = {
    ports: entities.filter((entity) => entity.kind === "port").length,
    fleets: entities.filter((entity) => entity.kind === "fleet").length,
  };

  return (
    <nav aria-label="Ports and fleets" data-testid="globe-adapter-entities">
      <SlateHeader
        title="Ports and fleets"
        aside={`${plural(total.ports, "port")}, ${plural(total.fleets, "fleet")}`}
      />
      <div className="grid gap-3 p-3">
        <label className="flex h-8 items-center gap-2 rounded-md border bg-background/40 px-2 text-xs focus-within:ring-2 focus-within:ring-ring">
          <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="search"
            aria-label="Filter ports and fleets"
            placeholder="Find a port, fleet or sea"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="grid max-h-72 gap-3 overflow-y-auto">
          <Group title="Ports" icon="port" rows={ports} areaName={areaName} onSelect={onSelect} />
          <Group
            title="Fleets"
            icon="fleet"
            rows={fleets}
            areaName={areaName}
            onSelect={onSelect}
          />
          {visible.length === 0 && (
            <p role="status" className="px-2 py-3 text-xs text-muted-foreground">
              {entities.length === 0
                ? "Nothing is stationed on the chart yet."
                : `No port, fleet or sea matches “${query.trim()}”.`}
            </p>
          )}
        </div>
      </div>
    </nav>
  );
}
