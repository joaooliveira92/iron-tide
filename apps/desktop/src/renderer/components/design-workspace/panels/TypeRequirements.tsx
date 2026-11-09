import type {
  RequirementBound,
  ShipTypeRequirementCheck,
  WorkshopRequirements,
} from "@bluewave/ship-design";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";

const FIELD_LABEL: Readonly<Record<ShipTypeRequirementCheck["field"], string>> = {
  displacement: "Displacement",
  speed: "Speed",
  belt: "Main belt",
  qualifyingArmour: "Armour",
  mainGun: "Main guns",
  turrets: "Main turrets",
  torpedoes: "Torpedo tubes",
  aircraft: "Aircraft",
  hull: "Hull form",
};

const BOUND_TEXT: Readonly<Record<RequirementBound, string>> = {
  atLeast: "at least",
  above: "over",
  atMost: "at most",
  below: "below",
};

const UNIT_TEXT: Readonly<Record<ShipTypeRequirementCheck["unit"], string>> = {
  t: "t",
  kn: "kn",
  in: "in",
  count: "",
  merchantHull: "",
};

const amount = (format: PresentationFormat, n: number, unit: ShipTypeRequirementCheck["unit"]) =>
  `${format.number(n, { maximumFractionDigits: 2 })}${UNIT_TEXT[unit] ? ` ${UNIT_TEXT[unit]}` : ""}`;

export function requirementLine(c: ShipTypeRequirementCheck, format: PresentationFormat): string {
  if (c.unit === "merchantHull") return "Hull form merchant-derived";
  return `${FIELD_LABEL[c.field]} ${BOUND_TEXT[c.bound]} ${amount(format, c.value, c.unit)}`;
}

function currentText(c: ShipTypeRequirementCheck, format: PresentationFormat): string {
  if (c.unit === "merchantHull") return c.current === 1 ? "now merchant" : "now not merchant";
  return `now ${amount(format, c.current, c.unit)}`;
}

export function TypeRequirements({
  requirements,
}: {
  readonly requirements: WorkshopRequirements;
}) {
  const format = usePresentationFormat();
  if (requirements.status === "UNCLASSIFIED")
    return (
      <p className="text-xs text-muted-foreground">
        This type has no classification rules yet, so nothing is checked against it.
      </p>
    );
  return (
    <ul aria-label="Requirements of the chosen type" className="space-y-1 text-xs">
      {requirements.checks.map((c, i) => (
        <li
          key={`${c.field}-${c.bound}-${i}`}
          className="flex flex-wrap items-baseline justify-between gap-x-2"
        >
          <span>{requirementLine(c, format)}</span>
          <span className="flex gap-2 tabular-nums">
            <span className="text-muted-foreground">{currentText(c, format)}</span>
            <span className={c.met ? "text-emerald-600" : "font-medium text-destructive"}>
              {c.met ? "Met" : "Not met"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
