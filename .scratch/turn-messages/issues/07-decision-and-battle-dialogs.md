# 07: Decision and battle dialogs with recovery

**What to build:** The blocking interactions. A mandatory decision appears as a modal that blocks advancing until answered; each option communicates the direction and rough magnitude of its consequences without exposing hidden calculations; choosing an option shows a result message describing what changed. A generated battle appears as a request the player can accept, decline, or delegate (as T-1's policy permits), with its result applied once and reported. If a saved campaign holds a pending turn, loading prompts the player to resume; if the pending turn is incompatible, the player sees a clear explanation and the save is left untouched.

**Blocked by:** 05, 06

**Status:** ready-for-agent

- [ ] A mandatory decision opens a blocking modal; the Continue/advance control is disabled until it is answered.
- [ ] Each decision option shows qualitative consequence hints (direction and approximate magnitude).
- [ ] Answering a decision displays a result message describing the change.
- [ ] A battle request can be accepted, declined, or delegated per policy, and its result is applied exactly once with an after-action message.
- [ ] Closing the app during a decision or battle and reloading resumes the same turn at the same point.
- [ ] An incompatible pending turn is explained and resumption is declined without altering the save.
