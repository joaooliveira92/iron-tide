import { describe, expect, it } from "vite-plus/test";
import type { TurnMessageDto } from "../../../shared/campaign-command-contract.js";
import {
  DEFAULT_FILTERS,
  filterTurnMessages,
  groupTurnMessages,
  isActionable,
} from "./turn-summary-format.js";

const message = (over: Partial<TurnMessageDto> & { id: string }): TurnMessageDto => ({
  turnId: "turn-1",
  occurredAt: "1880-02",
  phase: "construction_processing",
  category: "CONSTRUCTION",
  severity: "LOW",
  titleKey: "messages.construction.progress.title",
  bodyKey: "messages.construction.progress.body",
  interpolation: { count: 2 },
  subjectRefs: [{ type: "constructionProject", id: "p1" }],
  effectRefs: [],
  blocking: false,
  requiresAcknowledgement: false,
  playerVisible: true,
  ...over,
});

describe("turn-summary-format", () => {
  it("filters by severity, category, actionable-only, and search", () => {
    const messages = [
      message({
        id: "a",
        category: "FINANCE",
        severity: "CRITICAL",
        interpolation: { nationId: "uk" },
      }),
      message({ id: "b", category: "CONSTRUCTION", severity: "LOW" }),
      message({ id: "c", category: "RESEARCH", severity: "NORMAL" }),
    ];
    expect(filterTurnMessages(messages, DEFAULT_FILTERS)).toHaveLength(3);
    expect(
      filterTurnMessages(messages, { ...DEFAULT_FILTERS, severity: "CRITICAL" }).map((m) => m.id),
    ).toEqual(["a"]);
    expect(
      filterTurnMessages(messages, { ...DEFAULT_FILTERS, category: "RESEARCH" }).map((m) => m.id),
    ).toEqual(["c"]);
    expect(
      filterTurnMessages(messages, { ...DEFAULT_FILTERS, actionableOnly: true }).map((m) => m.id),
    ).toEqual(["a"]);
    expect(
      filterTurnMessages(messages, { ...DEFAULT_FILTERS, search: "uk" }).map((m) => m.id),
    ).toEqual(["a"]);
  });

  it("groups by category in canonical order with most-severe first", () => {
    const messages = [
      message({ id: "b", category: "CONSTRUCTION", severity: "LOW" }),
      message({ id: "a", category: "CONSTRUCTION", severity: "HIGH" }),
      message({ id: "c", category: "FINANCE", severity: "NORMAL" }),
    ];
    const groups = groupTurnMessages(messages);
    expect(groups.map((g) => g.category)).toEqual(["CONSTRUCTION", "FINANCE"]);
    expect(groups[0]?.messages.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("treats high/critical/blocking/acknowledgement as actionable", () => {
    expect(isActionable(message({ id: "x", severity: "HIGH" }))).toBe(true);
    expect(isActionable(message({ id: "x", severity: "CRITICAL" }))).toBe(true);
    expect(isActionable(message({ id: "x", severity: "LOW", blocking: true }))).toBe(true);
    expect(
      isActionable(message({ id: "x", severity: "NORMAL", requiresAcknowledgement: true })),
    ).toBe(true);
    expect(isActionable(message({ id: "x", severity: "LOW" }))).toBe(false);
  });
});
