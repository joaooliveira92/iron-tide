# 03: First end-to-end tracer — monthly summary

**What to build:** The thin vertical slice. After the player presses Turn, the committed month's domain events are projected into messages and persisted to a non-authoritative `turn-summaries.json` beside the save; a read command returns validated summary DTOs; the Overview screen shows a grouped summary of the economy, construction, research, and diplomacy outcomes. Routine items aggregate into category sections; capital-ship completions and first-of-class vessels are highlighted; each message links to the entity it concerns. This proves the whole path — engine result → projection → sidecar → IPC DTO → UI — without interrupts yet.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] Advancing a turn projects messages and appends them to the summary history keyed by turn id.
- [ ] A read command returns prior turns' summaries as validated DTOs.
- [ ] The Overview shows the summary grouped by category with severity indicators, aggregated routine items, and highlighted capital ships.
- [ ] Actionable messages link to their ship/class/nation/region/technology/project.
- [ ] A missing or corrupt summary sidecar reads as empty and never crashes; a save with no sidecar loads normally.
- [ ] The authoritative snapshot/hash and compatibility version are unchanged by the projection or sidecar.
