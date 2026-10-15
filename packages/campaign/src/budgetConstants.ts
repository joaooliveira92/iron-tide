// ADR-0060: player budget allocation bounds (versioned ruleset constants).
/** Naval appropriation as basis points of the national base resources (per year). */
export const APPROPRIATION_RATE_MIN_BP = 500;
export const APPROPRIATION_RATE_MAX_BP = 5000;
/** Standing monthly research budget, in treasury units. */
export const RESEARCH_BUDGET_MIN = 0;
export const RESEARCH_BUDGET_MAX = 1000;
