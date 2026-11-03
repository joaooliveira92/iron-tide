# Adversarial Review Prompt

Review the proposed milestone as a hostile but constructive verifier. Do not merely summarize it and do not edit until the review is complete.

## Establish scope

Read the canonical design, engineering contract, requirement index, milestone brief, Git diff, tests, validation report, and changed canonical artifacts. Verify the actual repository and command results.

## Review dimensions

Inspect for:

1. Canonical requirement violations or silently invented rules
2. Scope creep or deferred systems presented as complete
3. Package cycles, internal-source imports, and platform leakage into domain packages
4. Confusion among canonical, derived, cached, ledger, and ephemeral state
5. Mutability, ownership leaks, or commands changing state directly
6. Unsafe integers, implicit floating point, overflow, and unspecified rounding
7. Nondeterministic object, map, set, filesystem, diagnostic, or collection ordering
8. Global or consumptive RNG misuse and unstable stream keys
9. Command lifecycle bypass, stale-snapshot handling, and idempotency conflicts
10. Ledger imbalance or untraceable financial mutation
11. Save, serializer, formula, RNG, command, and event compatibility errors
12. Silent migration or approximate continuation of historical state
13. Unstable or content-dependent diagnostic messages used as codes
14. Unsafe YAML, unknown-field passthrough, traversal, shell composition, temporary-file, or archive behavior
15. Cancellation leaks and partial committed outputs
16. Electron IPC, preload, navigation, CSP, and renderer-authority risks when applicable
17. Tests that can pass without proving behavior, oversized snapshots, or golden regeneration without cause
18. Unnecessary abstractions, speculative packages, and premature optimization
19. Missing traceability, documentation, or validation evidence
20. Git or delivery-policy violations
21. Gaps against the task brief's problem and acceptance criteria, not only against the diff's own claims
22. Unrelated modifications, unsafe or unjustified dependencies, and missing rollback instructions

## Required output

For every finding provide:

- class: required, recommended, or unrelated to this task ([task lifecycle](../docs/agents/task-lifecycle.md));
- severity: blocker, high, medium, low;
- requirement ID or contract section;
- exact file and symbol or line range;
- observed evidence;
- why it matters;
- smallest safe remediation;
- whether remediation is in scope or requires a decision request.

Then include:

- unverified assumptions;
- missing tests;
- compatibility and migration assessment;
- deterministic artifact assessment;
- security assessment;
- final verdict: reject, accept with blockers resolved, or accept.

Do not call stylistic preferences blockers unless they violate an explicit repository contract.
