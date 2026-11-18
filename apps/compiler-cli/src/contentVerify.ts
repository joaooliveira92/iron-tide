import {
  CONTENT_LOCK_FILENAME,
  buildContentBundleArtifact,
  verifyContentLock,
} from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { Effect } from "effect";
import { resolve } from "node:path";
import {
  buildContentSurfaceInput,
  isUnknownRecord,
  printDiagnostics,
  printResult,
  readFileOption,
  type CliOptions,
  type ExitCategory,
} from "./commands.js";
import { CliFileSystem } from "./runtime/cliFileSystem.js";
import type { CliEnv } from "./runtime/cliLayer.js";

export const runContentVerify = (options: CliOptions): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const collector = new DiagnosticCollector();
    const input = yield* buildContentSurfaceInput(options, collector);
    if (!input) return "usage-error";
    const artifact = buildContentBundleArtifact(input, new AbortController().signal, collector);
    yield* printDiagnostics(collector, options.outputMode);
    if (collector.hasErrors) return "validation-error";
    if (!artifact) return "compile-error";

    const lockPath = resolve(options.contentDir, CONTENT_LOCK_FILENAME);
    if (!(yield* fs.exists(lockPath))) {
      collector.addError("CONTENT-LOCK", `Content lock not found: ${lockPath}`, {
        stage: "validate",
      });
      yield* printDiagnostics(collector, options.outputMode);
      return "usage-error";
    }
    const lockText = yield* readFileOption(fs, lockPath);
    let lock: unknown;
    try {
      lock = JSON.parse(lockText ?? "");
    } catch {
      collector.addError("CONTENT-LOCK", `Failed to parse content lock: ${lockPath}`, {
        stage: "validate",
      });
      yield* printDiagnostics(collector, options.outputMode);
      return "usage-error";
    }

    if (options.lockMode === "write") {
      const current = isUnknownRecord(lock) ? lock : {};
      yield* fs.writeFile(
        lockPath,
        `${JSON.stringify({ ...current, bodyHash: artifact.envelope.bodyHash }, null, 2)}\n`,
      );
      lock = { ...current, bodyHash: artifact.envelope.bodyHash };
    }

    if (options.lockMode === undefined) {
      const again = buildContentBundleArtifact(
        input,
        new AbortController().signal,
        new DiagnosticCollector(),
      );
      if (again?.envelope.bodyHash !== artifact.envelope.bodyHash) {
        collector.addError(
          "CONTENT-LOCK",
          `Content build is not reproducible: two builds produced '${artifact.envelope.bodyHash}' and '${again?.envelope.bodyHash ?? "no artifact"}'.`,
          { stage: "validate" },
        );
        yield* printDiagnostics(collector, options.outputMode);
        return "validation-error";
      }
    }

    const verification = verifyContentLock(
      artifact,
      lock,
      options.lockMode === undefined ? "dev" : "release",
    );
    if (!verification.ok) {
      collector.addError("CONTENT-LOCK", verification.message, {
        stage: "validate",
        sourceLocation: { path: CONTENT_LOCK_FILENAME, line: 1 },
        remediation:
          verification.code === "CONTENT_LOCK_HASH_MISMATCH" ||
          verification.code === "CONTENT_LOCK_HASH_MISSING"
            ? "Run pnpm content:lock to record the new hash before promoting to main"
            : undefined,
      });
      yield* printDiagnostics(collector, options.outputMode);
      return "validation-error";
    }

    if (options.outputMode === "json") {
      yield* printResult(
        JSON.stringify({
          contentVersion: artifact.contentVersion,
          contentHash: artifact.envelope.bodyHash,
          lockPath,
          verified: true,
        }),
      );
    } else {
      yield* printResult("Content lock verified");
      yield* printResult(`  Content version: ${artifact.contentVersion}`);
      yield* printResult(`  Content hash: ${artifact.envelope.bodyHash}`);
      yield* printResult(`  Lock: ${lockPath}`);
    }
    return "success";
  });
