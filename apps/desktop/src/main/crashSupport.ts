// Crash / error observability (release-readiness ticket 02, ADR-0133): a
// local-only support bundle. When the main or renderer process hits an
// uncaught error, we write a small, user-shareable JSON bundle beside the
// app's user data and tell the user where it is — never silently swallowing a
// failure, and never making a network call (reporting is opt-in only; nothing
// here sends anything anywhere).
//
// Pure policy, kept apart from `index.ts` like `shellPolicy.ts`, so the bundle
// shape and the crash wiring are unit-tested without launching Electron. The
// clock and log are injected; the bundle is not authoritative state and is
// allowed a wall-clock timestamp.
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Result, Schema } from "effect";

export interface CrashContext {
  /** Where bundles are written (main passes `<userData>/support`). */
  readonly bundleDir: string;
  readonly appVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly processId: number;
  /** The user's home directory, redacted out of messages and stacks. */
  readonly homeDir: string;
  /** Injected so the filename/timestamp are deterministic under test. */
  readonly now: () => Date;
  /** Where "could not write the bundle" is reported (main passes console.error). */
  readonly log: (message: string) => void;
  /**
   * Optional write limiter (production passes one). A render loop can emit
   * thousands of identical errors; the limiter dedups and caps writes.
   */
  readonly limiter?: CrashLimiter;
  /** Bundles kept on disk before the oldest are pruned. Defaults to 20. */
  readonly maxBundles?: number;
}

export interface CrashDetails {
  readonly message: string;
  readonly stack?: string;
}

export type CrashSource = "main" | "renderer";
/** Main-process failure kinds. */
export type MainCrashKind = "uncaughtException" | "unhandledRejection";
/** Renderer failure kinds (the DOM event vocabulary). */
export type RendererCrashKind = "window-error" | "unhandledrejection";
export type CrashKind = MainCrashKind | RendererCrashKind;

