# Reusable Milestone Implementation Prompt

Implement the approved milestone brief supplied with this prompt.

## Inputs

- Canonical specification: `README.md`
- Permanent contract: `.ai/ENGINEERING-CONTRACT.md`
- Operating rules: `.ai/AUTONOMOUS-AGENT.md`
- Orchestration pipeline: `.ai/ORCHESTRATION.md` (four subagent roles + validation gate, built on the `wayfinder`/`to-spec`/`to-tickets`/`research` skills)
- Requirement index: `.ai/REQUIREMENTS.md`
- Approved ADRs
- One approved milestone brief based on `.ai/templates/milestone-brief.md`

## Procedure

The orchestrator executes this procedure through the four subagent roles
(`.opencode/agents/`) and the skill pipeline in ORCHESTRATION.md — **chart**
(`wayfinder`) → **ground** (`research`) → **spec** (`to-spec` / spec-creator) →
**slice** (`to-tickets`) → **implement** → **review** → **orchestrator
validation gate** → commit. Approved specs are sliced into vertical implementation
tickets (`.scratch/<slug>/issues/`) and the implementator works the frontier one
ticket at a time.

### 1. Inspect

Inspect repository status, active branch, remotes, runtime, package manager, package graph, existing tests, CI, relevant source, and prior validation reports. Do not assume a greenfield state after bootstrap.

### 2. Trace

Map every acceptance criterion to requirement IDs, packages, test classes, and validation commands. Identify deferred requirements and ensure the implementation cannot be mistaken for production support where it is intentionally reduced.

### 3. Plan

Write a concise dependency-ordered plan. Identify authoritative contracts, boundaries, migrations, hash changes, security effects, cancellation points, and stop conditions before editing.

### 4. Implement

- Preserve package dependency direction.
- Keep domain logic pure and platform-independent.
- Use immutable typed transitions.
- Decode untrusted boundaries with a strict Effect `Schema` and domain legality with explicit validators.
- Use branded integers and explicit rounding for authoritative arithmetic.
- Use domain-separated named random decisions only where the brief authorizes randomness.
- Return structured diagnostic and explanation data, not mechanics hidden in strings.
- Propagate `AbortSignal` in long-running orchestration and I/O.
- Perform atomic output operations and deterministic cleanup.
- Add ADRs for materially constraining decisions.

### 5. Test continuously

Add the smallest tests that prove the contract, including invalid and boundary cases. Use property-based, invariant, metamorphic, replay, cross-process, security, or cancellation tests as required by risk. Record property-test failure seeds.

### 6. Validate

Run focused tests, then all repository-required checks. If authoritative artifacts change, report old/new hashes, cause, version impact, and migration status. Run a secondary consistency check rather than trusting the first successful command.

### 7. Review

Apply `.ai/REVIEW-PROMPT.md` adversarially. Repair only bounded, understood, in-scope defects. Stop on unresolved gameplay or compatibility ambiguity.

### 8. Deliver

Update traceability, ADRs, fixtures, validation report, and pull-request description. Use small Conventional Commits and do not self-merge.

## Prohibited shortcuts

- No giant `GameEngine` class or global mutable context.
- No arbitrary authored code execution.
- No generic global RNG.
- No direct command mutation of state.
- No incidental ordering in hashes.
- No `Date.now()`, environment, locale, or filesystem order in authority.
- No renderer ownership of authoritative state.
- No skipped tests, loosened validators, or unreviewed golden regeneration to make CI green.
