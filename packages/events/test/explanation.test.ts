import { describe, expect, it } from "vite-plus/test";
import { ExplanationBuilder, formatExplanation } from "../src/index.js";

describe("ExplanationBuilder", () => {
  it("builds a deeply immutable snapshot", () => {
    const child = new ExplanationBuilder("child", "1").withResult(2).build();
    const tree = new ExplanationBuilder("total", "1")
      .withInput("b", 2)
      .withInput("a", 1)
      .withIntermediate("sum", 3)
      .withResult(3)
      .withUnit("points")
      .addChild(child)
      .build();

    expect(Object.isFrozen(tree)).toBe(true);
    expect(Object.isFrozen(tree.inputs)).toBe(true);
    expect(Object.isFrozen(tree.children)).toBe(true);
  });

  it("does not mutate an earlier build when the builder changes", () => {
    const builder = new ExplanationBuilder("formula", "1").withInput("value", 1);
    const first = builder.build();
    builder.withInput("value", 2);
    expect(first.inputs.value).toBe(1);
  });

  it("formats keys deterministically", () => {
    const tree = new ExplanationBuilder("formula", "1")
      .withInput("z", 2)
      .withInput("a", 1)
      .withResult(3)
      .build();
    expect(formatExplanation(tree)).toBe("formula v1 = 3\n  inputs:\n    a = 1\n    z = 2");
  });

  it("rejects non-finite numeric values", () => {
    expect(() => new ExplanationBuilder("formula", "1").withResult(Number.NaN)).toThrow(/finite/);
  });
});
