import { canonicalSerialize, hashWithContext } from "@bluewave/deterministic";
import { Result } from "effect";

import {
  ApprovalsError,
  REPLAY_APPROVALS_SCHEMA,
  decodeApprovals,
  proposeApprovals,
  type ApprovalEntry,
  type CorpusState,
  type ProposalInput,
} from "./approvals.js";

export const APPROVALS_DIR = "golden/replay-approvals";
export const LEGACY_APPROVALS_FILE = "golden/replay-approvals.json";
export const APPROVAL_FILE_SUFFIX = ".json";

const FILE_NAME_CONTEXT = "bluewave/replay-corpus/approval-file-name/v1";

export interface ApprovalFileProposal {
  readonly name: string;
  readonly text: string;
}

export function mergeApprovalFiles(
  files: ReadonlyMap<string, string>,
): Result.Result<string | undefined, ApprovalsError> {
  if (files.size === 0) return Result.succeed(undefined);
  const entries: ApprovalEntry[] = [];
  for (const [name, text] of [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const decoded = decodeApprovals(text);
    if (Result.isFailure(decoded)) {
      return Result.fail(new ApprovalsError({ message: `${name}: ${decoded.failure.message}` }));
    }
    entries.push(...decoded.success.entries);
  }
  const text = `${canonicalSerialize({ schema: REPLAY_APPROVALS_SCHEMA, entries })}\n`;
  const checked = decodeApprovals(text);
  return Result.isFailure(checked) ? Result.fail(checked.failure) : Result.succeed(text);
}

export function proposeApprovalFile(
  base: CorpusState,
  head: CorpusState,
  input: ProposalInput,
): Result.Result<ApprovalFileProposal | undefined, ApprovalsError> {
  const full = proposeApprovals(base, head, input);
  if (Result.isFailure(full)) return Result.fail(full.failure);
  const existing = decodeApprovals(head.approvals);
  if (Result.isFailure(existing)) return Result.fail(existing.failure);
  const all = decodeApprovals(full.success);
  if (Result.isFailure(all)) return Result.fail(all.failure);
  const added = all.success.entries.slice(existing.success.entries.length);
  if (added.length === 0) return Result.succeed(undefined);
  const text = `${canonicalSerialize({ schema: REPLAY_APPROVALS_SCHEMA, entries: added })}\n`;
  const digest = hashWithContext(text, FILE_NAME_CONTEXT).slice(0, 12);
  return Result.succeed({ name: `${digest}${APPROVAL_FILE_SUFFIX}`, text });
}
