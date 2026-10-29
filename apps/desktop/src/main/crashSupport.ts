import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Result, Schema } from "effect";

export interface CrashContext {
  readonly bundleDir: string;
  readonly appVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly processId: number;
  readonly homeDir: string;
  readonly now: () => Date;
  readonly log: (message: string) => void;
  readonly limiter?: CrashLimiter;
  readonly maxBundles?: number;
}

export interface CrashDetails {
  readonly message: string;
  readonly stack?: string;
}

export type CrashSource = "main" | "renderer";
export type MainCrashKind = "uncaughtException" | "unhandledRejection";
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
  return out.replace(/([/\\](?:Users|home)[/\\])[^/\\\s:]+/gu, "$1[user]");
}

export function detailsFromError(error: unknown): CrashDetails {
  if (error instanceof Error) {
    return error.stack !== undefined
      ? { message: error.message, stack: error.stack }
      : { message: error.message };
  }
  return { message: safeStringify(error) };
}

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

export interface CrashLimiter {
  allowed(key: string): boolean;
}

export interface CrashLimiterOptions {
  readonly maxPerWindow: number;
  readonly windowMs: number;
  readonly dedupWindowMs: number;
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

function pruneBundles(dir: string, max: number): void {
  try {
    const bundles = readdirSync(dir)
      .filter((name) => BUNDLE_RE.test(name))
      .sort()
      .reverse();
    for (const stale of bundles.slice(max)) {
      try {
        unlinkSync(join(dir, stale));
      } catch {}
    }
  } catch {}
}

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

export interface CrashEmitter {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  off(event: string, listener: (...args: unknown[]) => void): unknown;
}

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

export function parseRendererCrashInput(value: unknown): RendererCrashInput | null {
  const decoded = Schema.decodeUnknownResult(RendererCrashInputSchema, {
    onExcessProperty: "error",
  })(value);
  return Result.isSuccess(decoded) ? decoded.success : null;
}
