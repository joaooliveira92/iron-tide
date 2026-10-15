# Comment pruning & comment-shaped workarounds

**Status:** open

Audit of useless code comments across the repository, plus the workarounds those
comments merely described. Implemented and verified on this branch already:

- **Mechanical sweep** — removed self-referential file-path header comments and
  pure decorative separator rules (521 files).
- **Reservation ordering determinism** — the reservation manager ordered
  requirements with `localeCompare` (host-locale dependent, a determinism-contract
  violation). It now uses the canonical codepoint comparator, covered by a
  regression test that fails under the old comparison.
- **Dead part-catalogue coverage set** — removed an unused set, plus the stale
  comment and `void` that existed only to silence it.

Remaining work is sliced into 11 tickets in `issues/`:

- **01–04** — remove the remaining low-value comments, batched by area (combat;
  engine/content/campaign; ship-build/support; apps/scripts). **Resolved.**
- **05–10** — dissolve the comment-shaped workarounds: lint-suppression reasons,
  dead `void`-suppressed variables, unjustified double casts, SafeInt handling in
  AI planning, stable coastline path ids, and the commands dead branch.
  **05, 06, 08, 09, 10 resolved; 07 blocked** pending the design step described in
  its notes (strict `DesignDraft`/`EditLog` schema decode + typed override merge).
- **11** — decision on the canonical naval penetration model (authoritative
  outcome change; needs a decision/ADR). **Resolved — deferred** to the
  armour/penetration subsystem (see the ticket's Answer).

Out of scope for this effort — the audit also surfaced **deferred-subsystem**
placeholders (compiled-design dimensions / dock predicate INC-16; the
delivery-guarantee and co-belligerence placeholders; the unimplemented public
battle-report surface). These belong to their owning efforts and must not be
silently implemented here.
