import {
  Compiler,
  CONTENT_LOCK_FILENAME,
  buildContentBundleArtifact,
  buildFullSurfaceInput,
  countConfidence,
  verifyContentLock,
  writeContentBundleArtifact,
  checkPlaceholderGate,
  type ConfidenceCounts,
  type PlaceholderAllowlistEntry,
} from "@bluewave/content-compiler";
import type { CompilerInput } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve, join } from "node:path";
import {
  canonicalSerialize,
  sha256Hex,
  createEnvelope,
  verifyEnvelope,
  type CanonicalEnvelope,
} from "@bluewave/deterministic";
import { CampaignCompiler, type CampaignCompilerInput } from "@bluewave/campaign/compiler";
import {
  SaveStore,
  CURRENT_COMPATIBILITY_VERSION,
  StorableCampaignStateSchema,
  fromStorableSnapshot,
  type StorableCampaignSnapshot,
} from "@bluewave/persistence";
import { Effect, Result, Schema, SchemaIssue } from "effect";
import type {
  CampaignState,
  CampaignSnapshot,
  NationState,
  BattleInstance,
  BattleManifest,
} from "@bluewave/campaign";
import type { CommandEnvelope, CommandBody, CommandOutcome } from "@bluewave/commands";
import { CommandLedger } from "@bluewave/commands";
import {
  MonthExecutor,
  ReplayVerifier,
  resolveCampaignBattleReadiness,
  resolveShipStrength,
} from "@bluewave/phase-engine";
import {
  advance,
  generate,
  type BattleGenerationResult,
  type MinuteResult,
} from "@bluewave/combat";
import {
  AMMUNITION_TYPES,
  resolveAccuracy,
  resolveHit,
  reserveAndConsumeAmmunition,
  type AccuracyResolution,
  type AmmunitionReserve,
  type AmmunitionType,
  type GunneryAccuracyFactors,
  type KeyedHitDraw,
} from "@bluewave/combat/gunnery";
import type { UnitOrders } from "@bluewave/combat/simulation";
import type { TacticalBattleState } from "@bluewave/combat/tactical";
import { RandomEngine } from "@bluewave/random";
import { runCombatOperation } from "./combatDiagnostics.js";
import { safePath } from "./safePath.js";
import { CliConsole } from "./runtime/cliConsole.js";
import { CliFileSystem, type CliFileSystemShape } from "./runtime/cliFileSystem.js";
import type { CliEnv } from "./runtime/cliLayer.js";

export { safePath } from "./safePath.js";

export type OutputMode = "human" | "json";
export type ExitCategory =
  | "success"
  | "validation-error"
  | "compile-error"
  | "aborted"
  | "internal-error"
  | "usage-error";

export interface CliOptions {
  manifest: string;
  contentDir: string;
  outputDir: string;
  outputMode: OutputMode;
}

const STRICT_DECODE_OPTIONS = { onExcessProperty: "error" } as const;

const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const schemaFormatter = SchemaIssue.makeFormatterStandardSchemaV1();

const describeSchemaFailure = (error: Schema.SchemaError): string =>
  schemaFormatter(error.issue)
    .issues.map((issue) => {
      const path = (issue.path ?? []).filter(
        (key): key is string | number => typeof key === "string" || typeof key === "number",
      );
      return path.length > 0 ? `${path.join(".")}: ${issue.message}` : issue.message;
    })
    .join("; ");

const CANONICAL_ENVELOPE_FIELDS: ReadonlySet<string> = new Set([
  "algorithm",
  "artifactKind",
  "compatibilityVersion",
  "bodyHash",
  "bodyLength",
]);

const CanonicalEnvelopeSchema: Schema.declare<CanonicalEnvelope> =
  Schema.declare<CanonicalEnvelope>(
    (value): value is CanonicalEnvelope =>
      isUnknownRecord(value) &&
      Object.keys(value).every((key) => CANONICAL_ENVELOPE_FIELDS.has(key)) &&
      typeof value.bodyHash === "string" &&
      (value.algorithm === undefined || typeof value.algorithm === "string") &&
      (value.artifactKind === undefined || typeof value.artifactKind === "string") &&
      (value.compatibilityVersion === undefined ||
        typeof value.compatibilityVersion === "string") &&
      (value.bodyLength === undefined || typeof value.bodyLength === "number"),
    { expected: "canonical envelope carrying a string bodyHash" },
  );

const CommandBodySchema: Schema.declare<CommandBody> = Schema.declare<CommandBody>(
  (value): value is CommandBody => isUnknownRecord(value),
  { expected: "command body object (validated by CommandLifecycle)" },
);

const CommandEnvelopeSchema = Schema.Struct({
  commandId: Schema.String,
  version: Schema.String,
  expectedSnapshotHash: Schema.String,
  idempotencyKey: Schema.String,
  timestamp: Schema.String,
  body: CommandBodySchema,
  signature: Schema.optional(Schema.String),
  issuerClass: Schema.optional(Schema.Literals(["PLAYER", "AI", "SYSTEM_AUTOMATION"])),
  issuerParticipantId: Schema.optional(Schema.String),
});

const CommandEnvelopeListSchema = Schema.Array(CommandEnvelopeSchema);

const printDiagnostics = (
  collector: DiagnosticCollector,
  mode: OutputMode,
): Effect.Effect<void, never, CliConsole> =>
  Effect.gen(function* () {
    const console = yield* CliConsole;
    if (mode === "json") {
      yield* console.out(collector.toJSON() + "\n");
    } else {
      const text = collector.toHuman();
      if (text) yield* console.out(text + "\n");
    }
  });

const printResult = (message: string): Effect.Effect<void, never, CliConsole> =>
  Effect.gen(function* () {
    const console = yield* CliConsole;
    yield* console.out(message + "\n");
  });

const runWriteBlock = (
  fs: CliFileSystemShape,
  temps: ReadonlyArray<string>,
  write: Effect.Effect<void>,
): Effect.Effect<void> =>
  write.pipe(Effect.ensuring(Effect.forEach(temps, (path) => fs.remove(path), { discard: true })));

const readFileOption = (fs: CliFileSystemShape, path: string): Effect.Effect<string | undefined> =>
  fs.readFile(path).pipe(Effect.catchTag("CliFileSystemError", () => Effect.succeed(undefined)));

export const runValidate = (options: CliOptions): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const collector = new DiagnosticCollector();
    const input = yield* buildInput(options, collector);
    if (!input) return "usage-error";
    const compiler = new Compiler();
    const signal = new AbortController().signal;
    const output = compiler.compile(input, signal, collector);
    yield* printDiagnostics(collector, options.outputMode);
    if (collector.hasErrors) return "validation-error";
    if (!output) return "compile-error";
    yield* printResult("Validation passed");
    return "success";
  });

