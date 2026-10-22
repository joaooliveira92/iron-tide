import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import { compileDesign, findingKey, type DesignDraft, type Finding } from "../src/index.js";
import { KNOWN_RULES, withRuleSubject } from "../src/findingSubjects.js";
import { verifyCompiledHash } from "../src/persistence.js";
import { withoutSubjects } from "../src/findings.js";
import { earlyContext } from "./helpers/earlyContext.js";
import { havock, majestic } from "./helpers/references.js";

const ctx = earlyContext("1893-06");
const compile = (d: DesignDraft) => compileDesign(d, ctx);
const outOfZone: DesignDraft = {
  ...havock,
  placements: havock.placements.map((p) =>
    p.instanceId === "gun_12pdr" ? { ...p, stationPermille: 500 } : p,
  ),
};

describe("structured finding subjects", () => {
  it("names the placement and zone of a station outside its zone, without reading the message", () => {
    const f = compile(outOfZone).findings.find((x) => x.id === "ARR-STATION-OUT-OF-ZONE")!;
    expect(f.subject).toEqual({
      targets: [
        { kind: "placement", instanceId: "gun_12pdr" },
        { kind: "zone", zoneId: "FORECASTLE" },
      ],
      settings: "arrangement",
      unit: "‰",
    });
  });

  it("names each uncontrolled gun of a fire-control finding", () => {
    const f = compile(havock).findings.find((x) => x.id === "FC_INCOMPATIBLE")!;
    expect(
      f.subject?.targets.map((t) => (t.kind === "placement" ? t.instanceId : t.kind)).sort(),
    ).toEqual(["gun_12pdr", "gun_6pdr_a", "gun_6pdr_b"]);
    expect(f.subject?.bound).toBe("max");
  });

  it("names the magazine of a magazine-protection finding", () => {
    const f = compile(havock).findings.find((x) => x.id === "MAGAZINE_UNPROTECTED")!;
    expect(f.subject?.targets[0]).toMatchObject({ kind: "placement" });
    expect(f.subject?.settings).toBe("armour");
  });

  it("makes ship-level rules about the whole ship, with where to change them", () => {
    for (const f of compile(majestic).findings.filter(
      (x) => x.subject?.targets[0]?.kind === "ship",
    ))
      expect(f.subject?.settings).toBeDefined();
    expect(compile(majestic).findings.some((x) => x.subject?.targets[0]?.kind === "ship")).toBe(
      true,
    );
  });

  it("covers every rule the reference designs raise", () => {
    for (const d of [havock, majestic, outOfZone])
      for (const f of compile(d).findings) {
        expect(KNOWN_RULES).toContain(f.id);
        expect(f.subject?.targets.length).toBeGreaterThan(0);
      }
  });

  it("leaves an unknown rule unchanged rather than inventing a target", () => {
    const f: Finding = {
      id: "NOT_A_RULE",
      severity: "WARNING",
      what: "w",
      why: "y",
      consequence: "c",
      remedies: [],
      evidence: { formulaId: "X", inputs: {}, threshold: 0, value: 1 },
    };
    expect(withRuleSubject(f)).toBe(f);
  });
});

describe("finding identity", () => {
  it("depends on rule and targets, not wording, values or severity", () => {
    const f = compile(outOfZone).findings.find((x) => x.id === "ARR-STATION-OUT-OF-ZONE")!;
    const reworded = {
      ...f,
      what: "Completely different words.",
      severity: "WARNING" as const,
      evidence: { ...f.evidence, value: 999 },
    };
    expect(findingKey(reworded)).toBe(findingKey(f));
    expect(findingKey(f)).toBe("ARR-STATION-OUT-OF-ZONE|placement:gun_12pdr,zone:FORECASTLE");
  });

  it("distinguishes the same rule failing for different entities", () => {
    const keys = compile(havock)
      .findings.filter((x) => x.id === "MAGAZINE_UNPROTECTED")
      .map(findingKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("design hash", () => {
  it("does not cover finding subjects", () => {
    const c = compile(outOfZone);
    const { hash, ...body } = c;
    expect(sha256Hex(canonicalSerialize(withoutSubjects(body)))).toBe(hash);
    expect(verifyCompiledHash(c)).toBe(true);
    expect(verifyCompiledHash({ ...withoutSubjects(body), hash } as typeof c)).toBe(true);
  });
});
