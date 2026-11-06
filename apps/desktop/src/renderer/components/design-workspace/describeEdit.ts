import type { DesignDraft, DraftEdit, MountSide } from "@bluewave/ship-design";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import type { BoardFinding } from "./validation/boardFindings.js";
import { plainShipTypeName } from "./shipTypes.js";

type Show = (value: unknown, format: PresentationFormat) => string;

interface Field {
  readonly label: string;
  readonly show: Show;
}

type FieldTable<R> = { readonly [K in keyof R]-?: Field };

const words = (s: string): string =>
  s
    .replace(/([a-z])([A-Z])/g, (_match, lower: string, upper: string) => `${lower} ${upper}`)
    .replaceAll("_", " ")
    .toLowerCase();

const text: Show = (v) => (typeof v === "string" ? words(v) : "none");
const num =
  (n: (v: number, format: PresentationFormat) => string): Show =>
  (v, format) =>
    typeof v === "number" ? n(v, format) : "none";
const length = num((mm, f) => f.measurement(mm * 1000, "length", { maximumFractionDigits: 1 }));
const mass = num((kg, f) => f.measurement(kg, "mass", { maximumFractionDigits: 0 }));
const percent = num((bp, f) => f.percent(bp, 1));
const knots = num((milli, f) => `${f.number(milli / 1000, { maximumFractionDigits: 1 })} kn`);
const power = num((kw, f) => f.measurement(kw, "power", { maximumFractionDigits: 0 }));
const count = num((n) => String(n));
const nauticalMiles = num((nm, f) =>
  f.measurement(nm * 1_852_000_000, "range", { maximumFractionDigits: 0 }),
);
const permille = num((p, f) => f.percent(p * 10, 0));
const ofMaybe =
  (inner: Show): Show =>
  (v, f) =>
    v === null || v === undefined ? "none" : inner(v, f);

const HULL: FieldTable<DesignDraft["hull"]> = {
  hullFormId: { label: "Hull form", show: text },
  lengthWl: { label: "Length (waterline)", show: length },
  beam: { label: "Beam", show: length },
  draught: { label: "Draught", show: length },
  depthToMainDeck: { label: "Depth to main deck", show: length },
  blockCoeffBp: {
    label: "Block coefficient",
    show: num((bp, f) => f.number(bp / 10_000, { maximumFractionDigits: 2 })),
  },
  materialId: { label: "Hull material", show: text },
  structuralSchemeId: { label: "Structural scheme", show: text },
  subdivisionGrade: { label: "Subdivision grade", show: count },
  targetDisplacementKg: { label: "Target displacement", show: mass },
  limitDisplacementKg: { label: "Displacement limit", show: ofMaybe(mass) },
  designMarginBp: { label: "Design margin", show: percent },
  growthReserveBp: { label: "Growth reserve", show: percent },
  freeboardProfile: { label: "Freeboard profile", show: text },
};

const MACHINERY: FieldTable<DesignDraft["machinery"]> = {
  plantId: { label: "Engine plant", show: text },
  installedKw: { label: "Installed power", show: power },
  zoneId: { label: "Engine room", show: text },
  stationPermille: { label: "Engine position", show: permille },
  fuelCapacityKg: { label: "Fuel capacity", show: mass },
  fuelZoneId: { label: "Fuel bunker zone", show: text },
  fuelStationPermille: { label: "Fuel bunker position", show: permille },
  foulingBp: { label: "Hull fouling", show: percent },
  enginePriorityBp: { label: "Engine priority", show: ofMaybe(percent) },
  rooms: {
    label: "Machinery rooms",
    show: (v) => (Array.isArray(v) ? `${v.length} ${v.length === 1 ? "room" : "rooms"}` : "none"),
  },
};

const REQUIREMENT: FieldTable<DesignDraft["requirement"]> = {
  category: {
    label: "Ship type",
    show: (v) => (typeof v === "string" ? plainShipTypeName(v) : "none"),
  },
  requiredSpeedMilliKnots: { label: "Required speed", show: knots },
  cruiseSpeedMilliKnots: { label: "Cruising speed", show: knots },
  requiredRangeNm: { label: "Required range", show: nauticalMiles },
  designThreatId: { label: "Design threat", show: text },
  modernizationExpectation: { label: "Modernisation expectation", show: text },
  crewQualityBp: { label: "Crew quality", show: percent },
  accommodationStandard: { label: "Accommodation standard", show: text },
  protectionGoal: { label: "Protection goal", show: ofMaybe(text) },
};

function phrases<R extends object>(
  table: FieldTable<R>,
  patch: Partial<R>,
  before: R | undefined,
  format: PresentationFormat,
): string[] {
  return (Object.keys(patch) as (keyof R & string)[]).flatMap((k) => {
    const field = table[k];
    const after = patch[k];
    if (after === undefined) return [];
    const now = field.show(after, format);
    if (before === undefined) return [`${field.label} set to ${now}`];
    return [`${field.label} from ${field.show(before[k], format)} to ${now}`];
  });
}

const DIRECTIONAL: Readonly<Record<MountSide, string>> = {
  PORT: "port",
  STBD: "starboard",
  CENTRE: "the centreline",
};

