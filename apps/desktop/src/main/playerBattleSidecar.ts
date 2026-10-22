import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Result, Schema } from "effect";

/**
 * The mid-battle save sidecar (T-2, issue #221). A player-fought battle is a pure
 * function of its committed manifest and the ordered standing orders the player
 * gave, so the save is just that order log: resuming re-creates the session and
 * replays it. Like `pending-turn.json` it is never authoritative and never part
 * of a save envelope; a record for another turn or battle is ignored.
 */
export const PLAYER_BATTLE_FILENAME = "player-battle.json";

const nonEmpty = Schema.String.check(Schema.isMinLength(1));

const StepSchema = Schema.Struct({
  mode: Schema.Literals(["minute", "to_end"]),
  divisions: Schema.Array(
    Schema.Struct({
      divisionId: nonEmpty,
      stance: Schema.Literals(["ENGAGE", "HOLD", "WITHDRAW"]),
      speedPercent: Schema.Finite.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(0),
        Schema.isLessThanOrEqualTo(100),
      ),
    }),
  ),
});

export const PlayerBattleSaveSchema = Schema.Struct({
  schemaVersion: Schema.Literal("1.0.0"),
  turnId: nonEmpty,
  battleId: nonEmpty,
  steps: Schema.Array(StepSchema),
});
export type PlayerBattleSave = typeof PlayerBattleSaveSchema.Type;
export type PlayerBattleStep = typeof StepSchema.Type;

/** Tolerant read: missing, corrupt or for another turn/battle -> null. */
export function loadPlayerBattleSave(
  saveDir: string,
  expected: { readonly turnId: string; readonly battleId: string },
): PlayerBattleSave | null {
  const path = join(saveDir, PLAYER_BATTLE_FILENAME);
  if (!existsSync(path)) return null;
  try {
    const parsed = Schema.decodeUnknownResult(PlayerBattleSaveSchema, {
      onExcessProperty: "error",
    })(JSON.parse(readFileSync(path, "utf8")));
    if (Result.isFailure(parsed)) return null;
    const save = parsed.success;
    return save.turnId === expected.turnId && save.battleId === expected.battleId ? save : null;
  } catch {
    return null;
  }
}

/** Atomic write (tmp file -> rename). */
export function savePlayerBattle(saveDir: string, save: PlayerBattleSave): void {
  const path = join(saveDir, PLAYER_BATTLE_FILENAME);
  const tmpPath = `${path}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(save), "utf8");
    renameSync(tmpPath, path);
  } catch (err) {
    rmSync(tmpPath, { force: true });
    throw err;
  }
}

export function clearPlayerBattleSave(saveDir: string): void {
  rmSync(join(saveDir, PLAYER_BATTLE_FILENAME), { force: true });
}
