import {
  buildShipTypeRoster,
  nationProfileBrief,
  SHIP_TYPE_CATEGORIES,
  type RosterEntry,
  type StarterDesign,
  type WorkshopEnvironment,
} from "@bluewave/ship-design";
import { useMemo, useState } from "react";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { CATEGORY_LABEL } from "../shipTypes.js";
import { NationalIdentityPanel } from "./NationalIdentityPanel.js";
import { Panel } from "./Panel.js";
import { ShipTypeDetails, ShipTypeFacts } from "./ShipTypeDetails.js";

function RosterRow({
  entry,
  current,
  onStart,
}: {
  readonly entry: RosterEntry;
  readonly current: boolean;
  readonly onStart: (starterId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const d = entry.definition;
  const detailsId = `ship-type-${d.id}-details`;
  const starter = entry.starter;
  return (
    <li className="rounded-md border p-3" aria-current={current ? "true" : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-medium">
          {d.name} <span className="tabular-nums text-muted-foreground">({d.id})</span>
        </h4>
        {d.auxiliary && <Badge variant="outline">Auxiliary</Badge>}
        {current && <Badge variant="secondary">Current design</Badge>}
        <Badge variant="outline">Available</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{d.recommendedUse}</p>
      <ShipTypeFacts
        entry={entry}
        className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide details" : `Details for ${d.name}`}
        </Button>
        <Button
          size="sm"
          disabled={starter === null || !starter.legal}
          onClick={() => starter !== null && onStart(starter.id)}
        >
          {starter === null ? "No starter design yet" : `Start from ${starter.name}`}
        </Button>
      </div>
      {open && (
        <div id={detailsId}>
          <ShipTypeDetails entry={entry} className="mt-2 space-y-1 border-t pt-2 text-xs" />
        </div>
      )}
    </li>
  );
}

export function ShipTypePanel({
  env,
  starters,
  currentCategory,
  onStart,
}: {
  readonly env: WorkshopEnvironment;
  readonly starters: readonly StarterDesign[];
  readonly currentCategory: string;
  readonly onStart: (starterId: string) => void;
}) {
  const roster = useMemo(() => buildShipTypeRoster(env, starters), [env, starters]);
  const available = roster.filter((e) => e.availability.available);
  const lockedCount = roster.length - available.length;
  const profile = env.ctx.navalProfile;
  return (
    <>
      {profile !== undefined && <NationalIdentityPanel brief={nationProfileBrief(profile)} />}
      <Panel title="Ship types">
        <p className="text-xs text-muted-foreground">
          Choose a type to start from its starter design. Starter designs are balanced starting
          points: edit them freely.
        </p>
        {SHIP_TYPE_CATEGORIES.map((cat) => {
          const rows = available.filter((e) => e.definition.category === cat);
          if (rows.length === 0) return null;
          const headingId = `ship-type-group-${cat}`;
          return (
            <section key={cat} aria-labelledby={headingId} className="space-y-2">
              <h3 id={headingId} className="text-xs font-semibold uppercase text-muted-foreground">
                {CATEGORY_LABEL[cat]}
              </h3>
              <ul className="space-y-2">
                {rows.map((e) => (
                  <RosterRow
                    key={e.definition.id}
                    entry={e}
                    current={e.definition.id === currentCategory}
                    onStart={onStart}
                  />
                ))}
              </ul>
            </section>
          );
        })}
        {lockedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Other kinds of ship are not available in this era.
          </p>
        )}
      </Panel>
    </>
  );
}
