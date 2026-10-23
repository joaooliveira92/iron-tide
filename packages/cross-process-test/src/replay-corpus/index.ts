export { formatDivergence, recordReplay, verifyReplay } from "./corpus.js";
export type {
  ExecutorPerturbation,
  ReplayDivergence,
  ReplayScenario,
  RoundTripOptions,
  VerifyOptions,
  VerifyOutcome,
} from "./corpus.js";
export { REPLAY_FORMAT_VERSION, ReplayFileError, decodeReplayFile } from "./format.js";
export { REPLAY_SCENARIOS } from "./scenarios.js";
export {
  SUBSYSTEMS,
  buildCoverageReport,
  formatCoverageReport,
  monthCoverage,
} from "./coverage.js";
export type { CorpusScenario, CoverageReport, MonthCoverage, ReplayCoverage } from "./coverage.js";
export { executeScenario } from "./corpus.js";
export type { ExecutedMonth } from "./corpus.js";
export {
  ApprovalsError,
  CHANGE_CLASSES,
  REPLAY_APPROVALS_SCHEMA,
  checkReplayApprovals,
  checkpointHash,
  formatApprovalFailures,
  isChangeClass,
  proposeApprovals,
} from "./approvals.js";
export type {
  ApprovalCheck,
  ApprovalEntry,
  ApprovalFailure,
  ApprovalsFile,
  ChangeClass,
  CorpusState,
  ProposalInput,
} from "./approvals.js";
export { approvalsCommand } from "./approvals-command.js";
export type { ApprovalsIo } from "./approvals-command.js";
export {
  FUZZ_CASES,
  FuzzManifestError,
  PICK_SCALE,
  checkFuzzCase,
  decodeFuzzManifest,
  fuzzSubsystems,
  formatFuzzFailure,
  generateFuzzCommands,
  recordFuzzManifest,
  runCommandPlan,
  runFuzzCase,
} from "./fuzz.js";
export type {
  CheckOptions,
  CommandKind,
  CommandPick,
  CommandPlan,
  FuzzCase,
  FuzzManifest,
  FuzzOutcome,
  FuzzProperty,
  FuzzRun,
  FuzzRunOptions,
  PinnedCase,
} from "./fuzz.js";
