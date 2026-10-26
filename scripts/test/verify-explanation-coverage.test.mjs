import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateCoverage,
  scanContracts,
  validateManifest,
} from "../verify-explanation-coverage.mjs";

const source = `
export interface SampleView {
  readonly name: string;
  readonly cost: number;
  readonly crewQuality?: SafeInt;
  readonly accuracy?: ExplanationTree;
  readonly month: { readonly month: number; readonly year: number };
  readonly nested: {
    readonly value: number;
  };
}
`;

const manifest = (overrides = {}) => ({
  version: 1,
  minimumCoveredPercentBp: 0,
  contracts: [
    {
      file: "sample.ts",
      type: "SampleView",
      area: "sample",
      issue: "#1",
      covered: { accuracy: "sample_accuracy" },
      exempt: {
        cost: "direct state value",
        crewQuality: "direct state value",
        "month.month": "calendar value",
        "month.year": "calendar value",
        "nested.value": "direct state value",
      },
      ...overrides,
    },
  ],
});

void describe("scanContracts", () => {
  void it("finds numeric, explanation and nested numeric fields", () => {
    const fields = scanContracts(source).get("SampleView");
    assert.deepEqual(
      fields.map((field) => `${field.kind}:${field.name}`),
      [
        "number:SampleView.cost",
        "number:SampleView.crewQuality",
        "explanation:SampleView.accuracy",
        "number:SampleView.month.month",
        "number:SampleView.month.year",
        "number:SampleView.nested.value",
      ],
    );
  });

  void it("scans a type alias with an object literal body", () => {
    const text = `
type Other = {
  readonly label: string;
  readonly value: number;
};
`;
    const fields = scanContracts(text).get("Other");
    assert.deepEqual(fields, [{ name: "Other.value", kind: "number" }]);
  });
});

void describe("evaluateCoverage", () => {
  void it("passes when every field is covered or exempt", () => {
    const result = evaluateCoverage(manifest(), () => source);
    assert.deepEqual(result.problems, []);
    assert.equal(result.covered, 1);
    assert.equal(result.exempt, 5);
    assert.equal(result.total, 6);
  });

  void it("fails when a numeric field has no explanation or exemption", () => {
    const incomplete = manifest();
    delete incomplete.contracts[0].exempt.cost;
    const result = evaluateCoverage(incomplete, () => source);
    assert.equal(result.problems.length, 1);
    assert.match(result.problems[0], /cost/);
  });

  void it("fails on stale covered and exempt fields", () => {
    const stale = manifest();
    stale.contracts[0].exempt.removed = "gone";
    stale.contracts[0].covered.missing = "missing_formula";
    const result = evaluateCoverage(stale, () => source);
    assert.ok(result.problems.some((problem) => problem.includes("stale exempt field")));
    assert.ok(result.problems.some((problem) => problem.includes("stale covered field")));
  });

  void it("fails when a covered field is not an ExplanationTree", () => {
    const wrong = manifest();
    wrong.contracts[0].covered.cost = "cost_formula";
    const result = evaluateCoverage(wrong, () => source);
    assert.ok(result.problems.some((problem) => problem.includes("is not an ExplanationTree")));
  });

  void it("fails when the covered percentage drops below the ratchet", () => {
    const ratchet = manifest();
    ratchet.minimumCoveredPercentBp = 5000;
    const result = evaluateCoverage(ratchet, () => source);
    assert.ok(result.problems.some((problem) => problem.includes("coverage dropped")));
  });

  void it("fails when a listed contract is missing", () => {
    const missing = manifest({ type: "MissingView" });
    const result = evaluateCoverage(missing, () => source);
    assert.ok(result.problems.some((problem) => problem.includes('contract type "MissingView"')));
  });
});

void describe("validateManifest", () => {
  void it("accepts the committed shape", () => {
    assert.deepEqual(validateManifest(manifest()), []);
  });

  void it("rejects unknown keys and empty exemption reasons", () => {
    const invalid = manifest({ extra: true });
    invalid.contracts[0].exempt.cost = "";
    const problems = validateManifest(invalid);
    assert.ok(problems.some((problem) => problem.includes('unknown key "extra"')));
    assert.ok(problems.some((problem) => problem.includes('exempt["cost"]')));
  });

  void it("rejects duplicate contracts", () => {
    const duplicate = manifest();
    duplicate.contracts.push(structuredClone(duplicate.contracts[0]));
    assert.ok(
      validateManifest(duplicate).some((problem) => problem.includes("duplicate contract")),
    );
  });
});