export const runCompile = (options: CliOptions): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const collector = new DiagnosticCollector();
    const input = yield* buildInput(options, collector);
    if (!input) return "usage-error";
    const compiler = new Compiler();
    const signal = new AbortController().signal;
    const output = compiler.compile(input, signal, collector);
    yield* printDiagnostics(collector, options.outputMode);
    if (collector.hasErrors) return "validation-error";
    if (!output) return "compile-error";
    const outDir = resolve(options.outputDir);
    yield* fs.makeDirectory(outDir);
    const envelope = createEnvelope("content-pack", "0.1.0", output.pack);
    const artifactPath = resolve(outDir, "artifact.json");
    const envelopePath = resolve(outDir, "artifact.sig.json");
    const tempArtifact = artifactPath + ".tmp";
    const tempEnvelope = envelopePath + ".tmp";
    const artifactJson = canonicalSerialize(output.pack);
    const envelopeJson = canonicalSerialize(envelope);
    const write = Effect.gen(function* () {
      yield* fs.writeFile(tempArtifact, artifactJson);
      yield* fs.writeFile(tempEnvelope, envelopeJson);
      yield* fs.remove(artifactPath);
      yield* fs.remove(envelopePath);
      yield* fs.writeFile(artifactPath, artifactJson);
      yield* fs.writeFile(envelopePath, envelopeJson);
    });
    yield* runWriteBlock(fs, [tempArtifact, tempEnvelope], write);
    if (options.outputMode === "json") {
      yield* printResult(
        JSON.stringify({
          artifactHash: output.rawHash,
          envelopeHash: output.envelopeHash,
          artifactPath,
          envelopePath,
        }),
      );
    } else {
      yield* printResult(`Compiled successfully`);
      yield* printResult(`  Artifact: ${artifactPath} (SHA-256: ${output.rawHash})`);
      yield* printResult(`  Envelope: ${envelopePath} (SHA-256: ${output.envelopeHash})`);
    }
    return "success";
  });

interface ArtifactInspect {
  readonly artifactJson: string;
  readonly envelope: CanonicalEnvelope;
  readonly computedHash: string;
  readonly valid: boolean;
}

const parseArtifactPair = (
  artifactJson: string,
  envelopeJson: string,
):
  | { readonly ok: true; readonly value: ArtifactInspect }
  | { readonly ok: false; readonly message: string } => {
  try {
    const decoded = Schema.decodeUnknownResult(CanonicalEnvelopeSchema)(JSON.parse(envelopeJson));
    if (Result.isFailure(decoded)) {
      return { ok: false, message: describeSchemaFailure(decoded.failure) };
    }
    const envelope = decoded.success;
    const computedHash = sha256Hex(artifactJson);
    const valid = computedHash === envelope.bodyHash;
    return { ok: true, value: { artifactJson, envelope, computedHash, valid } };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
};

export const runInspect = (options: CliOptions): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const artifactPath = resolve(options.outputDir, "artifact.json");
    const envelopePath = resolve(options.outputDir, "artifact.sig.json");
    if (!(yield* fs.exists(artifactPath))) {
      yield* printResult(`Artifact not found at ${artifactPath}`);
      return "usage-error";
    }
    if (!(yield* fs.exists(envelopePath))) {
      yield* printResult(`Envelope not found at ${envelopePath}`);
      return "usage-error";
    }
    const outcome = yield* Effect.gen(function* () {
      const artifactJson = yield* fs.readFile(artifactPath);
      const envelopeJson = yield* fs.readFile(envelopePath);
      return parseArtifactPair(artifactJson, envelopeJson);
    }).pipe(
      Effect.catchTag("CliFileSystemError", (error) =>
        Effect.succeed({ ok: false as const, message: error.message }),
      ),
    );
    if (!outcome.ok) {
      yield* printResult(`Failed to inspect: ${outcome.message}`);
      return "internal-error";
    }
    const { artifactJson, envelope, computedHash, valid } = outcome.value;
    if (options.outputMode === "json") {
      yield* printResult(JSON.stringify({ artifactHash: computedHash, envelope, valid }, null, 2));
    } else {
      yield* printResult(`Artifact: ${artifactPath}`);
      yield* printResult(`  Size: ${Buffer.byteLength(artifactJson, "utf8")} bytes`);
      yield* printResult(`  SHA-256: ${computedHash}`);
      yield* printResult(`Envelope:`);
      yield* printResult(`  Algorithm: ${envelope.algorithm}`);
      yield* printResult(`  Kind: ${envelope.artifactKind}`);
      yield* printResult(`  Version: ${envelope.compatibilityVersion}`);
      yield* printResult(`  Body Hash: ${envelope.bodyHash}`);
      yield* printResult(`  Body Length: ${envelope.bodyLength}`);
      yield* printResult(`  Status: ${valid ? "VALID" : "INVALID - hash mismatch"}`);
    }
    return valid ? "success" : "validation-error";
  });

export const runVerify = runInspect;

export const runCompare = (options: CliOptions): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const artifactPath = resolve(options.outputDir, "artifact.json");
    const envelopePath = resolve(options.outputDir, "artifact.sig.json");
    if (!(yield* fs.exists(artifactPath))) {
      yield* printResult(`Artifact not found at ${artifactPath}`);
      return "usage-error";
    }
    const outcome = yield* Effect.gen(function* () {
      const artifactJson = yield* fs.readFile(artifactPath);
      const envelopeJson = yield* fs.readFile(envelopePath);
      let artifact: unknown;
      let envelope: CanonicalEnvelope;
      try {
        artifact = JSON.parse(artifactJson);
        const decoded = Schema.decodeUnknownResult(CanonicalEnvelopeSchema)(
          JSON.parse(envelopeJson),
        );
        if (Result.isFailure(decoded)) {
          return { ok: false as const, message: describeSchemaFailure(decoded.failure) };
        }
        envelope = decoded.success;
      } catch (err) {
        return { ok: false as const, message: err instanceof Error ? err.message : String(err) };
      }
      const computedHash = sha256Hex(artifactJson);
      const valid = verifyEnvelope(envelope, artifact);
      return { ok: true as const, envelope, computedHash, valid };
    }).pipe(
      Effect.catchTag("CliFileSystemError", (error) =>
        Effect.succeed({ ok: false as const, message: error.message }),
      ),
    );
    if (!outcome.ok) {
      yield* printResult(`Failed to compare: ${outcome.message}`);
      return "internal-error";
    }
    const { envelope, computedHash, valid } = outcome;
    if (options.outputMode === "json") {
      yield* printResult(
        JSON.stringify(
          {
            recomputedHash: computedHash,
            envelopeBodyHash: envelope.bodyHash,
            hashMatch: computedHash === envelope.bodyHash,
            envelopeValid: valid,
          },
          null,
          2,
        ),
      );
    } else {
      yield* printResult(`Comparison:`);
      yield* printResult(`  Re-computed SHA-256: ${computedHash}`);
      yield* printResult(`  Envelope bodyHash:   ${envelope.bodyHash}`);
      yield* printResult(
        `  Hash match:          ${computedHash === envelope.bodyHash ? "YES" : "NO"}`,
      );
      yield* printResult(`  Envelope valid:      ${valid ? "YES" : "NO"}`);
    }
    return valid ? "success" : "validation-error";
  });

