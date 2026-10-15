//apps/compiler-cli/src/options.ts
// Pure CLI option parsing + exit-code mapping, split out of main.ts so unit
// tests can import them WITHOUT pulling in the engine module graph that
// `commands.js` (and therefore `main.js`) cold-loads. The only import here is a
// type-only import, which is erased at compile time — this module has no runtime
// dependency on the engine, so `test/options.test.ts` imports a small graph.
import type {
  CliOptions,
  CampaignCliOptions,
  BattleGenerateCliOptions,
  BattleAdvanceMinuteCliOptions,
  GunneryResolveShotCliOptions,
  OutputMode,
  ExitCategory,
} from "./commands.js";

export const exitCodes: Record<ExitCategory, number> = {
  success: 0,
  "validation-error": 1,
  "compile-error": 2,
  aborted: 3,
  "internal-error": 4,
  "usage-error": 5,
};

export function parseOptions(
  argv: string[],
  extended = false,
  battleGenerate = false,
): CliOptions | CampaignCliOptions | BattleGenerateCliOptions {
  let manifest = "pack.json";
  let contentDir = "content";
  let outputDir = "out";
  let saveDir = "saves";
  let seed = "default-seed";
  let commandsPath: string | undefined;
  let outputMode: OutputMode = "human";
  let campaignMonth: string | undefined;
  let rngVersion = "1";
  let formulaVersion = "1";
  let rulesetVersion: string | undefined;
  let contentVersion = "0.1.0";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--manifest":
        manifest = argv[++i] ?? manifest;
        break;
      case "--content-dir":
        contentDir = argv[++i] ?? contentDir;
        break;
      case "--output-dir":
        outputDir = argv[++i] ?? outputDir;
        break;
      case "--save-dir":
        saveDir = argv[++i] ?? saveDir;
        break;
      case "--seed":
        seed = argv[++i] ?? seed;
        break;
      case "--commands":
        commandsPath = argv[++i] ?? commandsPath;
        break;
      case "--campaign-month":
        campaignMonth = argv[++i] ?? campaignMonth;
        break;
      case "--rng-version":
        rngVersion = argv[++i] ?? rngVersion;
        break;
      case "--formula-version":
        formulaVersion = argv[++i] ?? formulaVersion;
        break;
      case "--ruleset-version":
        rulesetVersion = argv[++i] ?? rulesetVersion;
        break;
      case "--content-version":
        // Retained deliberately: consumed only by `battle:generate` (it is passed
        // to `generateBattles`). The content commands derive the version from the
        // manifest, so the flag is not part of their `CliOptions` and is ignored
        // for them (CAH-LEG-1).
        contentVersion = argv[++i] ?? contentVersion;
        break;
      case "--json":
        outputMode = "json";
        break;
    }
  }
  if (battleGenerate) {
    return {
      manifest,
      contentDir,
      outputDir,
      outputMode,
      saveDir,
      seed,
      commandsPath,
      campaignMonth,
      rngVersion,
      formulaVersion,
      rulesetVersion,
      contentVersion,
    };
  }
  if (extended) {
    return { manifest, contentDir, outputDir, outputMode, saveDir, seed, commandsPath };
  }
  return { manifest, contentDir, outputDir, outputMode };
}

export function parseBattleAdvanceMinuteOptions(argv: string[]): BattleAdvanceMinuteCliOptions {
  let statePath: string | undefined;
  let minute = 1;
  let observationTime = "1900-01-01T00:00:00.000Z";
  let outputMode: OutputMode = "human";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--state":
        statePath = argv[++i] ?? statePath;
        break;
      case "--minute": {
        const value = argv[++i];
        if (value !== undefined) minute = Number(value);
        break;
      }
      case "--observation-time":
        observationTime = argv[++i] ?? observationTime;
        break;
      case "--json":
        outputMode = "json";
        break;
    }
  }
  return { statePath, minute, observationTime, outputMode };
}

export function parseGunneryResolveShotOptions(argv: string[]): GunneryResolveShotCliOptions {
  let inputPath: string | undefined;
  let seed = "default-seed";
  let outputMode: OutputMode = "human";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--input":
        inputPath = argv[++i] ?? inputPath;
        break;
      case "--seed":
        seed = argv[++i] ?? seed;
        break;
      case "--json":
        outputMode = "json";
        break;
    }
  }
  return { inputPath, seed, outputMode };
}
