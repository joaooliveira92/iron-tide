import type { CompiledDesign, DesignDraft } from "./compile.js";
import {
  classPredicates,
  classRuleFailures,
  CLASSIFIED_SHIP_TYPES,
  DESIGN_22_EARLY,
  type ClassFacts,
  type ClassificationRules,
  type ClassifiedShipType,
  type ClassRuleField,
} from "./classificationRules.js";
import { shipTarget, type Finding, type SettingGroup } from "./findings.js";
import { UM_PER_KNOT } from "./units.js";

export * from "./classificationRules.js";

/** Which group of design settings fixes a rule of each field (the UI maps a group to its controls). */
const FIELD_SETTING: Readonly<Record<ClassRuleField, SettingGroup>> = {
  displacement: "hull",
  speed: "machinery",
  belt: "armour",
  qualifyingArmour: "armour",
  mainGun: "arrangement",
  turrets: "arrangement",
  torpedoes: "arrangement",
  aircraft: "arrangement",
  hull: "hull",
};

const GUN_CATEGORIES: readonly string[] = ["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN"];

/** Reads the facts out of a compiled design. Main-gun turret count is the number of main-gun mounts fitted. */
export function classFacts(
  c: Pick<CompiledDesign, "totalKg" | "machinery" | "components">,
  d: DesignDraft,
  rules: Pick<ClassificationRules, "clMaxGunUm"> = DESIGN_22_EARLY,
  merchantHull = false,
): ClassFacts {
  const beltRegions = d.armour.regions.filter((r) => r.region === "BELT_MAIN");
  const guns = c.components.filter((k) => k.category === "MAIN_GUN");
  return {
    displacementKg: c.totalKg,
    speedUms: Math.floor(((c.machinery?.maxSpeedMilliKnots ?? 0) * UM_PER_KNOT) / 1000),
    beltUm: beltRegions.reduce((m, r) => Math.max(m, r.thicknessUm), 0),
    anyQualifyingArmourUm: d.armour.regions
      .filter((r) =>
        [
          "BELT_MAIN",
          "BELT_UPPER",
          "BELT_ENDS",
          "DECK_MAIN",
          "DECK_SLOPE",
          "DECK_EXTENDED",
          "TURRET",
          "TURRET_TOP",
          "SECONDARY_GUN",
          "CONNING_TOWER",
          "MAGAZINE_BOX",
        ].includes(r.region),
      )
      .reduce((m, r) => Math.max(m, r.thicknessUm), 0),
    maxMainGunUm: guns.reduce((m, k) => Math.max(m, k.attr.caliberUm ?? 0), 0),
    maxGunUm: c.components
      .filter((k) => GUN_CATEGORIES.includes(k.category))
      .reduce((m, k) => Math.max(m, k.attr.caliberUm ?? 0), 0),
    mainTurretCount: guns.length,
    torpedoTubes: c.components
      .filter((k) => k.category === "TORPEDO_TUBE")
      .reduce((a, k) => a + (k.params.tubes ?? 1), 0),
    aircraftCapacity: 0,
    deckUm: d.armour.regions
      .filter((r) => r.region === "DECK_MAIN" || r.region === "DECK_SLOPE")
      .reduce((m, r) => Math.max(m, r.thicknessUm), 0),
    maxHeavyMountBarrels: guns
      .filter((k) => (k.attr.caliberUm ?? 0) > rules.clMaxGunUm)
      .reduce((m, k) => Math.max(m, k.params.barrels ?? 1), 0),
    merchantHull,
  };
}

/**
 * First type, in precedence order, whose predicates all pass; null if none. `order` comes from the
 * compiled ship-type registry when content supplies it; absent means the code-owned
 * `CLASSIFIED_SHIP_TYPES` order (the 12a regression pins the two equal). The predicate functions
 * themselves are always the closed code record `classPredicates`.
 */
export function naturalClass(
  f: ClassFacts,
  r: ClassificationRules,
  order: readonly ClassifiedShipType[] = CLASSIFIED_SHIP_TYPES,
): ClassifiedShipType | null {
  for (const t of order) if (classPredicates[t](f, r).length === 0) return t;
  return null;
}

