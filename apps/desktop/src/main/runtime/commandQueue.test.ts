import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignState } from "@bluewave/campaign";
import type { CommandEnvelope, MoveFleetCommand } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { Effect, Layer } from "effect";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { toSaveableState } from "../saveHelpers.js";
import { CampaignSessionStore } from "./campaignSessionStore.js";
import { SessionNotFound } from "./commandError.js";
import {
  CommandQueue,
  PENDING_COMMANDS_FILENAME,
  commandQueueLayer,
  commandQueueMemoryLayer,
} from "./commandQueue.js";

const GENERATED_ARTIFACT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
  "content",
  "generated",
  "1880",
);

let dir: string;
let turnNumber: number;
let baseState: CampaignState;
beforeAll(() => {
  const collector = new DiagnosticCollector();
  const output = compileProductionCampaignFromArtifact(
    GENERATED_ARTIFACT,
    new AbortController().signal,
    collector,
  );
  if (!output) throw new Error("production pack failed to compile");
  baseState = toSaveableState(output.state);
});
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "command-queue-"));
  turnNumber = 3;
});

function stateAtTurn(): CampaignState {
  return { ...baseState, snapshot: { ...baseState.snapshot, turnNumber: SafeInt(turnNumber) } };
}
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function sessionRecord(saveDir: string): CampaignSessionRecord {
  return {
    sessionId: "s1",
    saveDir,
    playerSlotId: "uk",
    campaignSeed: "a".repeat(32),
    month: { month: 1, year: 1880 },
    state: stateAtTurn(),
  };
}

function sessionsLayer(saveDir: string): Layer.Layer<CampaignSessionStore> {
  return Layer.succeed(CampaignSessionStore, {
    get: (sessionId) =>
      sessionId === "s1"
        ? Effect.succeed(sessionRecord(saveDir))
        : Effect.fail(new SessionNotFound({ sessionId })),
    register: () => Effect.void,
    remove: () => Effect.void,
    getConstructionWorkspace: () => Effect.die("unused"),
    hasConstructionWorkspace: () => Effect.succeed(false),
    clearConstructionWorkspace: () => Effect.void,
  });
}

function fileLayer(saveDir: string = dir): Layer.Layer<CommandQueue> {
  return commandQueueLayer().pipe(Layer.provide(sessionsLayer(saveDir)));
}

function envelope(
  commandId: string,
  toAreaId: string,
  fleetId = "f1",
): CommandEnvelope<MoveFleetCommand> {
  return {
    commandId,
    version: "0.1.0",
    expectedSnapshotHash: "stale",
    idempotencyKey: `k/${commandId}`,
    timestamp: "1880-01-01T00:00:00.000Z",
    body: { type: "MoveFleet", nationId: "uk", fleetId, toAreaId },
    issuerClass: "PLAYER",
    issuerParticipantId: "uk",
  };
}

const run = <A, E>(
  layer: Layer.Layer<CommandQueue>,
  use: (queue: typeof CommandQueue.Service) => Effect.Effect<A, E>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* use(yield* CommandQueue);
    }).pipe(Effect.provide(layer)),
  );

const pendingPath = () => join(dir, PENDING_COMMANDS_FILENAME);

const adapters = [
  ["file", () => fileLayer()],
  ["in-memory", () => commandQueueMemoryLayer()],
] as const;

