import type { EngineAuditInput, RandomDecisionRecord } from "@bluewave/campaign-engine";

export interface StoredEngineAudit {
  readonly action: string;
  readonly timestamp: string;
  readonly input: EngineAuditInput;
}

export const ENGINE_AUDIT_STORAGE_KEY = "bluewave-engine-audit-logs";
const MAX_AUDITS = 20;
let cachedAudits: StoredEngineAudit[] | null = null;
let persistenceScheduled = false;

function readAudits(): StoredEngineAudit[] {
  if (cachedAudits !== null) return cachedAudits;
  try {
    const raw = localStorage.getItem(ENGINE_AUDIT_STORAGE_KEY);
    cachedAudits = raw ? (JSON.parse(raw) as StoredEngineAudit[]) : [];
  } catch {
    cachedAudits = [];
  }
  return cachedAudits;
}

function schedulePersistence(): void {
  if (persistenceScheduled) return;
  persistenceScheduled = true;
  const persist = () => {
    persistenceScheduled = false;
    try {
      localStorage.setItem(ENGINE_AUDIT_STORAGE_KEY, JSON.stringify(cachedAudits ?? []));
    } catch (error) {
      console.error("Failed to save engine audit", error);
    }
  };
  const requestIdleCallback = (window as Partial<typeof window>).requestIdleCallback;
  if (requestIdleCallback) requestIdleCallback(persist);
  else window.setTimeout(persist, 0);
}

export function recordEngineAudit(action: string, input: EngineAuditInput): StoredEngineAudit {
  const audit: StoredEngineAudit = {
    action,
    timestamp: new Date().toISOString(),
    input,
  };
  const audits = readAudits();
  audits.unshift(audit);
  cachedAudits = audits.slice(0, MAX_AUDITS);
  schedulePersistence();
  return audit;
}

export function clearEngineAudits(): void {
  cachedAudits = [];
  localStorage.removeItem(ENGINE_AUDIT_STORAGE_KEY);
}

export function getRecordedEngineAudits(): readonly StoredEngineAudit[] {
  return readAudits();
}

export function auditInputFromDecisions(
  randomDecisions: readonly RandomDecisionRecord[],
): EngineAuditInput {
  return { randomDecisions, domainEvents: [], financialLedger: [] };
}
