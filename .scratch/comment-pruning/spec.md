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

Remaining work is sliced into the tickets in `issues/`.

Out of scope for this effort — the audit also surfaced **deferred-subsystem**
placeholders (compiled-design dimensions / dock predicate INC-16; the
delivery-guarantee and co-belligerence placeholders; the unimplemented public
battle-report surface). These belong to their owning efforts and must not be
silently implemented here.
