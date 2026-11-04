# Shipping bar

A change is not done until each applicable item holds.

- **Playable**: desktop launches, vertical slice runs on every merge.
- **Seen**: UI change verified with `pnpm snap` before done.
- **Tunable**: numbers in content/balance data, marked PROVISIONAL until sourced; code holds mechanisms, not magic numbers.
- **Reachable**: a change that adds player-facing engine capability names its UI path or adds a `dormant-by-decision` row to `scripts/data/reachability-ledger.json` (`pnpm check:reachability-ledger`).
- **Explainable**: every player-facing number traces to an explanation tree.
- **Measured**: balance claims cite generated reports (`pnpm check:balance-reports`), not intuition.
