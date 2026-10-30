# <Conventional Commit-style title>

## Purpose

Describe the user-visible or engineering capability delivered.

## Canonical requirements

List requirement IDs and approved interpretations.

## Changes

- Implementation
- Tests
- Artifacts and schemas
- Traceability

## Explicit non-goals

List deferred systems and unsupported production claims.

## Validation

```text
<exact commands and concise results>
```

## Determinism and compatibility

List hashes, changed versions, replay result, migration impact, and platforms tested.

## Security and cancellation

Describe affected trust boundaries and cleanup guarantees.

## Review focus

Tell reviewers where authoritative risk is concentrated.

## Checklist

- [ ] Canonical requirements traced
- [ ] Package graph remains valid
- [ ] Authoritative arithmetic is integer/fixed-point
- [ ] Randomness is domain-separated and audited
- [ ] Invariants and ledgers verified
- [ ] Save/replay compatibility assessed
- [ ] Cancellation and partial-output behavior tested
- [ ] Security checks passed
- [ ] Golden changes explained
- [ ] No secrets or local artifacts committed
- [ ] Agent did not self-merge
