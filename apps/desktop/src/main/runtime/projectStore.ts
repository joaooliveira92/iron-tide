import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import { createEnvelope } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore, type SaveExtras, type SaveMetadata } from "@bluewave/persistence";
import { Context, Effect, Layer, Result, Schema } from "effect";
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import {
  SESSION_METADATA_FILENAME,
  SessionMetadataSchema,
  type SessionMetadata,
} from "../campaignSessionMetadata.js";
import { toSaveableState } from "../saveHelpers.js";
import { CommandFailed } from "./commandError.js";

function failure(reason: string, error: unknown): CommandFailed {
  return new CommandFailed({
    reason,
    diagnostics: [error instanceof Error ? error.message : String(error)],
  });
}

function writeSessionMetadata(saveDir: string, metadata: SessionMetadata): void {
  const target = join(saveDir, SESSION_METADATA_FILENAME);
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(metadata, null, 2), "utf8");
  renameSync(tmp, target);
}

function readSessionMetadata(saveDir: string): SessionMetadata | null {
  const target = join(saveDir, SESSION_METADATA_FILENAME);
  if (!existsSync(target)) return null;
  try {
    const parsed = Schema.decodeUnknownResult(SessionMetadataSchema)(
      JSON.parse(readFileSync(target, "utf8")),
    );
    return Result.isSuccess(parsed) ? parsed.success : null;
  } catch {
    return null;
  }
}

export interface LoadedMonthInput {
  readonly status: "present" | "missing" | "corrupt";
  readonly value?: unknown;
}

export interface CopyTargetProblem {
  readonly reason: string;
  readonly message: string;
}

function canonicalPath(path: string): string {
  let existing = resolve(path);
  const rest: string[] = [];
  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break;
    rest.unshift(basename(existing));
    existing = parent;
  }
  return join(existsSync(existing) ? realpathSync(existing) : existing, ...rest);
}

function assessCopyTarget(source: string, target: string): CopyTargetProblem | null {
  const from = canonicalPath(source);
  const to = canonicalPath(target);
  if (to === from) {
    return {
      reason: "COPY_TARGET_IS_SOURCE",
      message: "Choose a different location for the copy.",
    };
  }
  if (to.startsWith(from + sep)) {
    return {
      reason: "COPY_TARGET_INSIDE_SOURCE",
      message: "The copy cannot be placed inside the campaign it copies.",
    };
  }
  if (from.startsWith(to + sep)) {
    return {
      reason: "COPY_TARGET_CONTAINS_SOURCE",
      message: "The copy cannot be placed in a folder that contains the campaign it copies.",
    };
  }
  if (existsSync(to)) {
    if (!statSync(to).isDirectory()) {
      return { reason: "COPY_TARGET_NOT_A_DIRECTORY", message: "The chosen location is a file." };
    }
    if (readdirSync(to).length > 0) {
      return {
        reason: "COPY_TARGET_NOT_EMPTY",
        message:
          "The chosen folder is not empty. Choose a new or empty folder so nothing is overwritten.",
      };
    }
  }
  return null;
}

export class ProjectStore extends Context.Service<
  ProjectStore,
  {
    readonly isCurrent: (
      state: CampaignState,
      saveDir: string,
    ) => Effect.Effect<boolean, CommandFailed>;
    readonly save: (
      state: CampaignState,
      saveDir: string,
      extras?: SaveExtras,
    ) => Effect.Effect<SaveMetadata, CommandFailed>;
    readonly load: (
      saveDir: string,
      collector: DiagnosticCollector,
    ) => Effect.Effect<CampaignState | null, CommandFailed>;
    readonly list: (saveDir: string) => Effect.Effect<readonly SaveMetadata[], CommandFailed>;
    readonly loadById: (
      saveDir: string,
      saveId: string,
      collector: DiagnosticCollector,
    ) => Effect.Effect<CampaignState | null, CommandFailed>;
    readonly loadMonthInput: (
      saveDir: string,
      saveId: string,
      collector: DiagnosticCollector,
    ) => Effect.Effect<LoadedMonthInput, CommandFailed>;
    readonly getActiveSaveId: (saveDir: string) => Effect.Effect<string | null, CommandFailed>;
    readonly getPreviousSaveId: (saveDir: string) => Effect.Effect<string | null, CommandFailed>;
    readonly readSessionMetadata: (
      saveDir: string,
    ) => Effect.Effect<SessionMetadata | null, CommandFailed>;
    readonly writeSessionMetadata: (
      saveDir: string,
      metadata: SessionMetadata,
    ) => Effect.Effect<void, CommandFailed>;
    readonly assessCopyTarget: (
      source: string,
      target: string,
    ) => Effect.Effect<CopyTargetProblem | null, CommandFailed>;
    readonly persistConstructionSnapshot: (
      record: CampaignSessionRecord,
      mutate: (snapshot: CampaignSnapshot) => CampaignSnapshot,
    ) => Effect.Effect<CampaignState, CommandFailed>;
  }
