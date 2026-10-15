import type {
  BudgetProjectCommand,
  CommandEnvelope,
  SetResearchPriorityCommand,
  SubmitDesignCommand,
} from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { sha256Hex } from "@bluewave/deterministic";
import { AiError } from "./errors.js";

export const AI_ENVELOPE_VERSION = "0.1.0" as const;
export const AI_COMMAND_TYPE_BUDGET = "budget_project" as const;
export const AI_COMMAND_TYPE_RESEARCH = "SetResearchPriority" as const;

export type AiCommandType = typeof AI_COMMAND_TYPE_BUDGET | typeof AI_COMMAND_TYPE_RESEARCH;

export interface AiCommandContext {
  readonly campaignId: string;
  readonly turnNumber: SafeInt;
  readonly expectedSnapshotHash: string; // 64 hex chars
}

function assertNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new AiError({ message: `${name} must be non-empty string` });
  }
}

function assertSafeInt(value: unknown, name: string): asserts value is SafeInt {
  // SafeInt is branded number in contracts; also handle object-branded future-proof
  const n =
    typeof value === "number"
      ? value
      : typeof (value as { valueOf?: unknown })?.valueOf === "function"
        ? Number((value as { valueOf(): unknown }).valueOf())
        : NaN;
  if (!SafeInt.isSafeInt(n)) {
    throw new AiError({
      message: `${name} must be SafeInt (safe integer), got ${String(value)}`,
    });
  }
}

function toNumber(s: SafeInt): number {
  if (typeof s === "number") return s;
  // future-proof: SafeInt as object with valueOf
  const v = (s as unknown as { valueOf(): number }).valueOf();
  if (typeof v === "number" && SafeInt.isSafeInt(v)) return v;
  throw new AiError({ message: `Invalid SafeInt: ${String(s)}` });
}

function encodePart(s: string): string {
  // encodeURIComponent prevents "/" and ":" collisions in idempotencyKey
  return encodeURIComponent(s);
}

function isHex64(s: string): boolean {
  return /^[0-9a-f]{64}$/i.test(s);
}

/**
 * Deterministic, replay-safe envelope factory.
 * Every field including commandId and timestamp is derived solely from
 * (campaignId, turnNumber, nationId, commandType) + expectedSnapshotHash.
 * No IO, no Math.random(), no Date.now().
 */
export class AiCommandGenerator {
  private readonly campaignId: string;
  private readonly turnNumber: SafeInt;
  private readonly expectedSnapshotHash: string;

  constructor(context: AiCommandContext) {
    assertNonEmptyString(context.campaignId, "campaignId");
    assertSafeInt(context.turnNumber, "turnNumber");
    assertNonEmptyString(context.expectedSnapshotHash, "expectedSnapshotHash");
    if (!isHex64(context.expectedSnapshotHash)) {
      throw new AiError({ message: `expectedSnapshotHash must be 64 hex chars` });
    }
    this.campaignId = context.campaignId;
    this.turnNumber = context.turnNumber;
    this.expectedSnapshotHash = context.expectedSnapshotHash.toLowerCase();
    Object.freeze(this);
  }

  /** Canonical idempotency key. Private — use build* methods to ensure consistency. */
  private idempotencyKey(nationId: string, commandType: AiCommandType): string {
    return this.idempotencyKeyFor(nationId, commandType);
  }

  /** Idempotency key for an arbitrary (possibly suffixed) command type; deterministic. */
  private idempotencyKeyFor(nationId: string, commandType: string): string {
    assertNonEmptyString(nationId, "nationId");
    // turnNumber as decimal string via integer conversion (no [object Object])
    const turnStr = String(toNumber(this.turnNumber));
    return `${encodePart(this.campaignId)}/${turnStr}/${encodePart(nationId)}/${encodePart(commandType)}`;
  }

  /** Exposed for testing / diagnostics only — deterministic. */
  static buildIdempotencyKey(
    campaignId: string,
    turnNumber: SafeInt,
    nationId: string,
    commandType: AiCommandType,
  ): string {
    assertNonEmptyString(campaignId, "campaignId");
    assertSafeInt(turnNumber, "turnNumber");
    assertNonEmptyString(nationId, "nationId");
    return `${encodePart(campaignId)}/${String(toNumber(turnNumber))}/${encodePart(nationId)}/${encodePart(commandType)}`;
  }

  private commandIdFromKey(key: string): string {
    // domain-separated hash: ai:v0:<sha256> truncated to 160 bits (40 hex) for brevity
    // full 64 hex available via sha256Hex if needed; 160 bits still > UUID entropy
    return `ai-${sha256Hex(`v0:${key}`).slice(0, 40)}`;
  }

