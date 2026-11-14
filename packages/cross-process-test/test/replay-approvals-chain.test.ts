import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  checkApprovalChain,
  checkReplayApprovals,
  formatChainFailures,
  proposeApprovals,
  recordReplay,
  type ChainStep,
  type CorpusState,
} from "../src/replay-corpus/index.js";

const RECORDED = recordReplay({ id: "approvals-two-months", seed: "approvals-test", months: 2 });
const NAME = "approvals-two-months.replay.json";
const FRESH = "brand-new.replay.json";

function perturbed(text: string, month: number, hash: string): string {
  const file = JSON.parse(text);
  file.months[month - 1].snapshotHash = hash;
  return JSON.stringify(file);
}

const hashOf = (letter: string): string => letter.repeat(64);

function unwrap<T, E extends { message: string }>(result: Result.Result<T, E>): T {
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return result.success;
}

const corpus = (replays: Record<string, string>, approvals?: string): CorpusState => ({
  replays: new Map(Object.entries(replays)),
  ...(approvals === undefined ? {} : { approvals }),
});

function approved(prev: CorpusState, replays: Record<string, string>): CorpusState {
  const head = corpus(replays, prev.approvals);
  const approvals = unwrap(
    proposeApprovals(prev, head, {
      cause: "intended rebalance",
      migrationAssessment: "none",
      changeClass: "EXPECTED_GAMEPLAY_CHANGE",
    }),
  );
  return corpus(replays, approvals);
}

const steps = (...states: readonly CorpusState[]): readonly ChainStep[] =>
  states.map((state, index) => ({ label: `c${String(index)}`, state }));

const tagsOf = (outcome: { readonly failures: readonly { readonly _tag: string }[] }) =>
  outcome.failures.map((f) => f._tag);

const A = corpus({ [NAME]: RECORDED });
const B = approved(A, { [NAME]: perturbed(RECORDED, 2, hashOf("b")) });
const C = approved(B, { [NAME]: perturbed(RECORDED, 2, hashOf("c")) });

describe("replay approvals promotion chain", () => {
  it("rejects the stacked chain with the single-base gate (the #713 case)", () => {
    const outcome = unwrap(checkReplayApprovals(A, C));
    expect(outcome.ok).toBe(false);
  });

  it("passes A to B to C with approvals A to B and B to C", () => {
    const outcome = checkApprovalChain({ main: A, steps: steps(A, B, C), head: C });
    expect(outcome).toEqual({ ok: true, failures: [] });
  });

  it("passes an empty range where the head is the chain start", () => {
    expect(checkApprovalChain({ main: A, steps: steps(A), head: A }).ok).toBe(true);
  });

  it("skips a hop whose corpus is byte-identical to the previous one", () => {
    const outcome = checkApprovalChain({ main: A, steps: steps(A, A, B, B, C), head: C });
    expect(outcome.ok).toBe(true);
  });

  it("passes a new replay that is added and then re-recorded with both entries", () => {
    const fresh = RECORDED.replace("approvals-two-months", "brand-new");
    const added = approved(A, { [NAME]: RECORDED, [FRESH]: fresh });
    const once = approved(added, { [NAME]: RECORDED, [FRESH]: perturbed(fresh, 1, hashOf("d")) });
    const twice = approved(once, { [NAME]: RECORDED, [FRESH]: perturbed(fresh, 1, hashOf("e")) });
    expect(
      checkApprovalChain({ main: A, steps: steps(A, added, once, twice), head: twice }).ok,
    ).toBe(true);
    expect(unwrap(checkReplayApprovals(A, twice)).ok).toBe(false);
  });

  it("fails UnapprovedDelta when the step that lands a delta drops its approval", () => {
    const dropped = corpus({ [NAME]: perturbed(RECORDED, 2, hashOf("b")) });
    const outcome = checkApprovalChain({ main: A, steps: steps(A, dropped), head: dropped });
    expect(outcome.ok).toBe(false);
    expect(tagsOf(outcome)).toContain("UnapprovedDelta");
    expect(outcome.failures[0]!.step).toBe("c1");
  });

  it("fails RewrittenApproval when a later step edits a consumed approval", () => {
    const entries = JSON.parse(B.approvals!);
    entries.entries[0].cause = "rewritten after the fact";
    const edited = corpus(
      { [NAME]: perturbed(RECORDED, 2, hashOf("b")) },
      `${JSON.stringify(entries)}\n`,
    );
    const outcome = checkApprovalChain({ main: A, steps: steps(A, B, edited), head: edited });
    expect(tagsOf(outcome)).toContain("RewrittenApproval");
    expect(outcome.failures.find((f) => f._tag === "RewrittenApproval")!.step).toBe("c2");
  });

  it("fails RewrittenApproval when a later step removes a consumed approval", () => {
    const removed = corpus({ [NAME]: perturbed(RECORDED, 2, hashOf("b")) });
    const outcome = checkApprovalChain({ main: A, steps: steps(A, B, removed), head: removed });
    expect(tagsOf(outcome)).toContain("RewrittenApproval");
  });

  it("fails RewrittenApproval when hops are collapsed on dev mid-chain", () => {
    const collapsed = approved(A, { [NAME]: perturbed(RECORDED, 2, hashOf("c")) });
    const outcome = checkApprovalChain({ main: A, steps: steps(A, B, collapsed), head: collapsed });
    expect(tagsOf(outcome)).toContain("RewrittenApproval");
    expect(outcome.failures[0]!.step).toBe("c2");
  });

  it("fails EndpointBinding when main changed a replay the chain start does not have", () => {
    const main = corpus({ [NAME]: perturbed(RECORDED, 1, hashOf("f")) });
    const outcome = checkApprovalChain({ main, steps: steps(A, B, C), head: C });
    expect(tagsOf(outcome)).toEqual(["EndpointBinding"]);
  });

  it("fails EndpointBinding when main's approvals differ from the chain start's", () => {
    const main = corpus({ [NAME]: RECORDED }, B.approvals);
    const outcome = checkApprovalChain({ main, steps: steps(A, B, C), head: C });
    expect(tagsOf(outcome)).toEqual(["EndpointBinding"]);
  });

  it("fails EndpointBinding when main has an extra replay", () => {
    const main = corpus({ [NAME]: RECORDED, [FRESH]: RECORDED });
    const outcome = checkApprovalChain({ main, steps: steps(A, B, C), head: C });
    expect(tagsOf(outcome)).toEqual(["EndpointBinding"]);
  });

  it("fails ChainEndMismatch when the chain end differs from the PR head", () => {
    const tampered = corpus({ [NAME]: perturbed(RECORDED, 1, hashOf("9")) }, C.approvals);
    const outcome = checkApprovalChain({ main: A, steps: steps(A, B, C), head: tampered });
    expect(tagsOf(outcome)).toEqual(["ChainEndMismatch"]);
  });

  it("fails a hop that does not decode instead of skipping it", () => {
    const broken = corpus({ [NAME]: "not json" });
    const outcome = checkApprovalChain({ main: A, steps: steps(A, broken), head: broken });
    expect(tagsOf(outcome)).toEqual(["HopRejected"]);
  });

  it("names the failing commit and the validator's line", () => {
    const dropped = corpus({ [NAME]: perturbed(RECORDED, 2, hashOf("b")) });
    const outcome = checkApprovalChain({ main: A, steps: steps(A, dropped), head: dropped });
    const text = formatChainFailures(outcome.failures);
    expect(text).toContain("c1 UnapprovedDelta approvals-two-months month 2");
  });
});
