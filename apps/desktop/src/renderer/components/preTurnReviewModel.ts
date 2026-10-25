import {
  NEAR_COMPLETION_WORK_RATIO,
  type PlayerProjectionEconomy,
  type StrategicPriority,
} from "@bluewave/campaign-engine";

export type LedgerKind = "opening" | "income" | "outgo" | "closing";

export type LedgerLineId =
  | "opening"
  | "appropriation"
  | "construction"
  | "maintenance"
  | "obligations"
  | "research"
  | "closing";

export interface LedgerLine {
  readonly id: LedgerLineId;
  readonly label: string;
  readonly kind: LedgerKind;
  readonly amount: number;
  readonly from: number;
  readonly to: number;
  readonly start: number;
  readonly end: number;
}

export interface Ledger {
  readonly lines: readonly LedgerLine[];
  readonly totalOutgoings: number;
  readonly shortfall: number;
}

const OUTGOING_ORDER = [
  {
    id: "construction",
    label: "Construction",
    pick: (e: PlayerProjectionEconomy) => e.plannedConstruction,
  },
  {
    id: "maintenance",
    label: "Fleet upkeep",
    pick: (e: PlayerProjectionEconomy) => e.maintenanceCost,
  },
  { id: "obligations", label: "Obligations", pick: (e: PlayerProjectionEconomy) => e.obligations },
  { id: "research", label: "Research", pick: (e: PlayerProjectionEconomy) => e.researchSpend },
] as const;

export function buildLedger(economy: PlayerProjectionEconomy): Ledger {
  const totalOutgoings = OUTGOING_ORDER.reduce((sum, outgoing) => sum + outgoing.pick(economy), 0);
  const treasuryScale = Math.max(1, economy.treasury, economy.monthEndTreasury);
  const flowScale = Math.max(1, economy.monthlyAppropriation, totalOutgoings);
  const lines: LedgerLine[] = [
    {
      id: "opening",
      label: "Opening treasury",
      kind: "opening",
      amount: economy.treasury,
      from: 0,
      to: economy.treasury,
      start: 0,
      end: economy.treasury / treasuryScale,
    },
    {
      id: "appropriation",
      label: "Appropriation",
      kind: "income",
      amount: economy.monthlyAppropriation,
      from: economy.treasury,
      to: economy.treasury + economy.monthlyAppropriation,
      start: 0,
      end: economy.monthlyAppropriation / flowScale,
    },
  ];
  let balance = economy.treasury + economy.monthlyAppropriation;
  let spent = 0;
  for (const outgoing of OUTGOING_ORDER) {
    const amount = outgoing.pick(economy);
    const to = Math.max(0, balance - amount);
    lines.push({
      id: outgoing.id,
      label: outgoing.label,
      kind: "outgo",
      amount,
      from: balance,
      to,
      start: spent / flowScale,
      end: (spent + amount) / flowScale,
    });
    spent += amount;
    balance = to;
  }
  lines.push({
    id: "closing",
    label: "Month-end treasury",
    kind: "closing",
    amount: economy.monthEndTreasury,
    from: 0,
    to: economy.monthEndTreasury,
    start: 0,
    end: economy.monthEndTreasury / treasuryScale,
  });
  return { lines, totalOutgoings, shortfall: economy.shortfall };
}

export function barSpan(line: LedgerLine): { left: number; width: number } {
  return { left: line.start * 100, width: Math.max((line.end - line.start) * 100, 0.8) };
}

export function shareOf(amount: number, whole: number): number {
  return whole > 0 ? amount / whole : 0;
}

export type VerdictKind = "clear" | "caution" | "hold";

export interface Verdict {
  readonly kind: VerdictKind;
  readonly label: string;
  readonly detail: string;
}

export function reviewVerdict(
  priorities: readonly StrategicPriority[],
  economy: PlayerProjectionEconomy | null,
): Verdict {
  const critical = priorities.filter((p) => p.severity === "critical").length;
  const warnings = priorities.filter((p) => p.severity === "warning").length;
  const unfunded = economy !== null && (economy.shortfall > 0 || economy.status === "critical");
  if (critical > 0 || unfunded) {
    const count = critical + (unfunded && critical === 0 ? 1 : 0);
    return {
      kind: "hold",
      label: "Hold advised",
      detail: unfunded
        ? "The month cannot be fully paid for"
        : `${String(count)} critical ${count === 1 ? "matter" : "matters"} outstanding`,
    };
  }
  if (warnings > 0 || (economy !== null && economy.status === "deficit")) {
    const count = warnings + (warnings === 0 ? 1 : 0);
    return {
      kind: "caution",
      label: "Proceed with care",
      detail: `${String(count)} ${count === 1 ? "warning" : "warnings"} on the watch-list`,
    };
  }
  return { kind: "clear", label: "Clear to sail", detail: "Nothing needs your attention" };
}

const SEVERITY_ORDER: Readonly<Record<StrategicPriority["severity"], number>> = {
  critical: 0,
  warning: 1,
  advisory: 2,
  information: 3,
};

export function sortByUrgency(
  priorities: readonly StrategicPriority[],
): readonly StrategicPriority[] {
  return priorities
    .map((priority, index) => ({ priority, index }))
    .toSorted(
      (a, b) =>
        SEVERITY_ORDER[a.priority.severity] - SEVERITY_ORDER[b.priority.severity] ||
        a.index - b.index,
    )
    .map(({ priority }) => priority);
}

export function severityLevel(severity: StrategicPriority["severity"]): number {
  return 4 - SEVERITY_ORDER[severity];
}

export interface PipelineProject {
  readonly id: string;
  readonly className: string;
  readonly shipType: string;
  readonly status: string;
  readonly completedWork: number;
  readonly totalWork: number;
  readonly paidWork: number;
  readonly progress: number;
  readonly nearCompletion: boolean;
}

export function pipelineOf(
  projects: readonly {
    readonly projectId: string;
    readonly className: string;
    readonly shipType: string;
    readonly status: string;
    readonly completedWork: number;
    readonly totalWork: number;
    readonly paidWork: number;
  }[],
): readonly PipelineProject[] {
  return projects
    .filter((project) => project.status !== "COMPLETED")
    .map((project) => {
      const progress = shareOf(project.completedWork, project.totalWork);
      return {
        id: project.projectId,
        className: project.className,
        shipType: project.shipType,
        status: project.status,
        completedWork: project.completedWork,
        totalWork: project.totalWork,
        paidWork: project.paidWork,
        progress: Math.min(1, progress),
        nearCompletion: project.totalWork > 0 && progress >= NEAR_COMPLETION_WORK_RATIO,
      };
    })
    .toSorted((a, b) => b.progress - a.progress);
}
