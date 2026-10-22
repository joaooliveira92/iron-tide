import type {
  TurnMessageDto,
  TurnSummaryEntry,
} from "../../../shared/campaign-command-contract.js";

export const SEVERITY_ORDER = ["CRITICAL", "HIGH", "NORMAL", "LOW", "TRACE"] as const;

export const CATEGORY_ORDER = [
  "DECISION",
  "DIPLOMACY",
  "WAR",
  "BATTLE",
  "CONSTRUCTION",
  "RESEARCH",
  "INTELLIGENCE",
  "FINANCE",
  "SYSTEM",
] as const;

export function categoriesPresent(messages: readonly TurnMessageDto[]): readonly string[] {
  const present = new Set(messages.map((message) => message.category));
  return CATEGORY_ORDER.filter((category) => present.has(category));
}

export function isActionable(message: TurnMessageDto): boolean {
  return (
    message.severity === "CRITICAL" ||
    message.severity === "HIGH" ||
    message.blocking ||
    message.requiresAcknowledgement
  );
}

export interface TurnSummaryFilters {
  readonly category: string;
  readonly severity: string;
  readonly actionableOnly: boolean;
  readonly search: string;
}

export const DEFAULT_FILTERS: TurnSummaryFilters = {
  category: "ALL",
  severity: "ALL",
  actionableOnly: false,
  search: "",
};

function searchCorpus(message: TurnMessageDto): string {
  const parts = [message.category, message.severity, message.titleKey, message.bodyKey];
  for (const value of Object.values(message.interpolation)) parts.push(String(value));
  for (const ref of message.subjectRefs) parts.push(`${ref.type}:${ref.id}`);
  return parts.join(" ").toLowerCase();
}

export function filterTurnMessages(
  messages: readonly TurnMessageDto[],
  filters: TurnSummaryFilters,
): TurnMessageDto[] {
  const needle = filters.search.trim().toLowerCase();
  return messages.filter((message) => {
    if (filters.actionableOnly && !isActionable(message)) return false;
    if (filters.category !== "ALL" && message.category !== filters.category) return false;
    if (filters.severity !== "ALL" && message.severity !== filters.severity) return false;
    if (needle.length > 0 && !searchCorpus(message).includes(needle)) return false;
    return true;
  });
}

export interface TurnMessageGroup {
  readonly category: string;
  readonly messages: readonly TurnMessageDto[];
}

export function groupTurnMessages(
  messages: readonly TurnMessageDto[],
): readonly TurnMessageGroup[] {
  const groups: TurnMessageGroup[] = [];
  for (const category of categoriesPresent(messages)) {
    const inCategory = messages
      .filter((message) => message.category === category)
      .sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );
    if (inCategory.length > 0) {
      groups.push({ category, messages: inCategory });
    }
  }
  return groups;
}

export function turnLabel(entry: TurnSummaryEntry): string {
  return entry.occurredAt.length > 0 ? entry.occurredAt : entry.turnId.slice(0, 8);
}
