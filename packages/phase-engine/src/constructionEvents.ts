import type { ConstructionProject } from "@bluewave/campaign";
import type { ConstructionEvent, ConstructionOverrunEvent } from "@bluewave/content-schema";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { RandomDecision, RandomEngine, RandomLedger } from "@bluewave/random";

export const CONSTRUCTION_EVENT_STREAM_FAMILY = "construction/month/project/event" as const;
export const CONSTRUCTION_EVENT_POLICY_ID = "construction_events_v1" as const;
export const CONSTRUCTION_EVENT_CONTINUED = "CONSTRUCTION_EVENT_CONTINUED" as const;
export const CONSTRUCTION_OVERRUN_MAGNITUDE = "OVERRUN_MAGNITUDE" as const;
export const CONSTRUCTION_DELAY_MONTHS = "DELAY_MONTHS" as const;

const DRAW_RANGE_BP = 10_000;
const FULL_CAPACITY_BP = 10_000;

const BEING_BUILT: ReadonlySet<ConstructionProject["status"]> = new Set(["ACTIVE", "ACCELERATED"]);

export interface ConstructionEventSubject {
  readonly id: string;
  readonly status: ConstructionProject["status"];
  readonly homeBuild: boolean;
  readonly remainingWork: number;
  readonly originalWork: number;
  readonly overrunWork: number;
}

export interface ConstructionEventDelay {
  readonly projectId: string;
  readonly eventId: string;
  readonly reasonCode: string;
  readonly months: number;
}

export interface ConstructionEventOverrun {
  readonly projectId: string;
  readonly eventId: string;
  readonly reasonCode: string;
  readonly percentBp: number;
  readonly amount: number;
}

export interface ConstructionEventResolution {
  readonly delays: readonly ConstructionEventDelay[];
  readonly overruns: readonly ConstructionEventOverrun[];
}

export interface ConstructionEventInput {
  readonly nationId: string;
  readonly campaignMonth: string;
  readonly projects: readonly ConstructionEventSubject[];
  readonly rules: readonly ConstructionEvent[];
  readonly capacityPressureBp?: number;
  readonly randomEngine: RandomEngine;
  readonly randomLedger: RandomLedger;
}

const byId = (a: { readonly id: string }, b: { readonly id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const inWindow = (rule: ConstructionEvent, month: string): boolean =>
  rule.eraWindow === undefined ||
  (rule.eraWindow.fromMonth <= month && month <= rule.eraWindow.toMonth);

const shareOf = (work: number, bp: number): number =>
  Number((BigInt(work) * BigInt(bp)) / BigInt(DRAW_RANGE_BP));

const capRoom = (rule: ConstructionOverrunEvent, project: ConstructionEventSubject): number =>
  shareOf(project.originalWork, rule.capBp) - project.overrunWork;

const effectiveProbabilityBp = (rule: ConstructionEvent, capacityPressureBp: number): number =>
  rule.kind === "DELAY" && capacityPressureBp > FULL_CAPACITY_BP
    ? Math.min(
        DRAW_RANGE_BP,
        Number(
          (BigInt(rule.probabilityBp) * BigInt(rule.pressureMultiplierBp)) / BigInt(DRAW_RANGE_BP),
        ),
      )
    : rule.probabilityBp;

export function resolveConstructionEvents(
  input: ConstructionEventInput,
): ConstructionEventResolution {
  const rules = input.rules.filter((rule) => inWindow(rule, input.campaignMonth)).sort(byId);
  if (rules.length === 0) return { delays: [], overruns: [] };

  const delays: ConstructionEventDelay[] = [];
  const overruns: ConstructionEventOverrun[] = [];
  const projects = input.projects.filter((p) => BEING_BUILT.has(p.status)).sort(byId);
  for (const project of projects) {
    for (const rule of rules) {
      if (!project.homeBuild) continue;
      if (rule.kind === "OVERRUN" && capRoom(rule, project) <= 0) continue;
      const probabilityBp = effectiveProbabilityBp(rule, input.capacityPressureBp ?? 0);
      const streamId = `${CONSTRUCTION_EVENT_STREAM_FAMILY}/${input.nationId}/${input.campaignMonth}/${project.id}/${rule.id}`;
      const draw = Math.floor(input.randomEngine.stream(streamId).next() * DRAW_RANGE_BP);
      const decision = (outcome: string, reasonCode: string, value = draw): RandomDecision => ({
        streamId: CONSTRUCTION_EVENT_STREAM_FAMILY,
        entityKey: project.id,
        phase: "appropriation",
        rulesetVersion: CONSTRUCTION_EVENT_POLICY_ID,
        inputHash: sha256Hex(
          canonicalSerialize({
            nationId: input.nationId,
            projectId: project.id,
            campaignMonth: input.campaignMonth,
            eventId: rule.id,
            probabilityBp,
          }),
        ),
        draw: value,
        outcome,
        reasonCode,
      });
      if (draw >= probabilityBp) {
        input.randomLedger.record(decision("CONTINUED", CONSTRUCTION_EVENT_CONTINUED));
        continue;
      }
      if (rule.kind === "DELAY") {
        const lengths = input.randomEngine.stream(`${streamId}/months`);
        const months =
          rule.minMonths + Math.floor(lengths.next() * (rule.maxMonths - rule.minMonths + 1));
        input.randomLedger.record(decision("DELAYED", rule.reasonCode));
        input.randomLedger.record(decision(CONSTRUCTION_DELAY_MONTHS, rule.reasonCode, months));
        delays.push({
          projectId: project.id,
          eventId: rule.id,
          reasonCode: rule.reasonCode,
          months,
        });
        break;
      }
      const magnitude = input.randomEngine.stream(`${streamId}/magnitude`);
      const percentBp = rule.minBp + Math.floor(magnitude.next() * (rule.maxBp - rule.minBp + 1));
      const amount = Math.min(shareOf(project.remainingWork, percentBp), capRoom(rule, project));
      if (amount <= 0) {
        input.randomLedger.record(decision("CONTINUED", CONSTRUCTION_EVENT_CONTINUED));
        continue;
      }
      input.randomLedger.record(decision("OVERRUN", rule.reasonCode));
      input.randomLedger.record(
        decision(CONSTRUCTION_OVERRUN_MAGNITUDE, rule.reasonCode, percentBp),
      );
      overruns.push({
        projectId: project.id,
        eventId: rule.id,
        reasonCode: rule.reasonCode,
        percentBp,
        amount,
      });
      break;
    }
  }
  return { delays, overruns };
}