describe.each(adapters)("command queue (%s adapter)", (_name, makeLayer) => {
  it("queues a fresh transport request", async () => {
    const layer = makeLayer();
    const entries = await run(layer, (queue) =>
      Effect.gen(function* () {
        const outcome = yield* queue.queueOrReplay("s1", {
          transportRequestId: "t1",
          envelope: envelope("c1", "a2"),
        });
        expect(outcome).toEqual({ kind: "queued" });
        return yield* queue.entries("s1");
      }),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.transportRequestId).toBe("t1");
    expect(entries[0]?.payloadFingerprint).toBe(
      sha256Hex(canonicalSerialize(envelope("c1", "a2").body)),
    );
  });

  it("replays the prior entry when the same body is resubmitted under the same transport request", async () => {
    const layer = makeLayer();
    await run(layer, (queue) =>
      Effect.gen(function* () {
        yield* queue.queueOrReplay("s1", {
          transportRequestId: "t1",
          envelope: envelope("c1", "a2"),
        });
        const replay = yield* queue.queueOrReplay("s1", {
          transportRequestId: "t1",
          envelope: envelope("c-other", "a2"),
        });
        expect(replay.kind).toBe("replayed");
        if (replay.kind === "replayed") expect(replay.prior.envelope.commandId).toBe("c1");
        expect(yield* queue.entries("s1")).toHaveLength(1);
      }),
    );
  });

  it("reports a conflict when a different body reuses the transport request, leaving the queue intact", async () => {
    const layer = makeLayer();
    await run(layer, (queue) =>
      Effect.gen(function* () {
        yield* queue.queueOrReplay("s1", {
          transportRequestId: "t1",
          envelope: envelope("c1", "a2"),
        });
        const conflict = yield* queue.queueOrReplay("s1", {
          transportRequestId: "t1",
          envelope: envelope("c2", "a3"),
        });
        expect(conflict).toMatchObject({
          kind: "conflict",
          refusal: {
            reason: "IDEMPOTENCY_CONFLICT",
            diagnostics: ["transportRequestId t1 was already used by command c1"],
          },
        });
        const entries = yield* queue.entries("s1");
        expect(entries.map((entry) => entry.envelope.commandId)).toEqual(["c1"]);
      }),
    );
  });

  it("consults the replay check before the admission guard", async () => {
    const layer = makeLayer();
    let admitCalls = 0;
    await run(layer, (queue) =>
      Effect.gen(function* () {
        const admit = () => {
          admitCalls += 1;
          return undefined;
        };
        yield* queue.queueOrReplay(
          "s1",
          { transportRequestId: "t1", envelope: envelope("c1", "a2") },
          admit,
        );
        yield* queue.queueOrReplay(
          "s1",
          { transportRequestId: "t1", envelope: envelope("c1", "a2") },
          admit,
        );
        yield* queue.queueOrReplay(
          "s1",
          { transportRequestId: "t1", envelope: envelope("c2", "a3") },
          admit,
        );
      }),
    );
    expect(admitCalls).toBe(1);
  });

  it("queues nothing when the admission guard refuses", async () => {
    const layer = makeLayer();
    await run(layer, (queue) =>
      Effect.gen(function* () {
        const refused = yield* queue.queueOrReplay(
          "s1",
          { transportRequestId: "t1", envelope: envelope("c1", "a2") },
          () => ({ reason: "INVALID_ROUTE", diagnostics: ["no route"] }),
        );
        expect(refused).toEqual({
          kind: "refused",
          refusal: { reason: "INVALID_ROUTE", diagnostics: ["no route"] },
        });
        expect(yield* queue.entries("s1")).toEqual([]);
      }),
    );
  });

  it("scopes entries per session and deletes and clears them", async () => {
    const layer = makeLayer();
    await run(layer, (queue) =>
      Effect.gen(function* () {
        yield* queue.queueOrReplay("s1", {
          transportRequestId: "t1",
          envelope: envelope("c1", "a2"),
        });
        yield* queue.queueOrReplay("s1", {
          transportRequestId: "t2",
          envelope: envelope("c2", "a3", "f2"),
        });
        yield* queue.queueOrReplay("other", {
          transportRequestId: "t1",
          envelope: envelope("c3", "a4"),
        });
        expect(yield* queue.entries("s1")).toHaveLength(2);
        yield* queue.delete("s1", "t1");
        expect((yield* queue.entries("s1")).map((entry) => entry.transportRequestId)).toEqual([
          "t2",
        ]);
        yield* queue.delete("s1", "missing");
        yield* queue.clear("s1");
        expect(yield* queue.entries("s1")).toEqual([]);
        expect(yield* queue.entries("other")).toHaveLength(1);
      }),
    );
  });

  it("stamps the execution snapshot hash on every queued envelope and yields nothing when empty", async () => {
    const layer = makeLayer();
    const snapshot = stateAtTurn().snapshot;
    await run(layer, (queue) =>
      Effect.gen(function* () {
        expect(yield* queue.forExecution("s1", snapshot)).toEqual([]);
        yield* queue.queueOrReplay("s1", {
          transportRequestId: "t1",
          envelope: envelope("c1", "a2"),
        });
        const [stamped] = yield* queue.forExecution("s1", snapshot);
        expect(stamped?.commandId).toBe("c1");
        expect(stamped?.expectedSnapshotHash).toBe(sha256Hex(canonicalSerialize(snapshot)));
      }),
    );
  });

  it("keeps state private to each layer instance", async () => {
    await run(makeLayer(), (queue) =>
      queue.queueOrReplay("s1", { transportRequestId: "t1", envelope: envelope("c1", "a2") }),
    );
    expect(await run(makeLayer(), (queue) => queue.entries("s1"))).toEqual([]);
  });
});