export interface CampaignCliOptions extends CliOptions {
  saveDir: string;
  seed: string;
  commandsPath?: string;
}

export interface BattleGenerateCliOptions extends CampaignCliOptions {
  campaignMonth?: string;
  rngVersion: string;
  formulaVersion: string;
  rulesetVersion?: string;
  contentVersion: string;
}

export interface BattleAdvanceMinuteCliOptions {
  outputMode: OutputMode;
  statePath?: string;
  minute: number;
  observationTime: string;
}

interface BattleAdvanceMinuteFile {
  state: TacticalBattleState;
  orders?: Record<string, UnitOrders>;
  attackRangeUm?: number;
}

const UnitOrdersSchema = Schema.Struct({
  orderedHeading: Schema.Finite,
  orderedSpeedBp: Schema.Finite,
  attainableMaxBp: Schema.optional(Schema.Finite),
});

const TacticalBattleStateSchema: Schema.declare<TacticalBattleState> =
  Schema.declare<TacticalBattleState>(
    (value): value is TacticalBattleState => isUnknownRecord(value),
    { expected: "tactical battle state (validated by advance)" },
  );

const BattleAdvanceMinuteFileSchema = Schema.Struct({
  state: TacticalBattleStateSchema,
  orders: Schema.optional(Schema.Record(Schema.String, UnitOrdersSchema)),
  attackRangeUm: Schema.optional(Schema.Finite),
});

export interface GunneryResolveShotCliOptions {
  outputMode: OutputMode;
  inputPath?: string;
  seed: string;
}

interface GunneryResolveShotFile {
  identity: { battleId: string; batteryId: string; minute: number; substep: number };
  accuracyFactors: GunneryAccuracyFactors;
  salvo: {
    count: number;
    ammunition: Record<AmmunitionType, number>;
    preferredType: AmmunitionType;
    permittedTypes?: readonly AmmunitionType[];
  };
}

const GunneryIdentitySchema = Schema.Struct({
  battleId: Schema.String,
  batteryId: Schema.String,
  minute: Schema.Finite,
  substep: Schema.Finite,
});

const GunneryAccuracyFactorsSchema: Schema.declare<GunneryAccuracyFactors> =
  Schema.declare<GunneryAccuracyFactors>(
    (value): value is GunneryAccuracyFactors => isUnknownRecord(value),
    { expected: "gunnery accuracy factors (validated by resolveAccuracy)" },
  );

const AmmunitionTypeSchema = Schema.Literals(AMMUNITION_TYPES);

const GunnerySalvoSchema = Schema.Struct({
  count: Schema.Finite,
  ammunition: Schema.Record(AmmunitionTypeSchema, Schema.Finite),
  preferredType: AmmunitionTypeSchema,
  permittedTypes: Schema.optional(Schema.Array(AmmunitionTypeSchema)),
});

const GunneryResolveShotFileSchema = Schema.Struct({
  identity: GunneryIdentitySchema,
  accuracyFactors: GunneryAccuracyFactorsSchema,
  salvo: GunnerySalvoSchema,
});

export const runCampaignCompile = (
  options: CampaignCliOptions,
): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const collector = new DiagnosticCollector();
    const input = yield* buildContentSurfaceInput(options, collector);
    if (!input) return "usage-error";
    const artifact = buildContentBundleArtifact(input, new AbortController().signal, collector);
    if (collector.hasErrors || !artifact) {
      yield* printDiagnostics(collector, options.outputMode);
      return collector.hasErrors ? "validation-error" : "compile-error";
    }
    const campaignInput: CampaignCompilerInput = {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    };
    const campaignCompiler = new CampaignCompiler();
    const signal = new AbortController().signal;
    const output = campaignCompiler.compile(campaignInput, signal, collector);
    yield* printDiagnostics(collector, options.outputMode);
    if (collector.hasErrors) return "validation-error";
    if (!output) return "compile-error";
    const outDir = resolve(options.outputDir);
    yield* fs.makeDirectory(outDir);
    const persistableSnapshot = serializeCampaignSnapshot(output.state.snapshot);
    const envelope = createEnvelope(
      "campaign-snapshot",
      campaignInput.compatibilityVersion,
      persistableSnapshot,
    );
    const state: CampaignState = {
      snapshot: persistableSnapshot,
      envelope,
      rawHash: persistedStateHash(persistableSnapshot, envelope),
    };
    const stateJson = canonicalSerialize(state);
    const statePath = resolve(outDir, "campaign-state.json");
    const tmpPath = statePath + ".tmp";
    const write = Effect.gen(function* () {
      yield* fs.writeFile(tmpPath, stateJson);
      yield* fs.remove(statePath);
      yield* fs.writeFile(statePath, stateJson);
    });
    yield* runWriteBlock(fs, [tmpPath], write);
    if (options.outputMode === "json") {
      yield* printResult(
        JSON.stringify({
          contentHash: output.contentHash,
          rawHash: state.rawHash,
          path: statePath,
        }),
      );
    } else {
      yield* printResult(`Campaign compiled successfully`);
      yield* printResult(`  State: ${statePath} (SHA-256: ${state.rawHash})`);
      yield* printResult(`  Content hash: ${output.contentHash}`);
    }
    return "success";
  });

function asStorableSnapshot(snapshot: unknown): StorableCampaignSnapshot {
  return snapshot as StorableCampaignSnapshot;
}

export const runCampaignSave = (
  options: CampaignCliOptions,
  saveDir: string,
): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const statePath = resolve(options.outputDir, "campaign-state.json");
    if (!(yield* fs.exists(statePath))) {
      yield* printResult(`Campaign state not found at ${statePath}`);
      return "usage-error";
    }
    const stateText = yield* readFileOption(fs, statePath);
    let state: CampaignState;
    try {
      const decoded = Schema.decodeUnknownSync(StorableCampaignStateSchema)(
        JSON.parse(stateText ?? ""),
      );
      state = {
        ...decoded,
        snapshot: fromStorableSnapshot(asStorableSnapshot(decoded.snapshot)),
      };
    } catch {
      yield* printResult(`Failed to parse campaign state at ${statePath}`);
      return "internal-error";
    }
    const store = new SaveStore();
    try {
      const result = store.save(state, saveDir);
      if (options.outputMode === "json") {
        yield* printResult(JSON.stringify(result, null, 2));
      } else {
        yield* printResult(`Campaign saved`);
        yield* printResult(`  Save ID: ${result.metadata.saveId}`);
        yield* printResult(`  Path: ${result.savePath}`);
        yield* printResult(`  Hash: ${result.hash}`);
      }
      return "success";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield* printResult(`Failed to save campaign: ${message}`);
      return "internal-error";
    }
  });

