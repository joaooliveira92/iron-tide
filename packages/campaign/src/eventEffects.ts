import type {
  EventAnswer,
  EventAnswerEffectRules,
  EventCounterpartRole,
  NationTrait,
} from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { APPROPRIATION_RATE_MAX_BP, APPROPRIATION_RATE_MIN_BP } from "./budgetConstants.js";
import { monthIndex } from "./eventDraw.js";
import type { PrestigeRule } from "./prestige.js";
import type { BudgetModifier, NationState } from "./state.js";
import { TENSION_MAX, TENSION_MIN } from "./tensionDrift.js";

export const UNREST_MIN = 0 as const;
export const UNREST_MAX = 10 as const;

export function nextMonthId(month: string): string {
  const index = monthIndex(month) + 1;
  const year = Math.floor(index / 12);
  const number = (index % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(number).padStart(2, "0")}`;
}

export function budgetModifierBp(modifier: BudgetModifier, month: string): number {
  const offset = Math.max(0, monthIndex(month) - monthIndex(modifier.firstMonth));
  if (offset >= modifier.decayMonths) return 0;
  return Math.trunc((modifier.initialBp * (modifier.decayMonths - offset)) / modifier.decayMonths);
}

export function activeBudgetModifiers(
  modifiers: readonly BudgetModifier[],
  month: string,
): BudgetModifier[] {
  return modifiers.filter((modifier) => budgetModifierBp(modifier, month) !== 0);
}

export function budgetModifierTotalBp(modifiers: readonly BudgetModifier[], month: string): number {
  const active = activeBudgetModifiers(modifiers, month);
  if (active.length === 0) return 0;
  const cap = active.reduce((largest, modifier) => Math.max(largest, modifier.capBp), 0);
  const sum = active.reduce((total, modifier) => total + budgetModifierBp(modifier, month), 0);
  return Math.min(cap, Math.max(-cap, sum));
}

export function effectiveAppropriationRateBp(
  nation: Pick<NationState, "navalAppropriationRateBp" | "budgetModifiers">,
  month: string,
): SafeInt {
  const total = budgetModifierTotalBp(nation.budgetModifiers ?? [], month);
  if (total === 0) return nation.navalAppropriationRateBp;
  const rate = (nation.navalAppropriationRateBp as number) + total;
  return SafeInt(Math.min(APPROPRIATION_RATE_MAX_BP, Math.max(APPROPRIATION_RATE_MIN_BP, rate)));
}

export function applyUnrestDelta(current: number | undefined, delta: number): number {
  return Math.min(UNREST_MAX, Math.max(UNREST_MIN, (current ?? 0) + delta));
}

export function applyTensionJump(current: number, delta: number, cap: number): number {
  const jump = Math.min(cap, Math.max(-cap, delta));
  return Math.min(TENSION_MAX, Math.max(TENSION_MIN, current + jump));
}

export interface PlannedPrestige {
  readonly reasonCode: string;
  readonly rule: PrestigeRule;
}

export interface PlannedEffectLine {
  readonly source: "DECLARED" | "TRAIT";
  readonly trait?: NationTrait;
  readonly reasonCode?: string;
  readonly budgetBp: number;
  readonly unrestDelta: number;
  readonly tensionDelta: number;
  readonly prestige?: PlannedPrestige;
}

export interface AnswerEffectPlan {
  readonly lines: readonly PlannedEffectLine[];
  readonly unrest: number;
  readonly counterpart?: EventCounterpartRole;
  readonly tension: number;
}

function declaredPrestige(effects: EventAnswer["effects"]): PlannedPrestige | undefined {
  const prestige = effects.prestige;
  if (prestige === undefined) return undefined;
  const rule: PrestigeRule =
    prestige.kind === "PROPORTIONAL_LOSS"
      ? { kind: "PROPORTIONAL_LOSS", basisPoints: SafeInt(prestige.basisPoints) }
      : { kind: prestige.kind, amount: SafeInt(prestige.amount) };
  return { reasonCode: prestige.reasonCode, rule };
}

function traitPrestige(reasonCode: string, delta: number | undefined): PlannedPrestige | undefined {
  if (delta === undefined || delta === 0) return undefined;
  return {
    reasonCode,
    rule:
      delta > 0
        ? { kind: "FIXED_GAIN", amount: SafeInt(delta) }
        : { kind: "FIXED_LOSS", amount: SafeInt(-delta) },
  };
}

export function planAnswerEffects(
  answer: EventAnswer,
  traits: readonly NationTrait[],
  rules: EventAnswerEffectRules,
): AnswerEffectPlan {
  const { effects } = answer;
  const declared = declaredPrestige(effects);
  const lines: PlannedEffectLine[] = [
    {
      source: "DECLARED",
      budgetBp: effects.budgetBp,
      unrestDelta: effects.unrest,
      tensionDelta: effects.tension?.delta ?? 0,
      ...(declared === undefined ? {} : { prestige: declared }),
    },
  ];
  const counterpart = effects.tension?.counterpart;
  const matching = rules.traitEffects
    .filter((entry) => entry.stance === answer.stance && traits.includes(entry.trait))
    .sort((a, b) => (a.trait < b.trait ? -1 : a.trait > b.trait ? 1 : 0));
  for (const entry of matching) {
    const prestige = traitPrestige(entry.reasonCode, entry.prestige);
    lines.push({
      source: "TRAIT",
      trait: entry.trait,
      reasonCode: entry.reasonCode,
      budgetBp: entry.budgetBp ?? 0,
      unrestDelta: entry.unrest ?? 0,
      tensionDelta: counterpart === undefined ? 0 : (entry.tension ?? 0),
      ...(prestige === undefined ? {} : { prestige }),
    });
  }
  const rawTension = lines.reduce((sum, line) => sum + line.tensionDelta, 0);
  return {
    lines,
    unrest: lines.reduce((sum, line) => sum + line.unrestDelta, 0),
    ...(counterpart === undefined ? {} : { counterpart }),
    tension: Math.min(rules.tensionJumpCap, Math.max(-rules.tensionJumpCap, rawTension)),
  };
}
