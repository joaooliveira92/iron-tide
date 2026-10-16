# 08: Mine warfare acceptance run

**What to build:** A scripted 1880 campaign designs a minelayer and a sweeper,
fights a war, and shows laying, sweeping, a strike and the player's view,
deterministically. Records the engine constants' provenance and the validation
report.

**Blocked by:** 03, 04, 05, 06, 07

**Status:** ready-for-agent

- [ ] Production 1880 compiled campaign: laying, sweeping and a strike each
      observed in a scripted run, byte-identical across two processes.
- [ ] `docs/research/` note lists the engine's mine constants with their provenance
      (implementation baseline, not manual-verified); none changed.
- [ ] `pnpm preflight`, `pnpm test:scripts` and `pnpm check` green on the exact
      commit.
- [ ] Validation report in `.ai/reports/`; sprint-plan W-2 row annotated with a
      pointer.