/** DESIGN-22 section 5 mismatch policy. All three rejections are BLOCKING (DESIGN-21 section 25). */
export function classificationFindings(
  f: ClassFacts,
  intended: ClassifiedShipType,
  r: ClassificationRules,
  order?: readonly ClassifiedShipType[],
): { natural: ClassifiedShipType | null; findings: Finding[] } {
  const ruleFailures = classRuleFailures[intended](f, r);
  const failures = ruleFailures.map((x) => x.message);
  const natural = naturalClass(f, r, order);
  const ev = (value: number): Finding["evidence"] => ({
    formulaId: "DESIGN-22",
    inputs: {
      displacementKg: f.displacementKg,
      speedUms: f.speedUms,
      beltUm: f.beltUm,
      maxMainGunUm: f.maxMainGunUm,
    },
    threshold: 0,
    value,
  });
  const remedies = (extra: string): Finding["remedies"] => [
    {
      id: "change_intended",
      description: `Declare the type the ship actually is${natural ? ` (${natural})` : ""}.`,
    },
    { id: "adjust_design", description: extra },
    { id: "check_rules", description: "Review the DESIGN-22 boundaries for this type." },
  ];
  if (failures.length > 0) {
    return {
      natural,
      findings: [
        {
          id: "INTENDED_CLASSIFICATION_ILLEGAL",
          severity: "BLOCKING",
          what: `The design does not qualify as ${intended}.`,
          why: failures.join("; ") + ".",
          consequence:
            "The ship cannot be built under this classification; treaty, AI-role and battle-role rules all depend on it.",
          remedies: remedies(
            "Change displacement, speed, armour or armament until every rule for the intended type passes.",
          ),
          evidence: ev(failures.length),
        },
        // One finding per failed rule, so each reads next to the control that fixes it.
        ...ruleFailures.map((x): Finding => ({
          id: x.code,
          severity: "BLOCKING",
          what: `${intended}: ${x.message}.`,
          why: `The design fails the ${intended} rule on ${x.field}.`,
          consequence: `The ship cannot be built as ${intended} until this rule passes.`,
          remedies: [
            {
              id: "adjust_design",
              description: x.suggestion ?? "Change the design until this rule passes.",
            },
            {
              id: "change_intended",
              description: `Declare the type the ship actually is${natural ? ` (${natural})` : ""}.`,
            },
            { id: "check_rules", description: "Review the DESIGN-22 boundaries for this type." },
          ],
          evidence: ev(1),
          subject: { targets: [shipTarget], settings: FIELD_SETTING[x.field] },
        })),
      ],
    };
  }
  if (natural === null) {
    return {
      natural,
      findings: [
        {
          id: "NO_NATURAL_CLASSIFICATION_MATCH",
          severity: "BLOCKING",
          what: "The design matches no ship type.",
          why: "No registered type accepts this design.",
          consequence: "It cannot be classified.",
          remedies: remedies("Bring the design inside one type's boundaries."),
          evidence: ev(0),
        },
      ],
    };
  }
  if (natural !== intended) {
    return {
      natural,
      findings: [
        {
          id: "NATURAL_CLASSIFICATION_MISMATCH",
          severity: "BLOCKING",
          what: `The design qualifies as ${intended} but is naturally ${natural}.`,
          why: `Precedence gives ${natural} for these specifications.`,
          consequence:
            "A different type would govern treaty and battle roles than the one declared.",
          remedies: remedies(`Adjust the design so that ${intended} wins by precedence.`),
          evidence: ev(1),
        },
      ],
    };
  }
  return { natural, findings: [] };
}

/**
 * The class code shown beside the ship type: the type, then the number of main-gun mounts and the most barrels in a mount
 * of the largest main calibre, e.g. `BB4X2`. A design with no main guns is just its type. Pure; mounts are read from the
 * compiled components (MAIN_GUN category, `caliberUm` attribute, `barrels` parameter, default 1).
 */
export function classCode(
  type: string,
  components: readonly Pick<CompiledDesign["components"][number], "category" | "attr" | "params">[],
): string {
  const guns = components.filter((k) => k.category === "MAIN_GUN");
  if (guns.length === 0) return type;
  const largest = guns.reduce((m, k) => Math.max(m, k.attr.caliberUm ?? 0), 0);
  const barrels = guns
    .filter((k) => (k.attr.caliberUm ?? 0) === largest)
    .reduce((m, k) => Math.max(m, k.params.barrels ?? 1), 1);
  return `${type}${guns.length}X${barrels}`;
}

/**
 * The blocking finding ids `classificationFindings` emits when the shipped DESIGN-22 section 5 mismatch policy
 * rejects a design: the intended type is illegal, the natural type differs, or no natural type matches. A rebuild
 * completion re-runs classification and refuses on any of these (DESIGN-22 section 22).
 */
export const CLASSIFICATION_REJECTION_IDS: readonly string[] = [
  "INTENDED_CLASSIFICATION_ILLEGAL",
  "NATURAL_CLASSIFICATION_MISMATCH",
  "NO_NATURAL_CLASSIFICATION_MATCH",
];

/**
 * True when compiled-design findings carry a blocking intended/natural classification rejection. Callers that
 * re-run classification (e.g. a completed rebuild, DESIGN-22 section 22) use this to tell a classification
 * failure from an unrelated blocking finding.
 */
export function classificationRejected(findings: readonly Finding[]): boolean {
  return findings.some(
    (f) => f.severity === "BLOCKING" && CLASSIFICATION_REJECTION_IDS.includes(f.id),
  );
}

/**
 * Non-blocking guidance for a design that passes its intended type: a WARNING is a real weakness the player should
 * weigh, an ADVISORY is context. Neither can make a design unbuildable (ADR-0088).
 */
export function typeAdvisories(intended: ClassifiedShipType, f: ClassFacts): Finding[] {
  const note = (
    id: string,
    severity: "WARNING" | "ADVISORY",
    what: string,
    why: string,
    consequence: string,
    settings: SettingGroup,
    remedies: Finding["remedies"] = [],
  ): Finding => ({
    id,
    severity,
    what,
    why,
    consequence,
    remedies,
    evidence: { formulaId: "DESIGN-22", inputs: {}, threshold: 0, value: 0 },
    subject: { targets: [shipTarget], settings },
  });
  const out: Finding[] = [];
  if (intended === "CL" && f.deckUm === 0)
    out.push(
      note(
        "CL_ARMOUR_DECK_MISSING",
        "WARNING",
        "This cruiser has no armour deck.",
        "A protected cruiser relies on an armoured deck over its machinery and magazines; this design has none.",
        "It is a cruiser in name only: any shell that reaches the machinery spaces is not stopped.",
        "armour",
        [
          { id: "add_deck", description: "Add an armoured deck over the machinery and magazines." },
          { id: "accept", description: "Accept it for a cheap scout or dispatch vessel." },
        ],
      ),
    );
  if (intended === "AMC")
    out.push(
      note(
        "AMC_AUXILIARY_STATUS",
        "ADVISORY",
        "An armed merchant cruiser is an auxiliary.",
        "It is a merchant hull with a light armament, built as a special project.",
        "It counts against the armed-merchant-cruiser fleet limit, is valued as an auxiliary in battle and does not serve in the battle line.",
        "brief",
      ),
    );
  return out;
}
