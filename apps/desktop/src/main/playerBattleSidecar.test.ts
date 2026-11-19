import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DIVISION_AI_MEMORY_VERSION, hashDivisionAiMemory } from "@bluewave/combat/division-ai";
import { Result, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { PlayerBattleDivisionOrderSchema } from "../shared/player-battle-schemas.js";
import {
  PLAYER_BATTLE_FILENAME,
  PlayerBattleSaveSchema,
  loadPlayerBattleSave,
  savePlayerBattle,
} from "./playerBattleSidecar.js";

const stepWith = (speedPercent: number) => ({
  schemaVersion: "1.0.0",
  turnId: "t",
  battleId: "b",
  steps: [{ mode: "minute", divisions: [{ divisionId: "d", stance: "HOLD", speedPercent }] }],
});

describe("player battle save steps share the wire order schema", () => {
  const wire = Schema.decodeUnknownResult(PlayerBattleDivisionOrderSchema);
  const save = Schema.decodeUnknownResult(PlayerBattleSaveSchema, { onExcessProperty: "error" });

  it.each([0, 5, 100, -1, 101, 1.5, Number.NaN])("agrees on speedPercent %s", (speedPercent) => {
    const order = { divisionId: "d", stance: "HOLD", speedPercent };
    expect(Result.isSuccess(save(stepWith(speedPercent)))).toBe(Result.isSuccess(wire(order)));
  });

  it("decodes a 1.0.0 save without a target unchanged and keeps an ordered target", () => {
    const plain = stepWith(50);
    const decodedPlain = save(plain);
    expect(Result.isSuccess(decodedPlain)).toBe(true);
    const targeted = {
      ...plain,
      steps: [
        {
          mode: "minute",
          divisions: [
            { divisionId: "d", stance: "ENGAGE", speedPercent: 50, targetHandle: "ab12" },
          ],
        },
      ],
    };
    const decoded = save(targeted);
    expect(Result.isSuccess(decoded) && decoded.success.steps[0]?.divisions[0]).toMatchObject({
      targetHandle: "ab12",
    });
    expect(
      Result.isFailure(
        wire({ divisionId: "d", stance: "HOLD", speedPercent: 1, targetHandle: "" }),
      ),
    ).toBe(true);
  });

  it("rejects unknown stances and empty division ids in both", () => {
    expect(Result.isFailure(wire({ divisionId: "", stance: "HOLD", speedPercent: 1 }))).toBe(true);
    expect(Result.isFailure(wire({ divisionId: "d", stance: "RAM", speedPercent: 1 }))).toBe(true);
  });
});

describe("player battle save carries the division AI checkpoint", () => {
  const fixtureDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../test/fixtures/player-battle-save/1.0.0",
  );
  const expected = { turnId: "turn-fixture", battleId: "battle-fixture" };
  const memory = {
    version: DIVISION_AI_MEMORY_VERSION,
    divisions: [
      {
        divisionId: "div-a",
        mode: "SUPPORT_STATION" as const,
        modeSinceMinute: 1,
        supportSide: 1 as const,
        attacking: true,
        patrolAnchor: { xMetres: 1_000, yMetres: -2_000 },
        waypointIndex: 2,
      },
    ],
  };
  const checkpoint = { minute: 2, memoryHash: hashDivisionAiMemory(memory), memory };
  const save = (divisionAi: typeof checkpoint | null) => ({
    schemaVersion: "1.1.0" as const,
    turnId: "turn-fixture",
    battleId: "battle-fixture",
    steps: [],
    divisionAi,
  });
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bw-player-battle-sidecar-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads a frozen 1.0.0 save as the current shape with no checkpoint", () => {
    copyFileSync(join(fixtureDir, PLAYER_BATTLE_FILENAME), join(dir, PLAYER_BATTLE_FILENAME));
    const loaded = loadPlayerBattleSave(dir, expected);
    expect(loaded).toMatchObject({
      schemaVersion: "1.1.0",
      turnId: "turn-fixture",
      battleId: "battle-fixture",
      divisionAi: null,
    });
    expect(loaded?.steps).toHaveLength(2);
  });

  it("round trips a 1.1.0 save with its checkpoint through the file", () => {
    savePlayerBattle(dir, save(checkpoint));
    expect(loadPlayerBattleSave(dir, expected)).toEqual(save(checkpoint));
  });

  it("keeps null as the checkpoint of a battle without memory", () => {
    savePlayerBattle(dir, save(null));
    expect(loadPlayerBattleSave(dir, expected)).toEqual(save(null));
  });

  it("rejects a checkpoint on a 1.0.0 save, a missing 1.1.0 checkpoint and an unknown memory field", () => {
    const decode = Schema.decodeUnknownResult(PlayerBattleSaveSchema, {
      onExcessProperty: "error",
    });
    const base = { turnId: "t", battleId: "b", steps: [] };
    expect(Result.isFailure(decode({ ...base, schemaVersion: "1.0.0", divisionAi: null }))).toBe(
      true,
    );
    expect(Result.isFailure(decode({ ...base, schemaVersion: "1.1.0" }))).toBe(true);
    expect(
      Result.isFailure(
        decode({
          ...base,
          schemaVersion: "1.1.0",
          divisionAi: { ...checkpoint, memory: { ...memory, extra: 1 } },
        }),
      ),
    ).toBe(true);
  });
});
