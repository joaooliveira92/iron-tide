import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import { Result, Schema } from "effect";
import { formatContractIssues } from "../src/schema-issues.js";
import { validateAirDefenseSystemDefinition } from "../src/air-defense/index.js";

const strict = { onExcessProperty: "error" } as const;

function issuesOf(
  schema: Schema.ConstraintDecoder<unknown, never>,
  value: unknown,
  options?: object,
) {
  const result = Schema.decodeUnknownResult(schema, options as never)(value);
  if (Result.isSuccess(result)) {
    throw new Error("expected decode failure");
  }
  return formatContractIssues(result.failure);
}

const Sample = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  nested: Schema.Struct({ x: Schema.String }),
  list: Schema.Array(Schema.String),
});

describe("formatContractIssues", () => {
  it("reports a top-level field path", () => {
    const issues = issuesOf(Schema.Struct({ name: Schema.String }), { name: 1 });
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("name");
    expect(issues[0].message).toContain("string");
  });

  it("reports a nested field path with `.` joining", () => {
    const issues = issuesOf(Sample, { name: "ok", nested: { x: 1 }, list: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("nested.x");
  });

  it("reports an array/tuple index in the path", () => {
    const issues = issuesOf(Sample, { name: "ok", nested: { x: "ok" }, list: ["ok", 1] });
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("list.1");
  });

  it("reports a missing property with its path", () => {
    const issues = issuesOf(Sample, { name: "ok", nested: {}, list: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("nested.x");
    expect(issues[0].message).toBe("Missing key");
  });

  it("reports a refinement failure with the field path and refinement message", () => {
    const issues = issuesOf(Sample, { name: "", nested: { x: "ok" }, list: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("name");
    expect(issues[0].message).toContain("length of at least 1");
  });

  it("collects every issue in deterministic field order when errors: 'all'", () => {
    const issues = issuesOf(
      Sample,
      { name: 1, nested: { x: 1 }, list: [1] },
      { ...strict, errors: "all" },
    );
    expect(issues.map((issue) => issue.path)).toEqual(["name", "nested.x", "list.0"]);
  });

  it("reports an excess property by name when onExcessProperty: 'error'", () => {
    const issues = issuesOf(
      Sample,
      { name: "ok", nested: { x: "ok" }, list: [], extra: 1 },
      strict,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("extra");
  });

  it("returns a stable { path, message } shape", () => {
    const issues = issuesOf(
      Sample,
      { name: 1, nested: { x: 1 }, list: [] },
      {
        errors: "all",
      },
    );
    for (const issue of issues) {
      expect(Object.keys(issue).sort()).toEqual(["message", "path"]);
      expect(typeof issue.path).toBe("string");
      expect(typeof issue.message).toBe("string");
    }
  });

  it("feeds the BluewaveError contract with the mapped { path, message } entries", () => {
    let caught: unknown;
    try {
      validateAirDefenseSystemDefinition({ systemId: 123 });
    } catch (error) {
      caught = error;
    }
    expect(isBluewaveError(caught)).toBe(true);
    const context = (caught as BluewaveError).context as {
      errors?: ReadonlyArray<{ path: string; message: string }>;
    };
    expect(Array.isArray(context.errors)).toBe(true);
    expect(context.errors?.[0]?.path).toBe("systemId");
    expect(typeof context.errors?.[0]?.message).toBe("string");
  });
});
