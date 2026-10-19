#!/usr/bin/env bash
# Regenerates every R3 dataset from the shipped 1880 pack. Run from the repo root of a
# worktree where `pnpm install --frozen-lockfile` and `pnpm exec vp run -r build` have run.
# Read-only on tracked files: writes only under docs/research/economy/r3/data/.
set -euo pipefail
S=docs/research/economy/r3/scripts
for i in I0_current I1_base12income I2_income_is_appropriation I3_income_annual \
         I0s_current_standing I1s_base12income_standing I2s_income_is_appropriation_standing I3s_income_annual_standing; do
  node $S/run-months.mjs 120 "$i" "run-$i.json"
done
node $S/analyze.mjs
node $S/boundary-cases.mjs >/dev/null
# raw run-*.json (about 1.7 MB each) are regenerable and are not committed.
