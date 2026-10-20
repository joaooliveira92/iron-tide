import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardFinding } from "./validation/boardFindings.js";

/** The severities that stop a design being built or put it at serious risk: the ones a choice must be warned about. */
const SERIOUS = new Set(["BLOCKING", "CRITICAL"]);

/** What a choice caused: the field the player changed, what they chose, and the findings it introduced. */
export interface ChoiceProblem {
  readonly field: string;
  readonly choice: string;
  readonly findings: readonly BoardFinding[];
}

interface Pending {
  readonly field: string;
  readonly choice: string;
  readonly base: readonly BoardFinding[];
}

/** The findings that are serious and were not in `before`. Pure, so it is tested without React. */
export function introducedProblems(
  before: readonly BoardFinding[],
  after: readonly BoardFinding[],
): BoardFinding[] {
  const known = new Set(before.map((f) => f.key));
  return after.filter((f) => SERIOUS.has(f.severity) && !known.has(f.key));
}

/**
 * Watches the findings after a field is changed. When the change introduced a blocking or critical finding, it
 * reports it (to open an explanation) and keeps it attached to that field, so the field stays marked invalid
 * for as long as the finding remains.
 */
export function useChoiceCheck(findings: readonly BoardFinding[]) {
  const pending = useRef<Pending | null>(null);
  const latest = useRef(findings);
  const [problem, setProblem] = useState<ChoiceProblem | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    latest.current = findings;
    const p = pending.current;
    if (p === null || findings === p.base) return;
    pending.current = null;
    const added = introducedProblems(p.base, findings);
    if (added.length === 0) return;
    setProblem({ field: p.field, choice: p.choice, findings: added });
    setOpen(true);
  }, [findings]);

  /** Applies a change to `field`, then checks what it did to the findings. */
  const guard = useCallback((field: string, choice: string, apply: () => void) => {
    pending.current = { field, choice, base: latest.current };
    apply();
  }, []);

  const stillBroken =
    problem === null ? [] : problem.findings.filter((f) => findings.some((g) => g.key === f.key));
  /** The inline message for `field`, while the finding its change caused is still present. */
  const errorFor = (field: string): string | undefined =>
    problem?.field === field && stillBroken.length > 0 ? stillBroken[0]?.title : undefined;

  return {
    guard,
    errorFor,
    problem:
      stillBroken.length > 0 && problem !== null ? { ...problem, findings: stillBroken } : null,
    open,
    setOpen,
  };
}
