# 08: End-to-end acceptance

**What to build:** The whole feature proven end to end. A multi-turn test advances several turns across the economy, construction, research, and diplomacy phases, including one mandatory decision and one battle, and verifies that messages, finances, construction, research, diplomacy, and save/load consistency all agree. It also covers deterministic re-execution of a suspended turn, rollback when a domain validation fails before commit, resumption of the same month exactly once, and corrupted or stale state. This is the acceptance gate the sprint's definition of done names.

**Blocked by:** 02, 05, 06, 07

**Status:** ready-for-agent

- [ ] An end-to-end test advances several turns with a decision and a battle and verifies messages, finances, construction, research, diplomacy, and save/load consistency.
- [ ] Re-executing a suspended turn is byte-identical; a resumed turn's final hash equals the uninterrupted single-run hash.
- [ ] A domain validation failure aborts before committing the new turn and restores the pre-turn state.
- [ ] Reloading during a decision or battle resumes the same month exactly once with no duplicated effects.
- [ ] Missing sidecars are valid; stale or incompatible pending state is reported without mutating the save.
- [ ] `pnpm preflight`, `pnpm test:scripts`, and `pnpm check` are green.
