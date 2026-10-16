# 07: Player sees prestige, its last change and sack risk

**What to build:** The player projection exposes current prestige, the last
change with its reason, and a sack-risk flag, and the header and status strip show
them in place of their placeholders. An ended career shows the result. Display
only; renderer and preload remain runtime-free.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The header and status strip show the real value from a compiled fixture
      campaign and no longer render the placeholder or the "no mechanic" note.
- [ ] The last change and reason update after a month that changes prestige.
- [ ] The sack-risk flag appears at or below the threshold and not above.
- [ ] After the career ends the result is shown with score and reason.
- [ ] Changing a presentation preference does not change any authoritative hash.
