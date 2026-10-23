import { compareStrings } from "../core/ordering.js";
import type {
  AircraftDevelopmentProject,
  AircraftProposal,
  SquadronState,
  BasingSlot,
} from "./state.js";

export function compareDevelopmentProjects(
  a: AircraftDevelopmentProject,
  b: AircraftDevelopmentProject,
): number {
  const byMonth = compareStrings(a.startMonth, b.startMonth);
  if (byMonth !== 0) return byMonth;
  return compareStrings(a.developmentProjectId, b.developmentProjectId);
}

export function compareProposals(a: AircraftProposal, b: AircraftProposal): number {
  const byMonth = compareStrings(a.expiryMonth, b.expiryMonth);
  if (byMonth !== 0) return byMonth;
  return compareStrings(a.proposalId, b.proposalId);
}

export function compareSquadrons(a: SquadronState, b: SquadronState): number {
  return compareStrings(a.squadronId, b.squadronId);
}

export function compareBasingSlots(a: BasingSlot, b: BasingSlot): number {
  const byHost = compareStrings(a.hostId, b.hostId);
  if (byHost !== 0) return byHost;
  return compareStrings(a.squadronId ?? "", b.squadronId ?? "");
}

export function canonicallySorted<T>(items: readonly T[], compare: (a: T, b: T) => number): T[] {
  return [...items].sort(compare);
}
