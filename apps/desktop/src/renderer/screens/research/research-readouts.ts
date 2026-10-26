import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import type { EngineeringReadout } from "../shipbuilding/engineering-status.js";
import type { ResearchViewModel } from "./research-view-model.js";

export function researchReadouts(
  vm: ResearchViewModel,
  format: PresentationFormat,
): readonly EngineeringReadout[] {
  const { budget, totals } = vm;
  const headroom = Math.max(0, budget.cap - budget.monthly);

  const readouts: EngineeringReadout[] = [
    {
      id: "budget",
      label: "Monthly budget",
      value: format.count(budget.paid),
      tone: budget.note === null ? "neutral" : "warn",
      breakdown: {
        title: "Standing research spend",
        rows: [
          { label: "Requested each month", value: format.count(budget.monthly) },
          { label: "Paid each month", value: format.count(budget.paid) },
          ...(budget.annualAllocation === null
            ? []
            : [
                {
                  label: "Authored annual allocation",
                  value: format.count(budget.annualAllocation),
                },
              ]),
          { label: "Monthly cap (12% of appropriation)", value: format.count(budget.cap) },
          { label: "Guidance floor (8%)", value: format.count(budget.floor) },
        ],
        footer: [{ label: "Headroom under the cap", value: format.count(headroom) }],
        causes: budget.note === null ? [] : [budget.note],
      },
      explanations: [
        ...(budget.budgetExplanation === undefined
          ? []
          : [
              {
                tree: budget.budgetExplanation,
                area: "research",
                summaryKey: "research.research_budget.summary",
              },
            ]),
        ...(budget.capExplanation === undefined
          ? []
          : [
              {
                tree: budget.capExplanation,
                area: "research",
                summaryKey: "research.research_cap.summary",
              },
            ]),
        ...(budget.floorExplanation === undefined
          ? []
          : [
              {
                tree: budget.floorExplanation,
                area: "research",
                summaryKey: "research.research_floor.summary",
              },
            ]),
      ],
    },
    {
      id: "output",
      label: "Output",
      value: `${format.count(totals.projectedPoints)} pts/month`,
      tone: totals.projectedPoints === 0 && budget.monthly > 0 ? "warn" : "neutral",
      hint: {
        title: "Where the budget lands next turn",
        lines: [
          { label: "Fields funded", value: format.count(totals.fundedFields) },
          { label: "Fields with nothing open", value: format.count(totals.idleFields) },
          { label: "Technologies being researched", value: format.count(totals.researching) },
        ],
      },
    },
    {
      id: "priorities",
      label: "High priority",
      value: `${vm.highCount} / ${vm.highCap}`,
      tone: vm.highCountValid ? "neutral" : "bad",
      hint: {
        title: "High priority fields",
        lines: [
          { label: "Weight scale", value: "High 4 · Medium 2 · Low 1" },
          { label: "Allowed High fields", value: `1 to ${vm.highCap}` },
        ],
      },
    },
    {
      id: "discovered",
      label: "Discovered",
      value: `${format.count(totals.discovered)} / ${format.count(totals.catalogue)}`,
      tone: "neutral",
      hint: {
        title: "Technology archive",
        lines: [
          { label: "Discovered", value: format.count(totals.discovered) },
          { label: "Open to research", value: format.count(totals.open + totals.researching) },
          {
            label: "Still locked or in the future",
            value: format.count(
              totals.catalogue - totals.discovered - totals.open - totals.researching,
            ),
          },
        ],
      },
    },
  ];

  if (budget.lowSpending) {
    readouts.splice(1, 0, {
      id: "floor",
      label: "Spending",
      value: "Below guidance",
      tone: "warn",
      hint: {
        title: "Research is under the 8% guidance",
        lines: [
          { label: "Planned", value: format.count(budget.monthly) },
          { label: "Guidance floor", value: format.count(budget.floor) },
        ],
      },
      ...(budget.floorExplanation === undefined
        ? {}
        : {
            explanations: [
              {
                tree: budget.floorExplanation,
                area: "research",
                summaryKey: "research.research_floor.summary",
              },
            ],
          }),
    });
  }

  return readouts;
}
