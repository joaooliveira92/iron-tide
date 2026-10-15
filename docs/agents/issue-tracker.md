# Issue tracker

The project issue tracker is **local markdown** under `.scratch/`, created on
demand by the pipeline. It is not a remote service: an autonomous agent reads it
to decide what to do next, so it must stay truthful.

## Layout

```
.scratch/
  <effort-slug>/
    spec.md                 # the spec (to-spec format)
    issues/
      01-<slug>.md          # one ticket per file, numbered in dependency order
      02-<slug>.md
```

`.scratch/handoff/` holds session handoff notes and is git-ignored. See
`.ai/ORCHESTRATION.md` for how a spec and its tickets are produced
(chart → research → spec → slice), and the `to-tickets` and `wayfinder` skills
for the authoring rules.

## Ticket format

One ticket per file, blockers first, using the local template:

```
# <NN>: <title>

**What to build:** the end-to-end behaviour this ticket makes work.

**Blocked by:** the numbers/titles that gate this one, or "None (can start immediately)".

**Status:** ready-for-agent

- [ ] acceptance criterion
```

Prefer the domain glossary (`CONTEXT.md`) and avoid file paths or snippets that go
stale. A ticket is a **tracer-bullet vertical slice**: narrow but complete through
every layer, demoable on its own, sized for one context window. A wide mechanical
refactor is the exception — sequence it as expand → migrate → contract.

## Working the frontier

Any ticket whose blockers are all done is on the **frontier** and can start; for
a linear chain that is top to bottom. Claim one ticket at a time.

## The consistency gate

`scripts/verify-tracker-consistency.mjs` runs in preflight. It warns on a ticket
with a missing or unrecognised status, and **fails** when a `Blocked by:`
reference names no sibling ticket, or when a `spec.md` still advertises
`ready-for-agent` while every one of its tickets is terminal (the work is done —
mark the spec done or archive it).

Status vocabulary: `open`, `claimed`, `in-progress`, `blocked`, `ready-for-agent`
(non-terminal); `resolved`, `closed`, `done`, `superseded`, `deferred` (terminal).
Triage roles are in [triage labels](triage-labels.md).