export interface EditContext {
  readonly draft?: DesignDraft;
  readonly parts?: readonly { readonly instanceId: string; readonly componentId: string }[];
  readonly nameOf: (componentId: string) => string;
}

function partName(instanceId: string, ctx: EditContext): string {
  const placement = (ctx.parts ?? ctx.draft?.placements ?? []).find(
    (p) => p.instanceId === instanceId,
  );
  return placement ? ctx.nameOf(placement.componentId) : "a fitting";
}

export function describeEdit(e: DraftEdit, ctx: EditContext, format: PresentationFormat): string {
  const { draft } = ctx;
  switch (e.kind) {
    case "set_hull":
      return phrases(HULL, e.patch, draft?.hull, format).join("; ");
    case "set_machinery":
      return phrases(MACHINERY, e.patch, draft?.machinery, format).join("; ");
    case "set_requirement":
      return phrases(REQUIREMENT, e.patch, draft?.requirement, format).join("; ");
    case "set_fire_control": {
      const was = draft?.fireControl?.positions;
      const now = `${e.positions} ${e.positions === 1 ? "position" : "positions"}`;
      return was === undefined
        ? `Fire control set to ${now}`
        : `Fire control from ${was} to ${now}`;
    }
    case "set_tertiary": {
      if (e.tertiary === null) return "Remove the tertiary battery";
      const battery = (t: { count: number; caliberUm: number }) =>
        `${t.count} × ${format.measurement(t.caliberUm, "calibre", { maximumFractionDigits: 0 })}`;
      const was = draft?.tertiary;
      return was === undefined
        ? `Tertiary battery set to ${battery(e.tertiary)}`
        : `Tertiary battery from ${battery(was)} to ${battery(e.tertiary)}`;
    }
    case "set_side":
      return `Mount ${partName(e.instanceId, ctx)} to ${DIRECTIONAL[e.side]}`;
    case "batch":
      return e.edits.length === 1
        ? describeEdit(e.edits[0]!, ctx, format)
        : `${e.edits.length} changes: ${e.edits.map((x) => describeEdit(x, ctx, format)).join("; ")}`;
    case "add_placement":
      return `Add ${ctx.nameOf(e.placement.componentId)} to ${words(e.placement.zoneId)}`;
    case "remove_placement":
      return `Remove ${partName(e.instanceId, ctx)}`;
    case "move_placement":
      return `Move ${partName(e.instanceId, ctx)} to ${words(e.zoneId)} at ${format.percent(e.stationPermille * 10, 0)}`;
    case "set_param":
      return `Set ${words(e.param)} of ${partName(e.instanceId, ctx)} to ${format.number(e.value, { maximumFractionDigits: 2 })}`;
    case "set_armour_region": {
      const r = e.region;
      const slope = r.cosObliquityBp < 10_000 ? ", inclined" : "";
      const thickness = format.measurement(r.thicknessUm, "armour", { maximumFractionDigits: 0 });
      const span = format.measurement(r.lengthMm * 1000, "length", { maximumFractionDigits: 1 });
      const height = format.measurement(r.heightMm * 1000, "length", { maximumFractionDigits: 1 });
      return `Armour: set ${words(r.region)} (${thickness} ${words(r.materialId)}, ${span} × ${height}${slope})`;
    }
    case "set_armour_scheme":
      return `Armour scheme: ${words(e.schemeId)}`;
    case "set_armour_regions":
      return `Armour scheme: ${e.regions.length} region${e.regions.length === 1 ? "" : "s"}`;
    case "set_anti_aircraft":
      return e.antiAircraft === null
        ? "Remove the AA fit"
        : `AA fit: ${e.antiAircraft.lightGuns} light, ${e.antiAircraft.mediumGuns} medium, ${e.antiAircraft.directors} directors`;
    case "set_aluminium_superstructure":
      return e.fitted ? "Use an aluminium superstructure" : "Return to a steel superstructure";
    case "set_colonial_service":
      return e.fitted ? "Fit for colonial service" : "Remove the colonial-service fitting";
    case "remove_armour_region":
      return `Armour: remove ${words(e.region)}`;
  }
}

function measured(value: number, unit: string | undefined, format: PresentationFormat): string {
  switch (unit) {
    case "mm":
      return format.measurement(value * 1000, "length", { maximumFractionDigits: 1 });
    case "kg":
      return format.measurement(value, "mass", { maximumFractionDigits: 1 });
    case "kW":
      return format.measurement(value, "power", { maximumFractionDigits: 0 });
    case "bp":
      return format.percent(value, 1);
    case "‰":
      return format.percent(value * 10, 1);
    case "kn/1000":
      return `${format.number(value / 1000, { maximumFractionDigits: 1 })} kn`;
    case undefined:
      return format.number(value, { maximumFractionDigits: 0 });
    default:
      return `${format.number(value, { maximumFractionDigits: 0 })} ${unit}`;
  }
}

export function findingValue(f: BoardFinding, format: PresentationFormat): string | undefined {
  if (f.bound === undefined && f.unit === undefined) return undefined;
  const now = measured(f.value, f.unit, format);
  const limit = measured(f.limit, f.unit, format);
  if (f.bound === "min") return `Current ${now}; needs at least ${limit}`;
  if (f.bound === "max") return `Current ${now}; must not exceed ${limit}`;
  return `Value ${now}; limit ${limit}`;
}
