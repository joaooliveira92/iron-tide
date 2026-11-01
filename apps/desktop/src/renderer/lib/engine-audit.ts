import type { EngineAuditInput, RandomDecisionRecord } from "@bluewave/campaign-engine";

import { createLogStore, isRecord, type LogStore } from "./versioned-log-store.js";

export interface StoredEngineAudit {
  readonly action: string;
  readonly timestamp: string;
  readonly input: EngineAuditInput;
}

export const ENGINE_AUDIT_STORAGE_KEY = "bluewave-engine-audit-logs";
const MAX_AUDITS = 20;
const MAX_AUDIT_CHARS = 200_000;

function isStoredEngineAudit(value: unknown): value is StoredEngineAudit {
  if (!isRecord(value)) return false;
  return (
    typeof value.action === "string" && typeof value.timestamp === "string" && isRecord(value.input)
  );
}

const auditStore: LogStore<StoredEngineAudit> = createLogStore<StoredEngineAudit>({
  storageKey: ENGINE_AUDIT_STORAGE_KEY,
  maxEntries: MAX_AUDITS,
  maxChars: MAX_AUDIT_CHARS,
  isEntry: isStoredEngineAudit,
});

export function recordEngineAudit(action: string, input: EngineAuditInput): StoredEngineAudit {
  const audit: StoredEngineAudit = {
    action,
    timestamp: new Date().toISOString(),
    input,
  };
  auditStore.prepend(audit);
  return audit;
}

export function clearEngineAudits(): void {
  auditStore.clear();
}

export function getRecordedEngineAudits(): readonly StoredEngineAudit[] {
  return auditStore.entries();
}

export function auditInputFromDecisions(
  randomDecisions: readonly RandomDecisionRecord[],
): EngineAuditInput {
  return { randomDecisions, domainEvents: [], financialLedger: [] };
}
