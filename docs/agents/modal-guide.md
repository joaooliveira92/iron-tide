# Modal guide

Every modal in the desktop renderer shares one frame, so the app feels the same
wherever a dialog opens. The reference is **Start from a reference design**
(`WorkspaceDialog` in `screens/shipbuilding`): a large, centred, fixed-height sheet
with a title, a one-line description, a close button and a scrolling body.

The frame lives in `components/ui/modal-frame.ts`. `DialogContent` and
`AlertDialogContent` apply it; neither accepts `className`, so a screen cannot pick its
own width, height, padding or surface. `components/ui/modal-frame.test.tsx` fails on
hand-rolled `role="dialog"`/`aria-modal`, and on `className` passed to a dialog.

## Pick the kind

| Need | Use | Frame |
| --- | --- | --- |
| Browse, read, edit, review: anything with content | `Dialog` + `DialogContent` | `standard`: `h-[85vh] w-[min(92vw,80rem)]` |
| A question with a button answer, or an interruption | `AlertDialog` + `AlertDialogContent` | `confirm`: `w-[min(92vw,32rem)]`, height follows content, capped at 85vh |
| Content the player works beside (ship design sections, fleet, map panels) | `DepartmentDrawer` | docked, not modal; see below |
| Jump to a screen | `CommandDialog` | palette, not a modal |
| Tour coach mark | `GuidedInspectionOverlay` | not a modal |

An `AlertDialog` is for decisions the player must answer. Do not put a form or a browser
in one; use `Dialog`. Both sizes exist on both primitives (`size="standard"` on
`AlertDialogContent` is for a blocking screen such as the tactical battle).

## Anatomy

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit history</DialogTitle>
      <DialogDescription>Every change, oldest first. Choose an entry to go back to it.</DialogDescription>
    </DialogHeader>
    <DialogBody>{content}</DialogBody>
    <DialogFooter>{actions}</DialogFooter>
  </DialogContent>
</Dialog>
```

- **Header** (`shrink-0`): a title in sentence case and a one-sentence description that
  says what the modal does or what happens on confirm. Both are required; they label the
  dialog for screen readers. An icon may precede the title text.
- **Body** (`DialogBody`/`AlertDialogBody`): the only scrolling region. Content that sizes
  itself (a split browser, a list) uses `min-h-0 flex-1` and scrolls inside.
- **Footer** (`shrink-0`): actions, primary last. Omit it when the body acts directly.
- **Close**: `Dialog` shows the corner close button. Escape and the backdrop close it.
  `AlertDialog` has no close button; the cancel action is the way out.
- **Blocking** interruptions pass `onOpenChange={() => undefined}` to `AlertDialog` and
  offer an explicit abandon action.
- `flush` on `DialogContent` removes padding when the content draws its own edge-to-edge
  header and footer (the pre-turn review). Use it only then.

## Do not

- Pass `className` to `DialogContent`/`AlertDialogContent`, or set `max-w-*`, `w-*`,
  `h-*`, `p-*` on a modal. Change the frame in `modal-frame.ts`, for every modal at once.
- Build a modal from a fixed `div`, `role="dialog"` or `aria-modal="true"`.
- Nest a modal in a modal. Replace the content or close first.
- Make a one-field question a standard modal. Ask it with a confirm.

## Drawers

`DepartmentDrawer` and the debugging `Sheet`s dock to an edge so the player keeps the
drawing, map or table in view. They are not modals, take no backdrop, and keep their own
`narrow`/`wide` widths. Reach for one when the player must act on the screen behind it;
otherwise use a modal.

## Verify

Open the modal with `pnpm snap` at the default size and at `--size 1100x700`, and check
the frame, header and scrolling body ([desktop snap](desktop-snap.md)).
