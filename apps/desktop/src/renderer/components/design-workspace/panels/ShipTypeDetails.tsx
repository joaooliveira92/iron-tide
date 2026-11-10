import { UNSIMULATED_ROLES, type RosterEntry } from "@bluewave/ship-design";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { plural } from "../plural.js";
import { requirementLine } from "./TypeRequirements.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";

const LEVEL = ["Very low", "Low", "Moderate", "High", "Very high"] as const;
const level = (n: number): string => LEVEL[n - 1] ?? "Moderate";

function months(n: number | null, format: PresentationFormat): string {
  return n === null ? "not forecast" : plural(n, "month", undefined, undefined, format);
}

const role = (r: string) => r.replaceAll("_", " ").toLowerCase();

export function ShipTypeFacts({
  entry,
  className = "grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3",
}: {
  readonly entry: RosterEntry;
  readonly className?: string;
}) {
  const format = usePresentationFormat();
  const starter = entry.starter;
  const noStarter = "No priced starter";
  return (
    <dl className={className}>
      <div>
        <dt className="text-muted-foreground">Relative cost</dt>
        <dd>{entry.costLevel === null ? noStarter : level(entry.costLevel)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Starter price</dt>
        <dd className="tabular-nums">
          {starter?.costMicro == null ? noStarter : format.moneyFromMicro(starter.costMicro)}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Build time</dt>
        <dd>
          {entry.buildTimeLevel === null ? noStarter : level(entry.buildTimeLevel)}
          {starter?.months != null && ` (${months(starter.months, format)})`}
        </dd>
      </div>
    </dl>
  );
}

export function ShipTypeDetails({
  entry,
  className = "space-y-1 text-xs",
}: {
  readonly entry: RosterEntry;
  readonly className?: string;
}) {
  const format = usePresentationFormat();
  const d = entry.definition;
  const unsimulated = d.roles.filter((r) => UNSIMULATED_ROLES.includes(r));
  return (
    <div className={className}>
      <p>{d.description}</p>
      <p>
        <span className="text-muted-foreground">Armour: </span>
        {d.armourProfile}
      </p>
      <p>
        <span className="text-muted-foreground">Armament: </span>
        {d.armamentProfile}
      </p>
      <p>
        <span className="text-muted-foreground">Weaknesses: </span>
        {d.weaknesses}
      </p>
      <p>
        <span className="text-muted-foreground">Roles: </span>
        {d.roles.map(role).join(", ")}
      </p>
      {unsimulated.length > 0 && (
        <p>
          <span className="text-muted-foreground">Not yet simulated: </span>
          {unsimulated.map(role).join(", ")}. The campaign does not model these missions yet.
        </p>
      )}
      {entry.requirements.status === "UNCLASSIFIED" ? (
        <p className="text-muted-foreground">
          This type has no classification rules yet, so nothing is checked against it.
        </p>
      ) : (
        <div>
          <span className="text-muted-foreground">Classification requirements:</span>
          <ul aria-label="Classification requirements" className="list-disc pl-4">
            {entry.requirements.rows.map((r, i) => (
              <li key={`${r.field}-${r.bound}-${i}`}>{requirementLine(r, format)}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-muted-foreground">
        {d.torpedoes === "REQUIRED"
          ? "Torpedoes are mandatory."
          : d.torpedoes === "PROHIBITED"
            ? "Torpedoes are not allowed."
            : "Torpedoes are optional."}{" "}
        The starter design is a legal starting point, not an optimal one.
      </p>
    </div>
  );
}
