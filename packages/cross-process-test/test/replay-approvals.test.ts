import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  approvalsCommand,
  checkReplayApprovals,
  proposeApprovals,
  recordReplay,
  type ApprovalsIo,
  type CorpusState,
} from "../src/replay-corpus/index.js";

const RECORDED = recordReplay({ id: "approvals-two-months", seed: "approvals-test", months: 2 });
const NAME = "approvals-two-months.replay.json";

function perturbed(text: string, month: number): string {
  const file = JSON.parse(text);
  file.months[month - 1].snapshotHash = "a".repeat(64);
  return JSON.stringify(file);
}

const state = (replay: string, approvals?: string): CorpusState => ({
  replays: new Map([[NAME, replay]]),
  ...(approvals === undefined ? {} : { approvals }),
});

function unwrap<T, E extends { message: string }>(result: Result.Result<T, E>): T {
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return result.success;
}

function proposed(base: CorpusState, head: CorpusState) {
  return unwrap(
    proposeApprovals(base, head, { cause: "intended rebalance", migrationAssessment: "none" }),
  );
}

const tags = (base: CorpusState, head: CorpusState) =>
  unwrap(checkReplayApprovals(base, head)).failures.map((f) => f._tag);

describe("replay approvals guard", () => {
  const base = state(RECORDED);
  const changed = state(perturbed(RECORDED, 2));

  it("passes an unchanged corpus", () => {
    expect(unwrap(checkReplayApprovals(base, base))).toEqual({ ok: true, failures: [] });
  });

  it("fails a delta that has no approval", () => {
    expect(tags(base, changed)).toEqual(["UnapprovedDelta"]);
  });

  it("passes a delta covered by a proposed approval and names the month", () => {
    const approvals = proposed(base, changed);
    expect(JSON.parse(approvals).entries).toMatchObject([
      { replayId: "approvals-two-months", month: 2, cause: "intended rebalance" },
    ]);
    expect(
      unwrap(checkReplayApprovals(base, state(changed.replays.get(NAME)!, approvals))),
    ).toEqual({ ok: true, failures: [] });
  });

  it("fails an approval whose hashes do not match the actual delta", () => {
    const approvals = JSON.parse(proposed(base, changed));
    approvals.entries[0].newHash = "b".repeat(64);
    const head = state(changed.replays.get(NAME)!, JSON.stringify(approvals));
    expect(tags(base, head)).toEqual(["HashMismatch"]);
  });

  it("fails an orphaned approval that matches no delta", () => {
    const approvals = proposed(base, changed);
    expect(tags(base, state(RECORDED, approvals))).toEqual(["OrphanedApproval"]);
  });

  it("consumes an approval: it cannot cover the same change again", () => {
    const approvals = proposed(base, changed);
    const merged = state(changed.replays.get(NAME)!, approvals);
    // Later the replay moves back and then forward again to the same checkpoint.
    const reused = unwrap(
      checkReplayApprovals(
        state(RECORDED, approvals),
        state(changed.replays.get(NAME)!, approvals),
      ),
    );
    expect(reused.failures.map((f) => f._tag)).toEqual(["ReusedApproval"]);
    // A later unrelated change is not covered either.
    const later = state(perturbed(changed.replays.get(NAME)!, 1), approvals);
    expect(tags(merged, later)).toEqual(["UnapprovedDelta"]);
  });

  it("fails a second identical entry in the same change", () => {
    const entry = JSON.parse(proposed(base, changed)).entries[0];
    const doubled = JSON.stringify({
      schema: "replay-approvals/1",
      entries: [entry, { ...entry, id: "second" }],
    });
    expect(tags(base, state(changed.replays.get(NAME)!, doubled))).toEqual(["ReusedApproval"]);
  });

  it("fails when a consumed approval is rewritten or removed", () => {
    const approvals = proposed(base, changed);
    const merged = state(changed.replays.get(NAME)!, approvals);
    expect(tags(merged, state(changed.replays.get(NAME)!, undefined))).toEqual([
      "RewrittenApproval",
    ]);
  });

  it("requires approval to remove a recorded month but not to add a new replay", () => {
    const truncated = JSON.parse(RECORDED);
    truncated.months.pop();
    expect(tags(base, state(JSON.stringify(truncated)))).toEqual(["UnapprovedDelta"]);
    const added: CorpusState = {
      replays: new Map([
        ...base.replays,
        ["new.replay.json", RECORDED.replace("approvals-two-months", "brand-new")],
      ]),
    };
    expect(unwrap(checkReplayApprovals(base, added)).ok).toBe(true);
  });

  it("rejects wildcard or blanket approvals and unknown keys at decode", () => {
    const entry = JSON.parse(proposed(base, changed)).entries[0];
    const file = (e: object) =>
      state(
        changed.replays.get(NAME)!,
        JSON.stringify({ schema: "replay-approvals/1", entries: [e] }),
      );
    expect(Result.isFailure(checkReplayApprovals(base, file({ ...entry, replayId: "*" })))).toBe(
      true,
    );
    expect(
      Result.isFailure(
        checkReplayApprovals(base, file({ ...entry, cause: "approve all changes" })),
      ),
    ).toBe(true);
    expect(Result.isFailure(checkReplayApprovals(base, file({ ...entry, extra: 1 })))).toBe(true);
    expect(
      Result.isFailure(checkReplayApprovals(base, file({ ...entry, newHash: entry.oldHash }))),
    ).toBe(true);
  });
});

describe("replay approvals tool", () => {
  const base = state(RECORDED);
  const changed = state(perturbed(RECORDED, 1));

  function io(): ApprovalsIo & { written: string[] } {
    const written: string[] = [];
    return {
      written,
      readBase: () => base,
      readHead: () => ({ replays: changed.replays, approvals: written.at(-1) }),
      writeApprovals: (text) => void written.push(text),
      print: () => undefined,
    };
  }

  const propose = ["propose", "--cause", "why", "--migration", "none"];

  it("writes an entry from the real diff locally", () => {
    const sink = io();
    expect(approvalsCommand(propose, {}, sink)).toBe(0);
    expect(JSON.parse(sink.written[0]!).entries).toHaveLength(1);
    expect(approvalsCommand(["check"], {}, sink)).toBe(0);
  });

  it("refuses to write in CI", () => {
    const sink = io();
    expect(approvalsCommand(propose, { CI: "true" }, sink)).toBe(2);
    expect(sink.written).toEqual([]);
  });

  it("requires a cause and a migration assessment", () => {
    const sink = io();
    expect(approvalsCommand(["propose"], {}, sink)).toBe(2);
    expect(sink.written).toEqual([]);
  });

  it("check exits non-zero on an unapproved delta, also in CI", () => {
    expect(approvalsCommand(["check"], { CI: "true" }, io())).toBe(1);
  });
});
