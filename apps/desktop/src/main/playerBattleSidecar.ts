import { PlayerBattleDivisionAiCheckpointSchema } from "@bluewave/combat/battleResolution";
import { Schema } from "effect";
import { PlayerBattleDivisionOrderSchema } from "../shared/player-battle-schemas.js";
import { defineSidecar, type SidecarReading } from "./runtime/sidecar.js";

export const PLAYER_BATTLE_FILENAME = "player-battle.json";

const nonEmpty = Schema.String.check(Schema.isMinLength(1));

const StepSchema = Schema.Struct({
  mode: Schema.Literals(["minute", "to_end"]),
  divisions: Schema.Array(PlayerBattleDivisionOrderSchema),
});

const SaveV1Schema = Schema.Struct({
  schemaVersion: Schema.Literal("1.0.0"),
  turnId: nonEmpty,
  battleId: nonEmpty,
  steps: Schema.Array(StepSchema),
});

const SaveV1_1Schema = Schema.Struct({
  schemaVersion: Schema.Literal("1.1.0"),
  turnId: nonEmpty,
  battleId: nonEmpty,
  steps: Schema.Array(StepSchema),
  divisionAi: Schema.NullOr(PlayerBattleDivisionAiCheckpointSchema),
});

export const PlayerBattleSaveSchema = Schema.Union([SaveV1Schema, SaveV1_1Schema]);
export type PlayerBattleSave = typeof SaveV1_1Schema.Type;
export type PlayerBattleStep = typeof StepSchema.Type;

function currentShape(stored: typeof PlayerBattleSaveSchema.Type): PlayerBattleSave {
  if (stored.schemaVersion === "1.1.0") return stored;
  return { ...stored, schemaVersion: "1.1.0", divisionAi: null };
}

export interface PlayerBattleExpectation {
  readonly turnId: string;
  readonly battleId: string;
}

export const playerBattleSidecar = defineSidecar<
  typeof PlayerBattleSaveSchema.Type,
  PlayerBattleSave | null,
  PlayerBattleExpectation
>({
  filename: PLAYER_BATTLE_FILENAME,
  schema: PlayerBattleSaveSchema,
  decodeOptions: { onExcessProperty: "error" },
  empty: () => null,
  resolve: (stored, expected) =>
    stored.turnId === expected.turnId && stored.battleId === expected.battleId
      ? currentShape(stored)
      : null,
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