describe("command queue file persistence", () => {
  it("writes the canonical pending_commands_v1 sidecar and removes it when the queue empties", async () => {
    await run(fileLayer(), (queue) =>
      Effect.gen(function* () {
        yield* queue.queueOrReplay("s1", {
          transportRequestId: "t1",
          envelope: envelope("c1", "a2"),
        });
        expect(JSON.parse(readFileSync(pendingPath(), "utf8"))).toEqual({
          schema: "pending_commands_v1",
          turnNumber: 3,
          entries: yield* queue.entries("s1"),
        });
        yield* queue.delete("s1", "t1");
        expect(existsSync(pendingPath())).toBe(false);
      }),
    );
  });

  it("restores the queue after a restart and reports the count", async () => {
    await run(fileLayer(), (queue) =>
      Effect.gen(function* () {
        yield* queue.queueOrReplay("s1", {
          transportRequestId: "t1",
          envelope: envelope("c1", "a2"),
        });
        yield* queue.queueOrReplay("s1", {
          transportRequestId: "t2",
          envelope: envelope("c2", "a3", "f2"),
        });
      }),
    );
    await run(fileLayer(), (queue) =>
      Effect.gen(function* () {
        expect(yield* queue.restore("s1")).toBe(2);
        const replay = yield* queue.queueOrReplay("s1", {
          transportRequestId: "t1",
          envelope: envelope("c1", "a2"),
        });
        expect(replay.kind).toBe("replayed");
      }),
    );
  });

  it("restores nothing when there is no file", async () => {
    expect(await run(fileLayer(), (queue) => queue.restore("s1"))).toBe(0);
  });

  it("restores nothing for an unknown session", async () => {
    expect(await run(fileLayer(), (queue) => queue.restore("ghost"))).toBe(0);
  });

  it("discards a corrupt file", async () => {
    writeFileSync(pendingPath(), "{ not json", "utf8");
    expect(await run(fileLayer(), (queue) => queue.restore("s1"))).toBe(0);
    expect(existsSync(pendingPath())).toBe(false);
  });

  it("discards a file that fails the schema", async () => {
    writeFileSync(pendingPath(), JSON.stringify({ schema: "other", entries: [] }), "utf8");
    expect(await run(fileLayer(), (queue) => queue.restore("s1"))).toBe(0);
    expect(existsSync(pendingPath())).toBe(false);
  });

  it("discards a file written for another turn", async () => {
    await run(fileLayer(), (queue) =>
      queue.queueOrReplay("s1", { transportRequestId: "t1", envelope: envelope("c1", "a2") }),
    );
    turnNumber = 4;
    expect(await run(fileLayer(), (queue) => queue.restore("s1"))).toBe(0);
    expect(existsSync(pendingPath())).toBe(false);
  });

  it("surfaces a write failure as a typed error and does not keep the entry", async () => {
    const missing = join(dir, "does", "not", "exist");
    const layer = fileLayer(missing);
    const result = await run(layer, (queue) =>
      Effect.gen(function* () {
        const failure = yield* queue
          .queueOrReplay("s1", { transportRequestId: "t1", envelope: envelope("c1", "a2") })
          .pipe(Effect.flip);
        return { failure, entries: yield* queue.entries("s1") };
      }),
    );
    expect(result.failure._tag).toBe("CommandFailed");
    expect(result.failure.reason).toBe("PENDING_COMMANDS_WRITE_FAILED");
    expect(result.entries).toEqual([]);
  });

  it("keeps queueing in memory for a session the store does not know", async () => {
    await run(fileLayer(), (queue) =>
      Effect.gen(function* () {
        const outcome = yield* queue.queueOrReplay("ghost", {
          transportRequestId: "t1",
          envelope: envelope("c1", "a2"),
        });
        expect(outcome.kind).toBe("queued");
        expect(yield* queue.entries("ghost")).toHaveLength(1);
      }),
    );
    expect(existsSync(pendingPath())).toBe(false);
  });
});
