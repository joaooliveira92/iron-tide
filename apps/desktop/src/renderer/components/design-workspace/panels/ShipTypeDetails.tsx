import { UNSIMULATED_ROLES, type RosterEntry } from "@bluewave/ship-design";
import { plural } from "../plural.js";
import { describeRange } from "../shipTypes.js";

/** A relative 1-5 ordinal as text, so it never relies on a bar's colour or length alone. */
const LEVEL = ["Very low", "Low", "Moderate", "High", "Very high"] as const;
const level = (n: number): string => LEVEL[n - 1] ?? "Moderate";

/** The starter design's forecast build time as text. */
function months(n: number | null): string {
  return n === null ? "not forecast" : plural(n, "month");
}

const role = (r: string) => r.replaceAll("_", " ").toLowerCase();

/** A ship type's comparable facts: relative cost and build time, displacement and speed envelopes. */
export function ShipTypeFacts({
  entry,
  className = "grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4",
}: {
  readonly entry: RosterEntry;
  readonly className?: string;
}) {
  const d = entry.definition;
  const starter = entry.starter;
  return (
    <dl className={className}>
      <div>
        <dt className="text-muted-foreground">Relative cost</dt>
        <dd>{level(d.relativeCost)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Build time</dt>
        <dd>
          {level(d.relativeBuildTime)}
          {starter?.months != null && ` (${months(starter.months)})`}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Displacement</dt>
        <dd>{describeRange(entry.envelope.displacementKg, "t", 1000) ?? "Varies"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Speed</dt>
        <dd>{describeRange(entry.envelope.speedKn, "kn") ?? "Varies"}</dd>
      </div>
    </dl>
  );
}

/** A ship type's rule detail: description, armour, armament, weaknesses, roles and the torpedo rule. */
export function ShipTypeDetails({
  entry,
  className = "space-y-1 text-xs",
}: {
  readonly entry: RosterEntry;
  readonly className?: string;
}) {
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
