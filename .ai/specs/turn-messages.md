# Spec pointer: Turn-resolution messages

Spec: `.scratch/turn-messages/spec.md` (ready-for-agent; sliced).
Map: `.scratch/turn-messages/map.md` (decisions `D-01`-`D-19`, research `R-20`-`R-25`).
Decisions: `.scratch/turn-messages/decisions/`.
Tickets: `.scratch/turn-messages/issues/` — 01 message substrate and projection;
02 localized message catalogue and renderer resolver; 03 first end-to-end tracer
(monthly summary); 04 phase-engine interruption seam and deterministic resume;
05 turn transaction commands and pending-turn sidecar (blocked by 03, 04);
06 turn summary surfaces; 07 decision and battle dialogs with recovery (blocked by
05, 06); 08 end-to-end acceptance (blocked by 02, 05, 06, 07).
Authority: ADR-0209 (language/locale), ADR-0216/0217/0218 (money, rounding, locale
boundary), ADR-0036 (phase guard), ADR-0007 (golden repinning), ADR-0220 (worktree).
Gating: `MonthExecutor` goldens must stay byte-identical (D-05/D-17); no open
decision request blocks the chart.
Downstream: S-4 (Events and crises) and T-1 (Battle offer flow) are blocked
downstream of ticket 04 (05-07 for full flows); not part of this effort.
