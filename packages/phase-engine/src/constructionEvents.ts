import type { ConstructionProject } from "@bluewave/campaign";
import type { ConstructionEvent } from "@bluewave/content-schema";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { RandomDecision, RandomEngine, RandomLedger } from "@bluewave/random";

export const CONSTRUCTION_EVENT_STREAM_FAMILY = "construction/month/project/event" as const;
export const CONSTRUCTION_EVENT_POLICY_ID = "construction_events_v1" as const;
export const CONSTRUCTION_EVENT_CONTINUED = "CONSTRUCTION_EVENT_CONTINUED" as const;

const DRAW_RANGE_BP = 10_000;

const BEING_BUILT: ReadonlySet<ConstructionProject["status"]> = new Set(["ACTIVE", "ACCELERATED"]);

export interface ConstructionEventSubject {
  readonly id: string;
  readonly status: ConstructionProject["status"];
}

export interface ConstructionEventDelay {
  readonly projectId: string;
  readonly eventId: string;
  readonly reasonCode: string;
}

export interface ConstructionEventResolution {
  readonly delays: readonly ConstructionEventDelay[];
}

export interface ConstructionEventInput {
  readonly nationId: string;
  readonly campaignMonth: string;
  readonly projects: readonly ConstructionEventSubject[];
  readonly rules: readonly ConstructionEvent[];
  readonly randomEngine: RandomEngine;
  readonly randomLedger: RandomLedger;
}

const byId = (a: { readonly id: string }, b: { readonly id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const inWindow = (rule: ConstructionEvent, month: string): boolean =>
  rule.eraWindow === undefined ||
  (rule.eraWindow.fromMonth <= month && month <= rule.eraWindow.toMonth);

export function resolveConstructionEvents(
  input: ConstructionEventInput,
): ConstructionEventResolution {
  const rules = input.rules
    .filter((rule) => rule.kind === "DELAY" && inWindow(rule, input.campaignMonth))
    .sort(byId);
  if (rules.length === 0) return { delays: [] };

  const delays: ConstructionEventDelay[] = [];
  const projects = input.projects.filter((p) => BEING_BUILT.has(p.status)).sort(byId);
  for (const project of projects) {
    for (const rule of rules) {
      const stream = input.randomEngine.stream(
        `${CONSTRUCTION_EVENT_STREAM_FAMILY}/${input.nationId}/${input.campaignMonth}/${project.id}/${rule.id}`,
      );
      const draw = Math.floor(stream.next() * DRAW_RANGE_BP);
      const hit = draw < rule.probabilityBp;
      const decision: RandomDecision = {
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
            probabilityBp: rule.probabilityBp,
          }),
        ),
        draw,
        outcome: hit ? "DELAYED" : "CONTINUED",
        reasonCode: hit ? rule.reasonCode : CONSTRUCTION_EVENT_CONTINUED,
      };
      input.randomLedger.record(decision);
      if (!hit) continue;
      delays.push({ projectId: project.id, eventId: rule.id, reasonCode: rule.reasonCode });
      break;
    }
  }
  return { delays };
}
