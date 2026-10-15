#!/usr/bin/env node
import { Effect, ManagedRuntime } from "effect";
import type { CommandEnvelope, CommandBody } from "@bluewave/commands";
import {
  runValidate,
  runCompile,
  runInspect,
  runVerify,
  runCompare,
  runContentCheck,
  runContentBuild,
  runContentVerify,
  runContentGate,
  runCampaignCompile,
  runCampaignSave,
  runCampaignLoad,
  runTurnExecute,
  runReplay,
  runBattleGenerate,
  runBattleAdvanceMinute,
  runGunneryResolveShot,
  type CampaignCliOptions,
  type BattleGenerateCliOptions,
  type ExitCategory,
} from "./commands.js";
import {
  exitCodes,
  parseOptions,
  parseBattleAdvanceMinuteOptions,
  parseGunneryResolveShotOptions,
} from "./options.js";
import { CliConsole } from "./runtime/cliConsole.js";
import { CliFileSystem } from "./runtime/cliFileSystem.js";
import { cliLayer, type CliEnv } from "./runtime/cliLayer.js";

const USAGE = `Usage: bwc <command> [options]
Commands:
  validate           Validate content pack without producing output
  compile            Compile content pack to canonical artifact
  content:check      Validate the whole authored surface (content pack +
                     ship-building catalogue) without writing
  content:build      Compile the whole authored surface to a generated
                     content artifact + manifest
  content:verify     Rebuild in memory and verify against the committed
                     content lock (fails on drift or tamper)
  content:gate       Fail a shipping (production) pack that still carries an
                     unresolved placeholder value (unless allowlisted)
  inspect            Inspect compiled artifact and envelope
  verify             Verify compiled artifact against envelope
  compare            Compare compiled artifact hash against envelope
  campaign:compile   Compile content pack (incl. fleets/economy/construction/
                     diplomacy/research/designs) to campaign state
  campaign:save      Save campaign state to persistence store
  campaign:load      Load and verify campaign state from persistence store
  turn:execute       Execute one month, save new state
  replay             Replay all commands from a save and verify hashes
  battle:generate    Run battle generation (@bluewave/combat) against a saved
                     snapshot in isolation, without running a full turn
  battle:advance-minute
                     Run one tactical minute-advance (@bluewave/combat,
                     DESIGN-38 movement/spotting) against a hand-authored
                     TacticalBattleState JSON file
  gunnery:resolve-shot
                     Resolve one gunnery shot (@bluewave/combat, DESIGN-39
                     §3/§28 accuracy + hit + ammunition) against a
                     hand-authored scenario JSON file
General options:
  --manifest <path>     Path to pack manifest (default: pack.json)
  --content-dir <path>  Content directory (default: content/)
  --output-dir <path>   Output directory (default: out/)
  --save-dir <path>     Save directory (default: saves/)
  --seed <string>       Random seed for deterministic RNG (default: "default-seed")
  --commands <path>     Path to a JSON file of CommandEnvelope[] to submit for
                         turn:execute (budget, research priority, design,
                         diplomacy/war, AI, etc.)
  --json                Output in JSON format
  --help                Show this help
battle:generate options:
  --campaign-month <string>   Month to generate battles for (default: the
                               loaded snapshot's turnNumber)
  --ruleset-version <string>  Ruleset version passed to generateBattles
                               (default: the loaded snapshot's rulesetVersion)
  --rng-version <string>      RNG version passed to generateBattles
                               (default: "1", matching turn:execute)
  --formula-version <string>  Formula version passed to generateBattles
                               (default: "1", matching turn:execute)
  --content-version <string>  Content version passed to generateBattles
                               (default: "0.1.0", matching turn:execute)
battle:advance-minute options:
  --state <path>              Required. Path to a JSON file with shape
                               { state: TacticalBattleState, orders?:
                               Record<assetId, { orderedHeading: number,
                               orderedSpeedBp: number, attainableMaxBp?:
                               number }>, attackRangeUm?: number }. There is
                               no fixture generator yet — hand-author this
                               file against @bluewave/combat's
                               TacticalBattleState/MovementState/
                               TacticalContact types (see
                               packages/combat/src/tactical/state.ts and
                               packages/combat/test/simulation/advance.test.ts
                               for a worked example). Movement/spotting only
                               (steps 4-8) — no gunnery in this command.
  --minute <number>            Minute number to advance (default: 1)
  --observation-time <string>  ISO timestamp passed to spotting resolution
                               (default: "1900-01-01T00:00:00.000Z")
gunnery:resolve-shot options:
  --input <path>        Required. Path to a JSON file with shape
                         { identity: { battleId, batteryId, minute, substep },
                         accuracyFactors: { baseAccuracyBp, fireControl, crew,
                         officer, training, range, visibility, radar,
                         ownManeuver, targetManeuver, previousSalvo, seaState,
                         smoke, damage, multipleAttacker, glare,
                         targetEvasion } (all integer basis points; see
                         packages/combat/src/gunnery/constants.ts for the
                         canonical factor list), salvo: { count, ammunition:
                         { ARMOR_PIERCING, COMMON, HIGH_EXPLOSIVE },
                         preferredType, permittedTypes? } }. There is no
                         fixture generator yet — hand-author against
                         @bluewave/combat's GunneryAccuracyFactors/
                         AmmunitionType types (see
                         packages/combat/test/gunnery/accuracy.test.ts and
                         ammunition.test.ts for worked examples).
  --seed <string>        RandomEngine master seed for the keyed hit draw
                         (default: "default-seed")`;