export const runCampaignLoad = (
  options: CampaignCliOptions,
  saveDir: string,
): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const collector = new DiagnosticCollector();
    const store = new SaveStore();
    const state = store.load(saveDir, collector);
    yield* printDiagnostics(collector, options.outputMode);
    if (!state) return "validation-error";
    if (options.outputMode === "json") {
      yield* printResult(
        JSON.stringify({
          rawHash: state.rawHash,
          envelopeHash: state.envelope.bodyHash,
          turnNumber: state.snapshot.turnNumber,
          campaignId: state.snapshot.campaignId,
        }),
      );
    } else {
      yield* printResult(`Campaign loaded successfully`);
      yield* printResult(`  Turn: ${String(state.snapshot.turnNumber)}`);
      yield* printResult(`  Campaign: ${state.snapshot.campaignId}`);
      yield* printResult(`  Raw Hash: ${state.rawHash}`);
      yield* printResult(`  Envelope verified: YES`);
    }
    return "success";
  });

export const runBattleGenerate = (
  options: BattleGenerateCliOptions,
  saveDir: string,
): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const collector = new DiagnosticCollector();
    const store = new SaveStore();
    const state = store.load(saveDir, collector);
    if (!state) {
      yield* printDiagnostics(collector, options.outputMode);
      return "validation-error";
    }
    const snapshot = reviveCampaignSnapshot(state.snapshot);
    const campaignMonth = options.campaignMonth ?? String(snapshot.turnNumber);
    const rulesetVersion = options.rulesetVersion ?? snapshot.rulesetVersion;
    const result = runCombatOperation(
      () =>
        generate({
          snapshot,
          campaignMonth,
          campaignSeed: options.seed,
          rngVersion: options.rngVersion,
          formulaVersion: options.formulaVersion,
          rulesetVersion,
          contentVersion: options.contentVersion,
          resolveStrength: (shipId) => resolveShipStrength(snapshot, shipId),
          resolveShipType: () => "BB",
          resolveReadiness: (shipId) => resolveCampaignBattleReadiness(snapshot, shipId),
        }),
      collector,
      "battle:generate",
    );
    yield* printDiagnostics(collector, options.outputMode);
    if (result.outcome !== "success") return result.outcome;
    yield* printBattleGenerationResult(result.value, options.outputMode);
    return "success";
  });

const printBattleGenerationResult = (
  result: BattleGenerationResult,
  mode: OutputMode,
): Effect.Effect<void, never, CliConsole> =>
  Effect.gen(function* () {
    if (mode === "json") {
      yield* printResult(JSON.stringify(result));
      return;
    }
    yield* printResult(`Battle generation complete`);
    yield* printResult(`  Records: ${result.records.length}`);
    yield* printResult(`  Battles: ${result.battleIds.length}`);
    const lines = result.battleIds.map((battleId, i) => {
      const manifest = result.manifests[i];
      return `    ${battleId} — ${manifest?.attackerId ?? "?"} vs ${manifest?.defenderId ?? "?"} @ ${manifest?.areaId ?? "?"} (manifestHash: ${manifest?.manifestHash ?? "?"})`;
    });
    for (const line of lines) yield* printResult(line);
    if (result.rejections.length > 0) {
      yield* printResult(`  Rejections: ${result.rejections.join(", ")}`);
    }
  });

export const runBattleAdvanceMinute = (
  options: BattleAdvanceMinuteCliOptions,
): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const collector = new DiagnosticCollector();
    if (!options.statePath) {
      collector.addError("USAGE", "Missing required --state <path>");
      yield* printDiagnostics(collector, options.outputMode);
      return "usage-error";
    }
    const resolvedPath = resolve(options.statePath);
    if (!(yield* fs.exists(resolvedPath))) {
      collector.addError("USAGE", `State file not found: ${resolvedPath}`);
      yield* printDiagnostics(collector, options.outputMode);
      return "usage-error";
    }
    const stateText = yield* readFileOption(fs, resolvedPath);
    let parsed: BattleAdvanceMinuteFile;
    try {
      const decoded = Schema.decodeUnknownResult(
        BattleAdvanceMinuteFileSchema,
        STRICT_DECODE_OPTIONS,
      )(JSON.parse(stateText ?? ""));
      if (Result.isFailure(decoded)) {
        collector.addError(
          "USAGE",
          `Failed to parse state file: ${resolvedPath}: ${describeSchemaFailure(decoded.failure)}`,
        );
        yield* printDiagnostics(collector, options.outputMode);
        return "usage-error";
      }
      parsed = decoded.success;
    } catch {
      collector.addError("USAGE", `Failed to parse state file: ${resolvedPath}`);
      yield* printDiagnostics(collector, options.outputMode);
      return "usage-error";
    }
    const result = runCombatOperation(
      () =>
        advance({
          state: parsed.state,
          minute: options.minute,
          observationTime: options.observationTime,
          orders: parsed.orders,
          attackRangeUm: parsed.attackRangeUm,
        }),
      collector,
      "battle:advance-minute",
    );
    yield* printDiagnostics(collector, options.outputMode);
    if (result.outcome !== "success") return result.outcome;
    yield* printMinuteResult(result.value, options.outputMode);
    return "success";
  });

const printMinuteResult = (
  result: MinuteResult,
  mode: OutputMode,
): Effect.Effect<void, never, CliConsole> =>
  Effect.gen(function* () {
    if (mode === "json") {
      yield* printResult(JSON.stringify(result));
      return;
    }
    yield* printResult(`Minute ${result.minute} advanced`);
    yield* printResult(`  Minute hash: ${result.minuteHash}`);
    yield* printResult(`  Units:`);
    for (const [assetId, m] of Object.entries(result.movementStates)) {
      yield* printResult(
        `    ${assetId} — pos [${m.position[0]}, ${m.position[1]}] heading ${m.heading} speed ${m.currentSpeed}bp`,
      );
    }
    yield* printResult(`  Contacts: ${result.contacts.length}`);
    for (const c of result.contacts) {
      yield* printResult(
        `    ${c.contactId} — asset ${c.assetId} pos [${c.position[0]}, ${c.position[1]}]`,
      );
    }
    yield* printResult(`  Events: ${result.events.length}`);
    for (const e of result.events) {
      yield* printResult(
        `    [${e.substep}] ${e.eventType} (${e.actorId}${e.targetId ? ` -> ${e.targetId}` : ""})`,
      );
    }
  });

