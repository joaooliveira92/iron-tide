# DESIGN amendments

## Background

The canonical design is versioned by `DESIGN-NN` stable document IDs. When an
ADR changes an existing `DESIGN` document, it amends it: the ADR records the
amendment, and the amended `DESIGN` document records **Amended by:** the ADR
numbers. `docs-check` verifies this mapping — for every ADR that references a
`DESIGN` document, it must be classified here (either in the **Amendments** table
if it actually amends one, or in the **Scope/process** section if it only
references design material), and the table must match the `Amended by:` headers
in the `DESIGN` documents.

## Amendments table

| DESIGN | Amended by |
| --- | --- |
| _no DESIGN documents exist yet_ | _none_ |

Since no `DESIGN` documents exist in this checkout and the new ADR corpus
(ADR-0201..ADR-0211) references none, the table is intentionally empty.

## Scope/process

ADRs that reference a `DESIGN` section to constrain scope or process, but do not
formally amend a specific `DESIGN` document, are listed here. (None yet.)

When a sprint produces its first ADRs, update this file to classify any that
reference `DESIGN-*` as described above.
