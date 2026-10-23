import { Schema } from "effect";
import { PlayerBattleDivisionOrderSchema } from "../shared/player-battle-schemas.js";
import { defineSidecar, type SidecarReading } from "./runtime/sidecar.js";

export const PLAYER_BATTLE_FILENAME = "player-battle.json";

const nonEmpty = Schema.String.check(Schema.isMinLength(1));

const StepSchema = Schema.Struct({
  mode: Schema.Literals(["minute", "to_end"]),
  divisions: Schema.Array(PlayerBattleDivisionOrderSchema),
});

export const PlayerBattleSaveSchema = Schema.Struct({
  schemaVersion: Schema.Literal("1.0.0"),
  turnId: nonEmpty,
  battleId: nonEmpty,
  steps: Schema.Array(StepSchema),
});
export type PlayerBattleSave = typeof PlayerBattleSaveSchema.Type;
export type PlayerBattleStep = typeof StepSchema.Type;

export interface PlayerBattleExpectation {
  readonly turnId: string;
  readonly battleId: string;
}

export const playerBattleSidecar = defineSidecar<
  PlayerBattleSave,
  PlayerBattleSave | null,
  PlayerBattleExpectation
>({
  filename: PLAYER_BATTLE_FILENAME,
  schema: PlayerBattleSaveSchema,
  decodeOptions: { onExcessProperty: "error" },
  empty: () => null,
  resolve: (stored, expected) =>
    stored.turnId === expected.turnId && stored.battleId === expected.battleId ? stored : null,
});

export function inspectPlayerBattleSave(
  saveDir: string,
  expected: PlayerBattleExpectation,
): SidecarReading<PlayerBattleSave | null> {
  return playerBattleSidecar.inspect(saveDir, expected);
}

export function loadPlayerBattleSave(
  saveDir: string,
  expected: PlayerBattleExpectation,
): PlayerBattleSave | null {
  return playerBattleSidecar.read(saveDir, expected);
}

export function savePlayerBattle(saveDir: string, save: PlayerBattleSave): void {
  playerBattleSidecar.write(saveDir, save);
}

export function clearPlayerBattleSave(saveDir: string): void {
  playerBattleSidecar.remove(saveDir);
}
