//packages/combat/src/aircraft/ordering.ts
// DESIGN-43 §39 canonical ordering for aircraft resolution.
import type {
  AircraftDevelopmentProject,
  AircraftProposal,
  SquadronState,
  BasingSlot,
} from "./state.js";

export function compareStrings(a: string, b: string): number {
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) return a.charCodeAt(i) - b.charCodeAt(i);
  }
  return a.length - b.length;
}

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