export const runGunneryResolveShot = (
  options: GunneryResolveShotCliOptions,
): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const collector = new DiagnosticCollector();
    if (!options.inputPath) {
      collector.addError("USAGE", "Missing required --input <path>");
      yield* printDiagnostics(collector, options.outputMode);
      return "usage-error";
    }
    const resolvedPath = resolve(options.inputPath);
    if (!(yield* fs.exists(resolvedPath))) {
      collector.addError("USAGE", `Input file not found: ${resolvedPath}`);
      yield* printDiagnostics(collector, options.outputMode);
      return "usage-error";
    }
    const inputText = yield* readFileOption(fs, resolvedPath);
    let parsed: GunneryResolveShotFile;
    try {
      const decoded = Schema.decodeUnknownResult(
        GunneryResolveShotFileSchema,
        STRICT_DECODE_OPTIONS,
      )(JSON.parse(inputText ?? ""));
      if (Result.isFailure(decoded)) {
        collector.addError(
          "USAGE",
          `Failed to parse input file: ${resolvedPath}: ${describeSchemaFailure(decoded.failure)}`,
        );
        yield* printDiagnostics(collector, options.outputMode);
        return "usage-error";
      }
      parsed = decoded.success;
    } catch {
      collector.addError("USAGE", `Failed to parse input file: ${resolvedPath}`);
      yield* printDiagnostics(collector, options.outputMode);
      return "usage-error";
    }
    const result = runCombatOperation(
      (): GunneryResolveShotResult => {
        const accuracy = resolveAccuracy(parsed.accuracyFactors);
        const engine = new RandomEngine(options.seed);
        const hit = resolveHit(engine, parsed.identity, accuracy.finalAccuracyBp);
        const ammunition = reserveAndConsumeAmmunition(
          parsed.salvo.ammunition,
          parsed.salvo.count,
          parsed.salvo.preferredType,
          parsed.salvo.permittedTypes,
        );
        return { accuracy, hit, ammunition };
      },
      collector,
      "gunnery:resolve-shot",
    );
    yield* printDiagnostics(collector, options.outputMode);
    if (result.outcome !== "success") return result.outcome;
    yield* printGunneryResolveShotResult(result.value, options.outputMode);
    return "success";
  });

interface GunneryResolveShotResult {
  accuracy: AccuracyResolution;
  hit: KeyedHitDraw;
  ammunition: AmmunitionReserve;
}

const printGunneryResolveShotResult = (
  result: GunneryResolveShotResult,
  mode: OutputMode,
): Effect.Effect<void, never, CliConsole> =>
  Effect.gen(function* () {
    if (mode === "json") {
      yield* printResult(JSON.stringify(result));
      return;
    }
    yield* printResult(`Accuracy factors:`);
    yield* printResult(`    baseAccuracyBp: ${result.accuracy.factors.baseAccuracyBp}`);
    for (const key of result.accuracy.factorKeys) {
      yield* printResult(`    ${key}: ${result.accuracy.factors[key]}`);
    }
    yield* printResult(`  Final accuracy: ${result.accuracy.finalAccuracyBp}bp`);
    yield* printResult(`  Draw: ${result.hit.draw} (need < ${result.hit.finalAccuracyBp})`);
    yield* printResult(`  Result: ${result.hit.isHit ? "HIT" : "MISS"}`);
    yield* printResult(
      `  Ammunition: consumed ${result.ammunition.account.count} x ${result.ammunition.account.type} (${result.ammunition.account.before} -> ${result.ammunition.account.after})`,
    );
  });

function extractBattleSummary(
  snapshot: CampaignSnapshot,
): { manifests: BattleManifest[]; battles: BattleInstance[] } | undefined {
  const battles = snapshot.wars.battles ?? [];
  const manifests = snapshot.wars.battleManifests ?? [];
  if (battles.length === 0 && manifests.length === 0) return undefined;
  return { manifests, battles };
}

const printBattleSummary = (
  summary: { manifests: BattleManifest[]; battles: BattleInstance[] } | undefined,
): Effect.Effect<void, never, CliConsole> =>
  Effect.gen(function* () {
    if (!summary) return;
    yield* printResult(`  Battles:`);
    yield* printResult(`    Generated manifests: ${summary.manifests.length}`);
    for (const battle of summary.battles) {
      if (battle.result) {
        const r = battle.result;
        const verdict =
          r.winnerId && r.loserId
            ? `${r.winnerId} defeated ${r.loserId}`
            : "inconclusive (no winner)";
        yield* printResult(
          `    ${battle.id} (${battle.attackerId} vs ${battle.defenderId} @ ${battle.areaId}): ${verdict}`,
        );
        yield* printResult(
          `      Losses — attacker: ${r.attackerLosses.join(", ") || "none"}; defender: ${r.defenderLosses.join(", ") || "none"}`,
        );
        const damageEntries = Object.entries(r.damageReport);
        if (damageEntries.length > 0) {
          yield* printResult(
            `      Damage: ${damageEntries.map(([id, dmg]) => `${id}=${String(dmg)}`).join(", ")}`,
          );
        }
      } else {
        yield* printResult(
          `    ${battle.id} (${battle.attackerId} vs ${battle.defenderId} @ ${battle.areaId}): ${battle.phase}`,
        );
      }
    }
  });