export interface CrashReport extends CrashDetails {
  readonly source: CrashSource;
  readonly kind: CrashKind;
  readonly appVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly processId: number;
  readonly timestamp: string;
  /** Set only for renderer reports: the kind the renderer classified it as. */
  readonly note: string;
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

const MAX_MESSAGE = 8_000;
const MAX_STACK = 64_000;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…[truncated]`;
}

/**
 * Redact the user's home directory and username segments from a crash string.
 * Stack traces routinely embed absolute paths like `/Users/<name>/…`; the
 * support bundle is user-shareable, so the username should not ride along.
 */
export function redactText(text: string, homeDir: string): string {
  let out = text;
  if (homeDir !== "") {
    for (const variant of new Set([
      homeDir,
      homeDir.replace(/\\/gu, "/"),
      homeDir.replace(/\//gu, "\\"),
    ])) {
      if (variant !== "") out = out.split(variant).join("~");
    }
  }
  // Any remaining `<...>/Users/<name>` or `<...>/home/<name>` segment.
  return out.replace(/([/\\](?:Users|home)[/\\])[^/\\\s:]+/gu, "$1[user]");
}

/** A best-effort `{message, stack}` from anything a crash handler can receive. */
export function detailsFromError(error: unknown): CrashDetails {
  if (error instanceof Error) {
    return error.stack !== undefined
      ? { message: error.message, stack: error.stack }
      : { message: error.message };
  }
  return { message: safeStringify(error) };
}

/** Filesystem-safe form of an ISO timestamp (`:` and `.` are unsafe on Windows). */
export function bundleFilename(timestamp: string, processId: number): string {
  return `crash-${timestamp.replace(/[.:]/gu, "-")}-${String(processId)}.json`;
}

export function buildCrashReport(
  source: CrashSource,
  kind: CrashKind,
  details: CrashDetails,
  ctx: Pick<CrashContext, "appVersion" | "platform" | "arch" | "processId" | "homeDir" | "now">,
): CrashReport {
  const timestamp = ctx.now().toISOString();
  const message = truncate(redactText(details.message, ctx.homeDir), MAX_MESSAGE);
  const stack =
    details.stack !== undefined
      ? truncate(redactText(details.stack, ctx.homeDir), MAX_STACK)
      : undefined;
  return {
    source,
    kind,
    message,
    ...(stack !== undefined ? { stack } : {}),
    appVersion: ctx.appVersion,
    platform: ctx.platform,
    arch: ctx.arch,
    processId: ctx.processId,
    timestamp,
    note:
      "Local-only support bundle (ADR-0133). No network reporting; nothing is sent anywhere. " +
      "Share this file with a maintainer to report the failure.",
  };
}

/**
 * Decides whether a crash write is allowed. A render loop or a repeating
 * exception can otherwise emit unbounded bundles; the limiter caps writes per
 * time window and dedups an identical crash within a longer window.
 */
export interface CrashLimiter {
  allowed(key: string): boolean;
}

export interface CrashLimiterOptions {
  /** Max allowed writes per window. */
  readonly maxPerWindow: number;
  /** Window over which `maxPerWindow` applies, in ms. */
  readonly windowMs: number;
  /** Suppress an identical key repeated within this window, in ms. */
  readonly dedupWindowMs: number;
  /** Injectable clock. */
  readonly now?: () => number;
}

export function createCrashLimiter(options: CrashLimiterOptions): CrashLimiter {
  const now = options.now ?? (() => Date.now());
  const recent = new Map<string, number>();
  let windowStart = now();
  let windowCount = 0;
  return {
    allowed(key: string): boolean {
      const at = now();
      if (at - windowStart >= options.windowMs) {
        windowStart = at;
        windowCount = 0;
        recent.clear();
      }
      if (windowCount >= options.maxPerWindow) return false;
      const last = recent.get(key);
      if (last !== undefined && at - last < options.dedupWindowMs) return false;
      recent.set(key, at);
      windowCount += 1;
      return true;
    },
  };
}

const BUNDLE_RE = /^crash-.*\.json$/u;

/** Keep only the newest `max` bundle files; best-effort, never throws. */
function pruneBundles(dir: string, max: number): void {
  try {
    const bundles = readdirSync(dir)
      .filter((name) => BUNDLE_RE.test(name))
      .sort()
      .reverse();
    for (const stale of bundles.slice(max)) {
      try {
        unlinkSync(join(dir, stale));
      } catch {
        // A concurrent handler may have removed it; ignore.
      }
    }
  } catch {
    // Directory listing failed; nothing to prune.
  }
}

/**
 * Build and write a support bundle. Returns the written path, or `null` when the
 * write was suppressed by the limiter or failed (a crash handler must not
 * crash): both are reported through `ctx.log` so nothing is hidden.
 */
export function captureCrash(
  source: CrashSource,
  kind: CrashKind,
  details: CrashDetails,
  ctx: CrashContext,
): string | null {
  const key = `${source}|${kind}|${details.message}`;
  if (ctx.limiter !== undefined && !ctx.limiter.allowed(key)) {
    ctx.log(`[crash] support bundle suppressed by rate limit (${source}/${kind})`);
    return null;
  }
  const report = buildCrashReport(source, kind, details, ctx);
  const path = join(ctx.bundleDir, bundleFilename(report.timestamp, report.processId));
  try {
    mkdirSync(ctx.bundleDir, { recursive: true });
    writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    if (!existsSync(path)) throw new Error("bundle file was not created");
    pruneBundles(ctx.bundleDir, ctx.maxBundles ?? 20);
    return path;
  } catch (error) {
    ctx.log(`[crash] could not write the support bundle at ${path}: ${safeStringify(error)}`);
    return null;
  }
}

/** Only the parts of `EventEmitter` the installer uses, so tests can fake it. */
export interface CrashEmitter {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  off(event: string, listener: (...args: unknown[]) => void): unknown;
}

/**
 * Install `uncaughtException` / `unhandledRejection` handlers that capture a
 * bundle and then call `onFatal` (which must surface the failure and is expected
 * to quit). Returns an uninstall function. `emitter` defaults to the process and
 * is injectable for tests.
 */
export function installProcessCrashHandlers(
  ctx: CrashContext,
  onFatal: (error: unknown, bundlePath: string | null) => void,
  emitter: CrashEmitter = process,
): () => void {
  const onUncaught = (...args: unknown[]): void => {
    const error = args[0];
    const path = captureCrash("main", "uncaughtException", detailsFromError(error), ctx);
    onFatal(error, path);
  };
  const onRejection = (...args: unknown[]): void => {
    const reason = args[0];
    const path = captureCrash("main", "unhandledRejection", detailsFromError(reason), ctx);
    onFatal(reason, path);
  };
  emitter.on("uncaughtException", onUncaught);
  emitter.on("unhandledRejection", onRejection);
  return () => {
    emitter.off("uncaughtException", onUncaught);
    emitter.off("unhandledRejection", onRejection);
  };
}

/** The renderer's crash payload, validated at the IPC boundary (ENGINEERING-CONTRACT). */
export const RendererCrashInputSchema = Schema.Struct({
  kind: Schema.Literals(["window-error", "unhandledrejection"]),
  message: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(8_000)),
  stack: Schema.optional(Schema.String.check(Schema.isMaxLength(64_000))),
});

export interface RendererCrashInput {
  readonly kind: "window-error" | "unhandledrejection";
  readonly message: string;
  readonly stack?: string;
}

/** Decode a renderer crash payload; `null` when it is not the expected shape. */
export function parseRendererCrashInput(value: unknown): RendererCrashInput | null {
  const decoded = Schema.decodeUnknownResult(RendererCrashInputSchema)(value);
  return Result.isSuccess(decoded) ? decoded.success : null;
}
