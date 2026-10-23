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
    proposeApprovals(base, head, {
      cause: "intended rebalance",
      migrationAssessment: "none",
      changeClass: "EXPECTED_GAMEPLAY_CHANGE",
    }),
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
    const reused = unwrap(
      checkReplayApprovals(
        state(RECORDED, approvals),
        state(changed.replays.get(NAME)!, approvals),
      ),
    );
    expect(reused.failures.map((f) => f._tag)).toEqual(["ReusedApproval"]);
    const later = state(perturbed(changed.replays.get(NAME)!, 1), approvals);
    expect(tags(merged, later)).toEqual(["UnapprovedDelta"]);
  });

  it("fails a second identical entry in the same change", () => {
    const entry = JSON.parse(proposed(base, changed)).entries[0];
    const doubled = JSON.stringify({
      schema: "replay-approvals/2",
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
        JSON.stringify({ schema: "replay-approvals/2", entries: [e] }),
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

  const propose = [
    "propose",
    "--cause",
    "why",
    "--migration",
    "none",
    "--class",
    "EXPECTED_GAMEPLAY_CHANGE",
  ];

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

  it("requires a known change class", () => {
    const sink = io();
    const withoutClass = propose.slice(0, -2);
    expect(approvalsCommand(withoutClass, {}, sink)).toBe(2);
    expect(approvalsCommand([...withoutClass, "--class", "WHATEVER"], {}, sink)).toBe(2);
    expect(sink.written).toEqual([]);
  });

  it("check exits non-zero on an unapproved delta, also in CI", () => {
    expect(approvalsCommand(["check"], { CI: "true" }, io())).toBe(1);
  });
});

function edited(text: string, edit: (file: any) => void): string {
  const file = JSON.parse(text);
  edit(file);
  return JSON.stringify(file);
}

describe("replay approvals change class", () => {
  const base = state(RECORDED);
  const propose = (head: CorpusState, changeClass: string) =>
    proposeApprovals(base, head, {
      cause: "intended rebalance",
      migrationAssessment: "none",
      changeClass: changeClass as never,
    });
  const verdict = (head: CorpusState, changeClass: string) => {
    const approvals = unwrap(propose(head, changeClass));
    return unwrap(checkReplayApprovals(base, { replays: head.replays, approvals })).failures.map(
      (f) => f._tag,
    );
  };

  const gameplay = state(perturbed(RECORDED, 2));
  const rulesetBump = state(
    edited(perturbed(RECORDED, 2), (file) => {
      file.rulesetVersion = `${file.rulesetVersion}-next`;
    }),
  );
  const extraLedgerEntry = state(
    edited(RECORDED, (file) => {
      const ledger = file.months[1].ledgers.financial;
      ledger.entryHashes.push("c".repeat(64));
      ledger.count += 1;
    }),
  );

  it("records the class on the entry", () => {
    const entry = JSON.parse(unwrap(propose(gameplay, "EXPECTED_GAMEPLAY_CHANGE"))).entries[0];
    expect(entry.changeClass).toBe("EXPECTED_GAMEPLAY_CHANGE");
  });

  it("accepts a gameplay change without further evidence", () => {
    expect(verdict(gameplay, "EXPECTED_GAMEPLAY_CHANGE")).toEqual([]);
  });

  it("accepts a ruleset version change when the replay's ruleset version moved", () => {
    expect(verdict(rulesetBump, "RULESET_VERSION_CHANGE")).toEqual([]);
  });

  it("rejects a ruleset version change claimed while the ruleset version is unchanged", () => {
    expect(verdict(gameplay, "RULESET_VERSION_CHANGE")).toEqual(["ClassMismatch"]);
  });

  it("accepts a serialization-only change when no ledger count moved", () => {
    expect(verdict(gameplay, "SERIALIZATION_ONLY")).toEqual([]);
  });

  it("rejects a serialization-only claim when a ledger gained an entry", () => {
    expect(verdict(extraLedgerEntry, "SERIALIZATION_ONLY")).toEqual(["ClassMismatch"]);
  });

  it("rejects a serialization-only claim when the ruleset version moved", () => {
    expect(verdict(rulesetBump, "SERIALIZATION_ONLY")).toEqual(["ClassMismatch"]);
  });

  it("rejects an entry without a class and an unknown class at decode", () => {
    const entry = JSON.parse(unwrap(propose(gameplay, "EXPECTED_GAMEPLAY_CHANGE"))).entries[0];
    const file = (e: object) =>
      state(
        gameplay.replays.get(NAME)!,
        JSON.stringify({ schema: "replay-approvals/2", entries: [e] }),
      );
    const { changeClass: _removed, ...withoutClass } = entry;
    expect(Result.isFailure(checkReplayApprovals(base, file(withoutClass)))).toBe(true);
    expect(
      Result.isFailure(checkReplayApprovals(base, file({ ...entry, changeClass: "UNEXPECTED" }))),
    ).toBe(true);
  });

  it("reads the empty version 1 file but rejects version 1 entries", () => {
    const legacy = (entries: unknown[]) =>
      state(RECORDED, JSON.stringify({ schema: "replay-approvals/1", entries }));
    expect(unwrap(checkReplayApprovals(legacy([]), base))).toEqual({ ok: true, failures: [] });
    const entry = JSON.parse(unwrap(propose(gameplay, "EXPECTED_GAMEPLAY_CHANGE"))).entries[0];
    expect(Result.isFailure(checkReplayApprovals(legacy([entry]), base))).toBe(true);
  });
});
