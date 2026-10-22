import type { DomainEvent, FinancialLedgerEntry, RandomDecisionRecord } from "./simulation.js";

export interface CommandLedgerEntry {
  readonly commandId: string;
  readonly status: string;
}

export interface AIPlan {
  readonly nationId: string;
  readonly summary: string;
}

export interface DockyardProject {
  readonly projectId: string;
  readonly designId: string;
}

export interface EngineAuditInput {
  readonly randomDecisions: readonly RandomDecisionRecord[];
  readonly domainEvents: readonly DomainEvent[];
  readonly financialLedger: readonly FinancialLedgerEntry[];
}

export interface EngineAuditReport {
  readonly counts: {
    readonly decisions: number;
    readonly domainEvents: number;
    readonly ledgerEntries: number;
  };
  readonly randomDecisions: readonly RandomDecisionRecord[];
  readonly domainEvents: readonly DomainEvent[];
  readonly financialLedger: readonly FinancialLedgerEntry[];
}

export function formatEngineAudit(input: EngineAuditInput): EngineAuditReport {
  return {
    counts: {
      decisions: input.randomDecisions.length,
      domainEvents: input.domainEvents.length,
      ledgerEntries: input.financialLedger.length,
    },
    randomDecisions: input.randomDecisions,
    domainEvents: input.domainEvents,
    financialLedger: input.financialLedger,
  };
}

export function renderEngineAuditText(report: EngineAuditReport, title: string): string {
  const lines = [
    title,
    `${report.counts.decisions} decisions, ${report.counts.domainEvents} events, ${report.counts.ledgerEntries} ledger entries`,
    "",
    "-- Random decisions --",
    ...report.randomDecisions.map(
      (d) => `[${d.phase}] ${d.purpose} ${d.entityKey}: ${d.value} (${d.outcome})`,
    ),
    "",
    "-- Domain events --",
    ...report.domainEvents.map((e) => `${e.id} [${e.kind}]: ${e.message}`),
    "",
    "-- Financial ledger --",
    ...report.financialLedger.map((e) => `${e.id}: ${e.description} (${e.amount})`),
  ];
  return lines.join("\n");
}

interface ScriptedForceOrderBase {
  readonly issueTurn: number;
  readonly divisionId: string;
}

export type RawScriptedForceOrder =
  | (ScriptedForceOrderBase & {
      readonly orderType: "change_lead_division";
      readonly newLeadShipId: string;
    })
  | (ScriptedForceOrderBase & { readonly orderType: "target_ship" })
  | (ScriptedForceOrderBase & {
      readonly orderType: "flotilla_attack";
      readonly targetDivisionId: string;
    })
  | (ScriptedForceOrderBase & {
      readonly orderType: "rally";
      readonly rallyPoint: { readonly x: number; readonly y: number };
    })
  | (ScriptedForceOrderBase & { readonly orderType: "disengage" });