export const runTurnExecute = (
  options: CampaignCliOptions,
  saveDir: string,
  commands?: CommandEnvelope<CommandBody>[],
): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const collector = new DiagnosticCollector();
    const store = new SaveStore();
    const state = store.load(saveDir, collector);
    if (!state) {
      yield* printDiagnostics(collector, options.outputMode);
      return "validation-error";
    }
    const revivedSnapshot = reviveCampaignSnapshot(state.snapshot);
    const executor = new MonthExecutor();
    const randomSeed = options.seed || "default-seed";
    const cmdList = commands ?? [];
    const result = executor.execute(revivedSnapshot, cmdList, randomSeed, collector);
    yield* printDiagnostics(collector, options.outputMode);
    if (collector.hasErrors) return "compile-error";
    if (!result.success) return "compile-error";
    const finalSnapshotHash = snapshotHash(result.finalSnapshot);
    const battles = extractBattleSummary(result.finalSnapshot);
    const persistableSnapshot = serializeCampaignSnapshot(result.finalSnapshot);
    const newEnvelope = createEnvelope(
      "campaign-snapshot",
      state.snapshot.compatibilityVersion,
      persistableSnapshot,
    );
    const newState: CampaignState = {
      snapshot: persistableSnapshot,
      envelope: newEnvelope,
      rawHash: persistedStateHash(persistableSnapshot, newEnvelope),
    };
    const saveResult = store.save(newState, saveDir);
    const commandsDir = join(saveResult.savePath, "..", saveResult.metadata.saveId);
    const commandsPath = join(commandsDir, "commands.json");
    const ledgerPath = join(commandsDir, "command-ledger.json");
    const finalHashPath = join(commandsDir, "final-hash.json");
    if (cmdList.length > 0) {
      const commandsJson = canonicalSerialize(cmdList);
      const tmpCommands = commandsPath + ".tmp";
      const writeCommands = Effect.gen(function* () {
        yield* fs.writeFile(tmpCommands, commandsJson);
        yield* fs.remove(commandsPath);
        yield* fs.writeFile(commandsPath, commandsJson);
      });
      yield* runWriteBlock(fs, [tmpCommands], writeCommands);
    }
    const ledgerJson = canonicalSerialize(result.commandLedger.all);
    const ledgerTmp = ledgerPath + ".tmp";
    const writeLedger = Effect.gen(function* () {
      yield* fs.writeFile(ledgerTmp, ledgerJson);
      yield* fs.remove(ledgerPath);
      yield* fs.writeFile(ledgerPath, ledgerJson);
    });
    yield* runWriteBlock(fs, [ledgerTmp], writeLedger);
    const finalHashJson = JSON.stringify({ finalSnapshotHash });
    const finalHashTmp = finalHashPath + ".tmp";
    const writeFinalHash = Effect.gen(function* () {
      yield* fs.writeFile(finalHashTmp, finalHashJson);
      yield* fs.remove(finalHashPath);
      yield* fs.writeFile(finalHashPath, finalHashJson);
    });
    yield* runWriteBlock(fs, [finalHashTmp], writeFinalHash);
    if (options.outputMode === "json") {
      yield* printResult(
        JSON.stringify({
          snapshotHash: finalSnapshotHash,
          commandLedgerHash: result.commandLedger.hash(),
          eventLedgerHash: result.eventLedger.hash(),
          randomLedgerHash: result.randomLedger.hash(),
          financialLedgerHash: result.financialLedger.hash(),
          savePath: saveResult.savePath,
          saveId: saveResult.metadata.saveId,
          battles,
        }),
      );
    } else {
      yield* printResult(`Turn executed`);
      yield* printResult(`  Turn: ${String(result.finalSnapshot.turnNumber)}`);
      yield* printResult(`  Snapshot Hash: ${finalSnapshotHash}`);
      yield* printResult(`  Command Ledger Hash: ${result.commandLedger.hash()}`);
      yield* printResult(`  Event Ledger Hash: ${result.eventLedger.hash()}`);
      yield* printResult(`  Random Ledger Hash: ${result.randomLedger.hash()}`);
      yield* printResult(`  Financial Ledger Hash: ${result.financialLedger.hash()}`);
      yield* printResult(`  Save ID: ${saveResult.metadata.saveId}`);
      yield* printBattleSummary(battles);
    }
    return "success";
  });

export const runReplay = (
  options: CampaignCliOptions,
  saveDir: string,
): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const collector = new DiagnosticCollector();
    const store = new SaveStore();
    const activeSaveId = store.getActiveSaveId(saveDir);
    if (!activeSaveId) {
      yield* printResult(`No active save found in ${saveDir}`);
      return "validation-error";
    }
    const previousSaveId = store.getPreviousSaveId(saveDir);
    if (!previousSaveId) {
      yield* printResult(
        `No previous save found for ${activeSaveId} in ${saveDir} (nothing to replay from)`,
      );
      return "validation-error";
    }
    const state = store.loadById(saveDir, previousSaveId, collector);
    if (!state) {
      yield* printDiagnostics(collector, options.outputMode);
      return "validation-error";
    }
    const savePath = join(saveDir, activeSaveId);
    const commandsPath = join(savePath, "commands.json");
    const ledgerPath = join(savePath, "command-ledger.json");
    const finalHashPath = join(savePath, "final-hash.json");
    if (!(yield* fs.exists(commandsPath))) {
      yield* printResult(`No commands found in save ${activeSaveId}`);
      return "validation-error";
    }
    const commandsText = yield* readFileOption(fs, commandsPath);
    let commands: CommandEnvelope<CommandBody>[];
    try {
      const decoded = Schema.decodeUnknownResult(
        CommandEnvelopeListSchema,
        STRICT_DECODE_OPTIONS,
      )(JSON.parse(commandsText ?? ""));
      if (Result.isFailure(decoded)) {
        yield* printResult(`Failed to parse commands file: ${commandsPath}`);
        return "internal-error";
      }
      commands = [...decoded.success];
    } catch {
      yield* printResult(`Failed to parse commands file: ${commandsPath}`);
      return "internal-error";
    }
    const ledgerText = yield* readFileOption(fs, ledgerPath);
    let originalLedgerData: ReadonlyArray<unknown>;
    try {
      originalLedgerData = Schema.decodeUnknownSync(Schema.Array(Schema.Unknown))(
        JSON.parse(ledgerText ?? ""),
      );
    } catch {
      yield* printResult(`Failed to parse command ledger file: ${ledgerPath}`);
      return "internal-error";
    }
    const finalHashText = yield* readFileOption(fs, finalHashPath);
    let expectedFinalHash: string;
    try {
      const finalHashData = Schema.decodeUnknownSync(
        Schema.Struct({ finalSnapshotHash: Schema.String }),
      )(JSON.parse(finalHashText ?? ""));
      expectedFinalHash = finalHashData.finalSnapshotHash;
    } catch {
      yield* printResult(`Failed to parse final hash file: ${finalHashPath}`);
      return "internal-error";
    }
    const originalLedger = new CommandLedger();
    for (const outcome of originalLedgerData) {
      originalLedger.add(outcome as CommandOutcome);
    }
    const randomSeed = options.seed || "default-seed";
    const verifier = new ReplayVerifier();
    const replayResult = verifier.verify(
      reviveCampaignSnapshot(state.snapshot),
      commands,
      originalLedger,
      expectedFinalHash,
      randomSeed,
      collector,
    );
    yield* printDiagnostics(collector, options.outputMode);
    const battles = replayResult.finalSnapshot
      ? extractBattleSummary(replayResult.finalSnapshot)
      : undefined;
    if (options.outputMode === "json") {
      yield* printResult(
        JSON.stringify(
          {
            match: replayResult.match,
            replayedFinalHash: replayResult.replayedFinalHash,
            originalFinalHash: replayResult.originalFinalHash,
            replayedCommandLedgerHash: replayResult.replayedCommandLedgerHash,
            originalCommandLedgerHash: replayResult.originalCommandLedgerHash,
            steps: replayResult.steps,
            mismatches: replayResult.mismatches,
            battles,
          },
          null,
          2,
        ),
      );
    } else {
      if (replayResult.match) {
        yield* printResult(`Replay verification: PASSED`);
      } else {
        yield* printResult(`Replay verification: FAILED`);
        for (const m of replayResult.mismatches) {
          yield* printResult(`  Step ${m.stepIndex} (${m.commandId}):`);
          yield* printResult(`    Expected: ${m.expectedHash}`);
          yield* printResult(`    Actual:   ${m.actualHash}`);
        }
      }
      yield* printResult(`  Replayed Final Hash: ${replayResult.replayedFinalHash}`);
      yield* printResult(`  Original Final Hash: ${replayResult.originalFinalHash}`);
      yield* printResult(
        `  Steps: ${replayResult.steps.length}, Mismatches: ${replayResult.mismatches.length}`,
      );
      yield* printBattleSummary(battles);
    }
    if (collector.hasErrors) return "validation-error";
    return replayResult.match ? "success" : "validation-error";
  });

