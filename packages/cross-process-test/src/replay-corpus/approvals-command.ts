import { Result } from "effect";

import {
  checkReplayApprovals,
  formatApprovalFailures,
  proposeApprovals,
  type CorpusState,
} from "./approvals.js";

/** The IO the approvals command needs; the process entrypoint binds it to git and the filesystem. */
export interface ApprovalsIo {
  readBase(): CorpusState;
  readHead(): CorpusState;
  writeApprovals(text: string): void;
  print(line: string): void;
}

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value === undefined || value.startsWith("--") ? undefined : value;
}

/** True when the environment says a CI runner is executing us. */
const inCi = (env: Readonly<Record<string, string | undefined>>): boolean =>
  env["CI"] !== undefined && env["CI"] !== "" && env["CI"] !== "false" && env["CI"] !== "0";

/**
 * `check` verifies the corpus delta against the approvals (exit 1 on any failure) and is safe
 * everywhere. `propose` writes entries from the real diff and refuses to run in CI (exit 2).
 */
export function approvalsCommand(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  io: ApprovalsIo,
): number {
  const [command] = argv;
  if (command === "check") {
    const outcome = checkReplayApprovals(io.readBase(), io.readHead());
    if (Result.isFailure(outcome)) {
      io.print(`rejected: ${outcome.failure.message}\n`);
      return 2;
    }
    if (outcome.success.ok) {
      io.print("replay approvals: corpus delta is fully approved\n");
      return 0;
    }
    io.print(formatApprovalFailures(outcome.success.failures));
    return 1;
  }
  if (command === "propose") {
    if (inCi(env)) {
      io.print("refused: approvals are written locally and committed; CI only verifies\n");
      return 2;
    }
    const cause = option(argv, "--cause");
    const migrationAssessment = option(argv, "--migration");
    if (cause === undefined || migrationAssessment === undefined) {
      io.print("propose needs --cause <text> and --migration <text>\n");
      return 2;
    }
    const head = io.readHead();
    const text = proposeApprovals(io.readBase(), head, { cause, migrationAssessment });
    if (Result.isFailure(text)) {
      io.print(`rejected: ${text.failure.message}\n`);
      return 2;
    }
    if (text.success === head.approvals) {
      io.print("nothing to propose: every delta already has an entry\n");
      return 0;
    }
    io.writeApprovals(text.success);
    io.print("approval entries written; review and commit them with the corpus change\n");
    return 0;
  }
  io.print(
    "usage:\n  replay-approvals check [--base <ref>]\n  replay-approvals propose --cause <text> --migration <text> [--base <ref>]\n",
  );
  return 2;
}