>()("bluewave/desktop/ProjectStore") {}

export function projectStoreLayer(): Layer.Layer<ProjectStore> {
  const store = new SaveStore();
  return Layer.succeed(ProjectStore, {
    isCurrent: (state, saveDir) =>
      Effect.try({
        try: () => store.isCurrent(state, saveDir),
        catch: (e) => failure("SAVE_FAILED", e),
      }),
    save: (state, saveDir, extras) =>
      Effect.try({
        try: () => store.save(state, saveDir, undefined, extras).metadata,
        catch: (e) => failure("SAVE_FAILED", e),
      }),
    load: (saveDir, collector) =>
      Effect.try({
        try: () => store.load(saveDir, collector),
        catch: (e) => failure("LOAD_FAILED", e),
      }),
    list: (saveDir) =>
      Effect.try({
        try: () => store.list(saveDir),
        catch: (e) => failure("LOAD_FAILED", e),
      }),
    loadById: (saveDir, saveId, collector) =>
      Effect.try({
        try: () => store.loadById(saveDir, saveId, collector),
        catch: (e) => failure("LOAD_FAILED", e),
      }),
    loadMonthInput: (saveDir, saveId, collector) =>
      Effect.try({
        try: () => {
          const stored = store.loadMonthInput(saveDir, saveId, collector);
          if (stored.status === "present") {
            return { status: "present" as const, value: stored.value };
          }
          return {
            status: stored.status === "corrupt" ? ("corrupt" as const) : ("missing" as const),
          };
        },
        catch: (e) => failure("LOAD_FAILED", e),
      }),
    getActiveSaveId: (saveDir) =>
      Effect.try({
        try: () => store.getActiveSaveId(saveDir),
        catch: (e) => failure("LOAD_FAILED", e),
      }),
    getPreviousSaveId: (saveDir) =>
      Effect.try({
        try: () => store.getPreviousSaveId(saveDir),
        catch: (e) => failure("LOAD_FAILED", e),
      }),
    readSessionMetadata: (saveDir) =>
      Effect.try({
        try: () => readSessionMetadata(saveDir),
        catch: (e) => failure("SESSION_METADATA_INVALID", e),
      }),
    writeSessionMetadata: (saveDir, metadata) =>
      Effect.try({
        try: () => {
          writeSessionMetadata(saveDir, metadata);
        },
        catch: (e) => failure("SAVE_FAILED", e),
      }),
    assessCopyTarget: (source, target) =>
      Effect.try({
        try: () => assessCopyTarget(source, target),
        catch: (e) => failure("COPY_TARGET_READ_FAILED", e),
      }),
    persistConstructionSnapshot: (record, mutate) =>
      Effect.gen(function* () {
        const nextSnapshot = mutate(record.state.snapshot);
        const nextEnvelope = createEnvelope(
          "campaign-snapshot",
          nextSnapshot.compatibilityVersion,
          nextSnapshot,
        );
        const nextState: CampaignState = toSaveableState({
          snapshot: nextSnapshot,
          envelope: nextEnvelope,
          rawHash: record.state.rawHash,
        });
        yield* Effect.try({
          try: () => {
            store.save(nextState, record.saveDir);
          },
          catch: (e) => failure("SAVE_FAILED", e),
        });
        return nextState;
      }),
  });
}
