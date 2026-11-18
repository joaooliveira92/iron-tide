import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  checkReplayApprovals,
  mergeApprovalFiles,
  proposeApprovalFile,
  recordReplay,
  type CorpusState,
} from "../src/replay-corpus/index.js";

const RECORDED = recordReplay({ id: "approval-files-two-months", seed: "files-test", months: 2 });
const NAME = "approval-files-two-months.replay.json";

function perturbed(text: string, month: number, hash: string): string {
  const file = JSON.parse(text);
  file.months[month - 1].snapshotHash = hash;
  return JSON.stringify(file);
}

function unwrap<T, E extends { message: string }>(result: Result.Result<T, E>): T {
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return result.success;
}

const state = (replay: string, approvals?: string): CorpusState => ({
  replays: new Map([[NAME, replay]]),
  ...(approvals === undefined ? {} : { approvals }),
});

const input = {
  cause: "intended rebalance",
  migrationAssessment: "none",
  changeClass: "EXPECTED_GAMEPLAY_CHANGE",
} as const;

const entriesOf = (text: string | undefined): readonly { readonly id: string }[] =>
  text === undefined ? [] : JSON.parse(text).entries;

describe("per-approval files", () => {
  const base = state(RECORDED);
  const first = state(perturbed(RECORDED, 1, "a".repeat(64)));

  it("proposes a file holding only the new entries, named from its content", () => {
    const proposal = unwrap(proposeApprovalFile(base, first, input));
    expect(proposal).toBeDefined();
    expect(proposal!.name).toMatch(/^[0-9a-f]{12}\.json$/);
    expect(entriesOf(proposal!.text)).toHaveLength(1);
    const again = unwrap(proposeApprovalFile(base, first, input));
    expect(again).toEqual(proposal);
  });

  it("proposes nothing once every delta has an entry", () => {
    const proposal = unwrap(proposeApprovalFile(base, first, input))!;
    const merged = unwrap(mergeApprovalFiles(new Map([[proposal.name, proposal.text]])));
    expect(unwrap(proposeApprovalFile(base, state(first.replays.get(NAME)!, merged), input))).toBe(
      undefined,
    );
  });

  it("merges files in name order into one approvals text the guard accepts", () => {
    const one = unwrap(proposeApprovalFile(base, first, input))!;
    const second = state(perturbed(first.replays.get(NAME)!, 2, "b".repeat(64)));
    const afterOne = state(
      second.replays.get(NAME)!,
      unwrap(mergeApprovalFiles(new Map([[one.name, one.text]]))),
    );
    const two = unwrap(proposeApprovalFile(base, afterOne, input))!;
    expect(entriesOf(two.text)).toHaveLength(1);

    const files = new Map([
      [two.name, two.text],
      [one.name, one.text],
    ]);
    const merged = unwrap(mergeApprovalFiles(files));
    const reversed = unwrap(mergeApprovalFiles(new Map([...files].reverse())));
    expect(merged).toBe(reversed);
    expect(entriesOf(merged)).toHaveLength(2);
    expect(unwrap(checkReplayApprovals(base, state(second.replays.get(NAME)!, merged))).ok).toBe(
      true,
    );
  });

  it("two PRs that each add an approval merge without touching a shared file", () => {
    const left = unwrap(proposeApprovalFile(base, first, input))!;
    const rightHead = state(perturbed(RECORDED, 2, "c".repeat(64)));
    const right = unwrap(proposeApprovalFile(base, rightHead, input))!;
    expect(left.name).not.toBe(right.name);
  });

  it("returns undefined for no files and rejects a duplicate id across files", () => {
    expect(unwrap(mergeApprovalFiles(new Map()))).toBeUndefined();
    const one = unwrap(proposeApprovalFile(base, first, input))!;
    const result = mergeApprovalFiles(
      new Map([
        ["a.json", one.text],
        ["b.json", one.text],
      ]),
    );
    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects a file that is not valid approvals JSON", () => {
    expect(Result.isFailure(mergeApprovalFiles(new Map([["a.json", "{"]])))).toBe(true);
  });
});
