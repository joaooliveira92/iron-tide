import { describe, expect, it } from "vite-plus/test";
import { ValidateStage } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { ParseOutput } from "../src/stages/parse.js";

// S-5 04 (#78, spec #73 R11): the optional S-5 ruleset section. Absent = dormant; present it is all-or-nothing and
// strict. Every number here is a FIXTURE-CLASS value for exercising the decoder, never a production value.
const FIXTURE_PROVENANCE = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "Fixture-class value for tests only.",
};

const ruleset = (presence?: unknown): Record<string, unknown> => ({
  id: "core",
  name: "Core",
  version: "1.0",
  ...(presence === undefined ? {} : { presence }),
});

function validate(rulesets: unknown[]): DiagnosticCollector {
  const input: ParseOutput = {
    manifest: { name: "test-pack", version: "0.1.0", type: "fixture", files: {} },
    collectionDocs: new Map<string, unknown[]>([["rulesets", rulesets]]),
    sourcePaths: new Map(),
    objectDocs: new Map(),
    objectSourcePaths: new Map(),
    contentDir: ".",
  };
  const collector = new DiagnosticCollector();
  new ValidateStage().run(input, new AbortController().signal, collector);
  return collector;
}

const codes = (c: DiagnosticCollector): string[] => c.all.map((d) => d.code as string);

describe("S-5 presence ruleset section", () => {
  it("is dormant when absent: no diagnostic", () => {
    expect(codes(validate([ruleset()]))).not.toContain("PRESENCE_RULES_INVALID");
  });

  it("accepts a complete section", () => {
    const c = validate([
      ruleset({ colonialServiceDisplacementBp: 137, provenance: FIXTURE_PROVENANCE }),
    ]);
    expect(c.hasErrors).toBe(false);
  });

  it("rejects a partial section with a named diagnostic that names the missing field", () => {
    const d = validate([ruleset({ provenance: FIXTURE_PROVENANCE })]).all.find(
      (x) => x.code === "PRESENCE_RULES_INVALID",
    );
    expect(d?.severity).toBe("error");
    expect(d?.entityId).toBe("core");
    expect(d?.message).toContain("colonialServiceDisplacementBp");
  });

  it("rejects an empty section and a section with no provenance", () => {
    expect(codes(validate([ruleset({})]))).toContain("PRESENCE_RULES_INVALID");
    expect(codes(validate([ruleset({ colonialServiceDisplacementBp: 137 })]))).toContain(
      "PRESENCE_RULES_INVALID",
    );
  });

  it("rejects two rulesets that both carry a section: it is never guessed which one applies", () => {
    const section = { colonialServiceDisplacementBp: 137, provenance: FIXTURE_PROVENANCE };
    const c = validate([ruleset(section), { ...ruleset(section), id: "other" }]);
    expect(codes(c)).toContain("PRESENCE_RULES_AMBIGUOUS");
  });

  it("rejects an excess key, a non-integer and an out-of-range proportion", () => {
    const bad = (extra: Record<string, unknown>): string[] =>
      codes(
        validate([
          ruleset({
            colonialServiceDisplacementBp: 137,
            provenance: FIXTURE_PROVENANCE,
            ...extra,
          }),
        ]),
      );
    expect(bad({ surprise: 1 })).toContain("PRESENCE_RULES_INVALID");
    for (const value of [0, 10_000, -5, 1.5]) {
      expect(
        codes(
          validate([
            ruleset({ colonialServiceDisplacementBp: value, provenance: FIXTURE_PROVENANCE }),
          ]),
        ),
      ).toContain("PRESENCE_RULES_INVALID");
    }
  });
});
