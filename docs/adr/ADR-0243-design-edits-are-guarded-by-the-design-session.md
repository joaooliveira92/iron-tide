# ADR-0243: Every design edit is guarded in the design session, and a newly broken design is explained at once

Applies to: desktop, ship-design

## Status

Superseded by: ADR-0345

Accepted (2026-10-20).

## Context

A player could pick an option (hull material "iron", a longer hull, an armour belt) that made
the design unbuildable and learn it only from the Review accordion, which lists findings but
does not tie them to the choice that caused them or say how to undo it. Guarding each panel
separately would copy the logic per panel and miss new ones.

## Decision

1. `useDesignSession` wraps `actions.edit` with `useChoiceCheck`. Every draft edit, from any
   panel in either host (Drawing Board, Shipbuilding workspace), is guarded; panels do not
   implement their own copy.
2. After an edit the check compares the findings before and after by `BoardFinding.key`. Only a
   BLOCKING or CRITICAL finding that was not present before opens the explanation
   (`ChoiceProblemDialog`): what failed, why, the in-play consequence, the remedies, with
   "Undo this choice" and "Keep it and fix it myself". A design that is still broken by a
   finding already shown does not reopen it. The trigger is a new finding, never a list of
   invalid options, so new rules are covered with no UI change.
3. The field that introduced a finding stays marked (`aria-invalid` plus `FieldError`, the
   ReUI `c-input-5` pattern) while that finding remains. Errors are filed by `editField(e)`:
   `<kind>:<setting>` (for example `set_hull:materialId`), or `set_armour_region:<region>`
   because an armour edit carries a whole region. Panels receive `errorFor(field)` and pass
   `error` to `SelectField` / `NumberField`.
4. Finding text is reused from the compiled finding, never rewritten for the UI.

## Consequences

- A new panel gets the dialog for free; it needs only `errorFor` for the inline mark.
- Edits from the plan (placements, moves) also open the dialog when they break the design. If
  that proves too frequent, restrict the dialog to form-field edits here, in one place.
- The dialog is modal, so renderer tests render it as nothing by default (`test-setup.ts`
  mocks it); tests of the dialog call `vi.unmock` on `ChoiceProblemDialog.js`.
- An edit rejected by the compile leaves findings unchanged and so opens no dialog.