const EXISTING_COMMANDS = [
  "validate",
  "compile",
  "inspect",
  "verify",
  "compare",
  "content:check",
  "content:build",
  "content:verify",
  "content:gate",
];
const NEW_COMMANDS = [
  "campaign:compile",
  "campaign:save",
  "campaign:load",
  "turn:execute",
  "replay",
];
const BATTLE_GENERATE_COMMANDS = ["battle:generate"];
const BATTLE_ADVANCE_MINUTE_COMMANDS = ["battle:advance-minute"];
const GUNNERY_RESOLVE_SHOT_COMMANDS = ["gunnery:resolve-shot"];
const ALL_COMMANDS = [
  ...EXISTING_COMMANDS,
  ...NEW_COMMANDS,
  ...BATTLE_GENERATE_COMMANDS,
  ...BATTLE_ADVANCE_MINUTE_COMMANDS,
  ...GUNNERY_RESOLVE_SHOT_COMMANDS,
];

const loadCommandsFile = (
  path: string | undefined,
): Effect.Effect<CommandEnvelope<CommandBody>[] | undefined | "error", never, CliFileSystem> =>
  Effect.gen(function* () {
    if (!path) return undefined;
    const fs = yield* CliFileSystem;
    const raw = yield* fs
      .readFile(path)
      .pipe(Effect.catchTag("CliFileSystemError", () => Effect.succeed(undefined)));
    if (raw === undefined) return "error";
    try {
      return JSON.parse(raw) as CommandEnvelope<CommandBody>[];
    } catch {
      return "error";
    }
  });

/**
 * The synchronous CLI dispatch, as one Effect program resolving the CLI
 * services from the environment. `parseOptions` and the output modes stay at
 * this edge; every `run*` is itself an Effect program.
 */
const runCli = (args: string[]): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const console = yield* CliConsole;
    if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
      yield* console.out(USAGE);
      return "success";
    }
    const command = args[0] as string;
    if (!ALL_COMMANDS.includes(command)) {
      yield* console.err(`Unknown command: ${command}\n`);
      yield* console.err(USAGE);
      // Legacy contract: the pre-migration dispatch returned the literal exit
      // code 1 (the `validation-error` slot) for an unknown command, so the
      // exact exit code is preserved even though the command is unrecognised.
      return "validation-error";
    }
    if (BATTLE_ADVANCE_MINUTE_COMMANDS.includes(command)) {
      const bo = parseBattleAdvanceMinuteOptions(args.slice(1));
      return yield* runBattleAdvanceMinute(bo);
    }
    if (GUNNERY_RESOLVE_SHOT_COMMANDS.includes(command)) {
      const go = parseGunneryResolveShotOptions(args.slice(1));
      return yield* runGunneryResolveShot(go);
    }
    const isBattleGenerate = BATTLE_GENERATE_COMMANDS.includes(command);
    const isNew = NEW_COMMANDS.includes(command) || isBattleGenerate;
    const options = parseOptions(args.slice(1), isNew, isBattleGenerate);
    switch (command) {
      case "validate":
        return yield* runValidate(options);
      case "compile":
        return yield* runCompile(options);
      case "inspect":
        return yield* runInspect(options);
      case "verify":
        return yield* runVerify(options);
      case "compare":
        return yield* runCompare(options);
      case "content:check":
        return yield* runContentCheck(options);
      case "content:build":
        return yield* runContentBuild(options);
      case "content:verify":
        return yield* runContentVerify(options);
      case "content:gate":
        return yield* runContentGate(options);
      case "campaign:compile": {
        const co = options as CampaignCliOptions;
        return yield* runCampaignCompile(co);
      }
      case "campaign:save": {
        const co = options as CampaignCliOptions;
        return yield* runCampaignSave(co, co.saveDir);
      }
      case "campaign:load": {
        const co = options as CampaignCliOptions;
        return yield* runCampaignLoad(co, co.saveDir);
      }
      case "turn:execute": {
        const co = options as CampaignCliOptions;
        const commands = yield* loadCommandsFile(co.commandsPath);
        if (commands === "error") {
          yield* console.err(`Failed to parse commands file: ${co.commandsPath}\n`);
          return "usage-error";
        }
        return yield* runTurnExecute(co, co.saveDir, commands);
      }
      case "replay": {
        const co = options as CampaignCliOptions;
        return yield* runReplay(co, co.saveDir);
      }
      case "battle:generate": {
        const bo = options as BattleGenerateCliOptions;
        return yield* runBattleGenerate(bo, bo.saveDir);
      }
      default:
        return "usage-error";
    }
  });

/**
 * The CLI entrypoint facade (INC-6; ADR-0159). Builds the one `ManagedRuntime`
 * from the CLI layer, runs the dispatch program, maps the `ExitCategory` to the
 * six-code contract via `exitCodes`, disposes the runtime, then exits. A defect
 * (a thrown engine/`safePath` error) keeps the pre-migration behaviour: print
 * the stack to stderr and exit `validation-error`. `Runtime.makeRunMain`
 * defaults are deliberately not adopted.
 */
function main(): void {
  const runtime = ManagedRuntime.make(cliLayer);
  const program = runCli(process.argv.slice(2));
  const finish = (code: number): void => {
    void runtime.dispose().then(
      () => process.exit(code),
      () => process.exit(code),
    );
  };
  runtime.runPromise(program).then(
    (category) => finish(exitCodes[category]),
    (error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
      finish(exitCodes["validation-error"]);
    },
  );
}

// prevent auto-run when imported in vitest
if (!process.env.VITEST) {
  main();
}
