//apps/compiler-cli/src/index.ts
//
export {
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
  safePath,
  buildInput,
  buildContentSurfaceInput,
  snapshotHash,
  persistedStateHash,
  reviveCampaignSnapshot,
  serializeCampaignSnapshot,
} from "./commands.js";
export type {
  CliOptions,
  CampaignCliOptions,
  BattleGenerateCliOptions,
  BattleAdvanceMinuteCliOptions,
  GunneryResolveShotCliOptions,
  OutputMode,
  ExitCategory,
} from "./commands.js";
export { reportBluewaveError, runCombatOperation } from "./combatDiagnostics.js";
export type { CombatOperationResult } from "./combatDiagnostics.js";
export { CliFileSystem, CliFileSystemError, cliFileSystemLayer } from "./runtime/cliFileSystem.js";
export type { CliFileSystemShape } from "./runtime/cliFileSystem.js";
export { CliConsole, cliConsoleLayer } from "./runtime/cliConsole.js";
export type { CliConsoleShape } from "./runtime/cliConsole.js";
export { cliLayer } from "./runtime/cliLayer.js";
export type { CliEnv } from "./runtime/cliLayer.js";