  private deterministicTimestamp(): string {
    // Pure integer arithmetic, UTC, handles negative turnNumber deterministically.
    // Turn 0 => 1910-01-01T00:00:00.000Z, wraps every 365 days (no leap drift).
    const daysOffset = ((toNumber(this.turnNumber) % 365) + 365) % 365;
    const baseMs = Date.UTC(1910, 0, 1); // 1910-01-01 UTC
    const ms = baseMs + daysOffset * 24 * 60 * 60 * 1000;
    return new Date(ms).toISOString(); // toISOString is always UTC, deterministic
  }

  buildBudgetCommand(
    nationId: string,
    projectId: string,
    amount: SafeInt,
  ): CommandEnvelope<BudgetProjectCommand> {
    assertNonEmptyString(nationId, "nationId");
    assertNonEmptyString(projectId, "projectId");
    assertSafeInt(amount, "amount");
    if (toNumber(amount) < 1) throw new AiError({ message: `budget amount must be >=1` });

    const key = this.idempotencyKey(nationId, AI_COMMAND_TYPE_BUDGET);
    const envelope: CommandEnvelope<BudgetProjectCommand> = {
      commandId: this.commandIdFromKey(key),
      version: AI_ENVELOPE_VERSION,
      expectedSnapshotHash: this.expectedSnapshotHash,
      idempotencyKey: key,
      timestamp: this.deterministicTimestamp(),
      body: {
        type: AI_COMMAND_TYPE_BUDGET,
        nationId,
        projectId,
        budget: amount,
      },
      issuerClass: "AI",
      issuerParticipantId: nationId,
    };
    return Object.freeze(envelope) as CommandEnvelope<BudgetProjectCommand>;
  }

  buildResearchPriorityCommand(
    nationId: string,
    fieldPriorities: Record<string, SafeInt>,
  ): CommandEnvelope<SetResearchPriorityCommand> {
    assertNonEmptyString(nationId, "nationId");
    if (typeof fieldPriorities !== "object" || fieldPriorities === null) {
      throw new AiError({ message: `fieldPriorities must be object` });
    }
    // validate each priority is SafeInt and freeze copy
    const copy: Record<string, SafeInt> = {};
    for (const [k, v] of Object.entries(fieldPriorities)) {
      assertNonEmptyString(k, "fieldPriorities key");
      assertSafeInt(v, `fieldPriorities[${k}]`);
      copy[k] = v;
    }
    Object.freeze(copy);

    const key = this.idempotencyKey(nationId, AI_COMMAND_TYPE_RESEARCH);
    const envelope: CommandEnvelope<SetResearchPriorityCommand> = {
      commandId: this.commandIdFromKey(key),
      version: AI_ENVELOPE_VERSION,
      expectedSnapshotHash: this.expectedSnapshotHash,
      idempotencyKey: key,
      timestamp: this.deterministicTimestamp(),
      body: {
        type: AI_COMMAND_TYPE_RESEARCH,
        nationId,
        fieldPriorities: copy,
      },
      issuerClass: "AI",
      issuerParticipantId: nationId,
    };
    return Object.freeze(envelope) as CommandEnvelope<SetResearchPriorityCommand>;
  }

  /**
   * A SubmitDesign command for an AI procurement decision. The idempotency key includes the decision id, so each
   * procurement decision submits exactly once even if the planner runs again before the study is created.
   */
  buildSubmitDesignCommand(
    nationId: string,
    decisionId: string,
    design: {
      readonly designVersionId: string;
      readonly designFamilyId: string;
      readonly className: string;
      readonly hullType: string;
      readonly machineryType: string;
      readonly draft: unknown;
    },
  ): CommandEnvelope<SubmitDesignCommand> {
    assertNonEmptyString(nationId, "nationId");
    assertNonEmptyString(decisionId, "decisionId");
    assertNonEmptyString(design.designVersionId, "designVersionId");
    assertNonEmptyString(design.hullType, "hullType");
    const key = this.idempotencyKeyFor(nationId, `SubmitDesign:${decisionId}`);
    const envelope: CommandEnvelope<SubmitDesignCommand> = {
      commandId: this.commandIdFromKey(key),
      version: AI_ENVELOPE_VERSION,
      expectedSnapshotHash: this.expectedSnapshotHash,
      idempotencyKey: key,
      timestamp: this.deterministicTimestamp(),
      body: {
        type: "SubmitDesign",
        nationId,
        designVersionId: design.designVersionId,
        designFamilyId: design.designFamilyId,
        className: design.className,
        hullType: design.hullType,
        machineryType: design.machineryType,
        draft: design.draft,
      },
      issuerClass: "AI",
      issuerParticipantId: nationId,
    };
    return Object.freeze(envelope) as CommandEnvelope<SubmitDesignCommand>;
  }
}