export const buildInput = (
  options: CliOptions,
  collector: DiagnosticCollector,
): Effect.Effect<CompilerInput | undefined, never, CliFileSystem> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const manifestPath = resolve(options.manifest);
    const contentDir = resolve(options.contentDir);
    if (!(yield* fs.exists(manifestPath))) {
      collector.addError("USAGE", `Manifest not found: ${manifestPath}`);
      return undefined;
    }
    if (!(yield* fs.exists(contentDir))) {
      collector.addError("USAGE", `Content directory not found: ${contentDir}`);
      return undefined;
    }
    const manifestContent = yield* fs
      .readFile(manifestPath)
      .pipe(Effect.catchTag("CliFileSystemError", () => Effect.succeed("")));
    let manifest: { files?: Record<string, string[]> };
    try {
      manifest = JSON.parse(manifestContent);
    } catch {
      collector.addError("USAGE", `Failed to parse manifest: ${manifestPath}`);
      return undefined;
    }
    const toAbsolute = (file: string) => resolve(contentDir, file);
    const safeCheck = (file: string) => {
      safePath(file);
      return file;
    };
    const files = manifest.files ?? {};
    return {
      manifestPath,
      contentDir,
      rulesetFiles: (files.rulesets ?? []).map(safeCheck).map(toAbsolute).map(safePath),
      countryFiles: (files.countries ?? []).map(safeCheck).map(toAbsolute).map(safePath),
      areaFiles: (files.areas ?? []).map(safeCheck).map(toAbsolute).map(safePath),
      routeFiles: (files.routes ?? []).map(safeCheck).map(toAbsolute).map(safePath),
      possessionFiles: (files.possessions ?? []).map(safeCheck).map(toAbsolute).map(safePath),
      portFiles: (files.ports ?? []).map(safeCheck).map(toAbsolute).map(safePath),
      technologyFiles: (files.technologies ?? []).map(safeCheck).map(toAbsolute).map(safePath),
    };
  });

export const buildContentSurfaceInput = (
  options: CliOptions,
  collector: DiagnosticCollector,
): Effect.Effect<CompilerInput | undefined> =>
  Effect.sync(() => {
    try {
      return buildFullSurfaceInput(
        resolve(options.manifest),
        resolve(options.contentDir),
        collector,
      );
    } catch (err) {
      collector.addError("USAGE", err instanceof Error ? err.message : String(err));
      return undefined;
    }
  });

export const runContentCheck = (options: CliOptions): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const collector = new DiagnosticCollector();
    const input = yield* buildContentSurfaceInput(options, collector);
    if (!input) return "usage-error";
    const artifact = buildContentBundleArtifact(input, new AbortController().signal, collector);
    yield* printDiagnostics(collector, options.outputMode);
    if (collector.hasErrors) return "validation-error";
    if (!artifact) return "compile-error";
    const contentHash = artifact.manifest.bodyHash;
    const confidence = countConfidence(artifact.bundle);
    if (options.outputMode === "json") {
      yield* printResult(
        JSON.stringify({
          contentVersion: artifact.contentVersion,
          contentHash,
          shipBuilding: artifact.bundle.shipBuilding !== undefined,
          confidence: confidence.collections,
          confidenceTotal: confidence.total,
        }),
      );
    } else {
      yield* printResult("Content check passed");
      yield* printResult(`  Content version: ${artifact.contentVersion}`);
      yield* printResult(`  Content hash: ${contentHash}`);
      yield* printResult(
        `  Ship-building catalogue: ${artifact.bundle.shipBuilding ? "included" : "absent"}`,
      );
      yield* printConfidenceReport(confidence.collections, confidence.total);
    }
    return "success";
  });

const printConfidenceReport = (
  collections: ReadonlyArray<{ collection: string; counts: ConfidenceCounts }>,
  total: ConfidenceCounts,
): Effect.Effect<void, never, CliConsole> =>
  Effect.gen(function* () {
    const labelled = collections.filter((entry) => entry.counts.total > 0);
    yield* printResult("  Confidence:");
    for (const { collection, counts } of labelled) {
      yield* printResult(
        `    ${collection}: HIGH ${counts.HIGH}, MEDIUM ${counts.MEDIUM}, LOW ${counts.LOW}`,
      );
    }
    yield* printResult(`    (total: HIGH ${total.HIGH}, MEDIUM ${total.MEDIUM}, LOW ${total.LOW})`);
  });

export const CONTENT_PLACEHOLDER_ALLOWLIST_FILENAME = "placeholder-allowlist.json";

const PlaceholderAllowlistFileSchema = Schema.Struct({
  allow: Schema.optional(Schema.Array(Schema.Unknown)),
});

