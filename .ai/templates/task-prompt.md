/<skill-name>

## Task

<screen or area> — <one-sentence problem>. Link the brief or issue; do not paste it or any skill text.

## Reference

<existing screen, file path, or screenshot path>

## Acceptance

- <observable outcome>
- <observable outcome>

## Autonomy

Full. Decide routine choices, record them in the brief (`.ai/briefs/<slug>.md`), and continue. Stop only at the [stop conditions](../../AGENTS.md#stop-conditions).

## Wait

Run each gate in the background, then block on `t3_background_wait`; never end a turn with one pending or `sleep`.

## Done

`pnpm verify:affected` green; one `pnpm snap` screenshot per changed screen checked; PR into `dev` marked ready. A human merges unless this prompt says otherwise.