export const runContentGate = (options: CliOptions): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const fs = yield* CliFileSystem;
    const collector = new DiagnosticCollector();
    const input = yield* buildContentSurfaceInput(options, collector);
    if (!input) {
      yield* printDiagnostics(collector, options.outputMode);
      return "usage-error";
    }
    const artifact = buildContentBundleArtifact(input, new AbortController().signal, collector);
    if (collector.hasErrors || !artifact) {
      yield* printDiagnostics(collector, options.outputMode);
      return collector.hasErrors ? "validation-error" : "compile-error";
    }

    const manifest = artifact.bundle.manifest as { type?: unknown };
    if (manifest.type !== "production") {
      if (options.outputMode === "json") {
        yield* printResult(
          JSON.stringify({ skipped: true, reason: "not a shipping (production) pack" }),
        );
      } else {
        yield* printResult("Content gate skipped: not a shipping (production) pack");
      }
      return "success";
    }

    const allowlistPath = resolve(options.contentDir, CONTENT_PLACEHOLDER_ALLOWLIST_FILENAME);
    let allowlist: PlaceholderAllowlistEntry[] = [];
    if (yield* fs.exists(allowlistPath)) {
      const allowlistText = yield* readFileOption(fs, allowlistPath);
      try {
        const parsed = Schema.decodeUnknownSync(PlaceholderAllowlistFileSchema)(
          JSON.parse(allowlistText ?? ""),
        );
        if (Array.isArray(parsed.allow)) allowlist = parsed.allow as PlaceholderAllowlistEntry[];
      } catch {
        collector.addError(
          "PLACEHOLDER-ALLOWLIST",
          `Failed to parse placeholder allowlist: ${allowlistPath}`,
          { stage: "validate" },
        );
        yield* printDiagnostics(collector, options.outputMode);
        return "usage-error";
      }
    }

    const result = checkPlaceholderGate(artifact.bundle, allowlist);
    for (const entry of result.invalidAllowlist) {
      collector.addError("PLACEHOLDER-ALLOWLIST", entry, {
        stage: "validate",
        sourceLocation: { path: CONTENT_PLACEHOLDER_ALLOWLIST_FILENAME, line: 1 },
        remediation: "Give the allowlist entry a justification, or remove it",
      });
    }
    for (const violation of result.violations) {
      collector.addError(
        "PLACEHOLDER",
        `Unresolved placeholder in ${violation.collection} '${violation.recordId}' at ${violation.field}`,
        {
          stage: "validate",
          entityId: violation.recordId,
          remediation: "Source the value or add a justified allowlist entry",
        },
      );
    }
    yield* printDiagnostics(collector, options.outputMode);
    if (!result.ok) return "validation-error";

    if (options.outputMode === "json") {
      yield* printResult(
        JSON.stringify({
          contentVersion: artifact.contentVersion,
          contentHash: artifact.manifest.bodyHash,
          placeholders: 0,
          allowed: result.allowed.length,
        }),
      );
    } else {
      yield* printResult("Content gate passed: no unresolved placeholders");
      yield* printResult(`  Content version: ${artifact.contentVersion}`);
      if (result.allowed.length > 0) {
        yield* printResult(`  Allowlisted placeholders: ${result.allowed.length}`);
      }
    }
    return "success";
  });

export const runContentBuild = (options: CliOptions): Effect.Effect<ExitCategory, never, CliEnv> =>
  Effect.gen(function* () {
    const collector = new DiagnosticCollector();
    const input = yield* buildContentSurfaceInput(options, collector);
    if (!input) return "usage-error";
    const artifact = buildContentBundleArtifact(input, new AbortController().signal, collector);
    yield* printDiagnostics(collector, options.outputMode);
    if (collector.hasErrors) return "validation-error";
    if (!artifact) return "compile-error";

    const { artifactPath, manifestPath } = writeContentBundleArtifact(
      resolve(options.outputDir),
      artifact,
    );
    if (options.outputMode === "json") {
      yield* printResult(
        JSON.stringify({
          contentVersion: artifact.contentVersion,
          contentHash: artifact.envelope.bodyHash,
          artifactPath,
          manifestPath,
        }),
      );
    } else {
      yield* printResult("Content built successfully");
      yield* printResult(`  Artifact: ${artifactPath} (SHA-256: ${artifact.envelope.bodyHash})`);
      yield* printResult(`  Manifest: ${manifestPath}`);
      yield* printResult(`  Content version: ${artifact.contentVersion}`);
    }
    return "success";
  });

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

    const verification = verifyContentLock(artifact, lock);
    if (!verification.ok) {
      collector.addError("CONTENT-LOCK", verification.message, {
        stage: "validate",
        sourceLocation: { path: CONTENT_LOCK_FILENAME, line: 1 },
        remediation:
          verification.code === "CONTENT_LOCK_HASH_MISMATCH"
            ? "If the content change is deliberate, update content-lock.json to the new hash"
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

export function snapshotHash(snapshot: CampaignSnapshot): string {
  const nations: Record<string, NationState> = {};
  for (const [id, nation] of snapshot.nations) {
    nations[id] = nation;
  }
  const wars = {
    wars: snapshot.wars.wars.map((w) => ({ ...w })),
    battles: snapshot.wars.battles.map((b) => ({ ...b })),
  };
  const hashable = {
    version: snapshot.version,
    turnNumber: snapshot.turnNumber,
    campaignId: snapshot.campaignId,
    slots: snapshot.slots.map((s) => ({ ...s })),
    world: {
      areas: snapshot.world.areas.map((a) => ({ ...a })),
      routes: snapshot.world.routes.map((r) => ({ ...r })),
      ports: snapshot.world.ports.map((p) => ({ ...p })),
    },
    nations,
    wars,
    politics: {
      relations: snapshot.politics.relations.map((r) => ({ ...r })),
      shells: { ...snapshot.politics.shells },
    },
    intelligence: {
      shells: { ...snapshot.intelligence.shells },
    },
    rulesetVersion: snapshot.rulesetVersion,
    compatibilityVersion: snapshot.compatibilityVersion,
  };
  return sha256Hex(canonicalSerialize(hashable));
}

export function persistedStateHash(
  snapshot: CampaignSnapshot,
  envelope: ReturnType<typeof createEnvelope>,
): string {
  return sha256Hex(canonicalSerialize({ snapshot, envelope }));
}

export function reviveCampaignSnapshot(snapshot: CampaignSnapshot): CampaignSnapshot {
  const nations = toMap<NationState>(snapshot.nations).entries();
  const revivedNations = new Map(
    [...nations].map(([id, nation]) => [id, reviveNation(nation)] as const),
  );
  return {
    ...snapshot,
    nations: revivedNations,
    designs: toMap(snapshot.designs),
    designFamilies: toMap(snapshot.designFamilies),
  };
}

function reviveNation(nation: NationState): NationState {
  if (!nation.research) return nation;
  return {
    ...nation,
    research: {
      ...nation.research,
      activeCandidates: toMap<string>(nation.research.activeCandidates),
    },
  };
}

function toMap<V>(value: Map<string, V> | Record<string, V> | undefined): Map<string, V> {
  if (!value) return new Map();
  if (value instanceof Map) return value;
  return new Map(Object.entries(value));
}

export function serializeCampaignSnapshot(snapshot: CampaignSnapshot): CampaignSnapshot {
  const nations: Record<string, NationState> = {};
  for (const [id, nation] of snapshot.nations) {
    nations[id] = serializeNation(nation);
  }
  return {
    ...snapshot,
    nations: nations as unknown as Map<string, NationState>,
    designs: fromMap(snapshot.designs),
    designFamilies: fromMap(snapshot.designFamilies),
  };
}

function serializeNation(nation: NationState): NationState {
  if (!nation.research) return nation;
  return {
    ...nation,
    research: {
      ...nation.research,
      activeCandidates: fromMap(nation.research.activeCandidates),
    },
  };
}

function fromMap<V>(value: Map<string, V> | undefined): Map<string, V> {
  if (!value) return {} as unknown as Map<string, V>;
  return Object.fromEntries(value) as unknown as Map<string, V>;
}
