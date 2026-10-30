# Non-negotiable rules

A short list of rules no change may violate. They are distilled from
`.ai/ENGINEERING-CONTRACT.md` (the code authority) and the canonical design; if
one of these and another document disagree, the contract wins.

- **Authoritative logic is presentation- and platform-independent.** Domain and
  simulation code must not depend on the UI, Electron, the filesystem, or the
  host (BW-ARC-001).
- **UI state is never authoritative simulation state** (BW-ARC-002).
- **Determinism is mandatory.** Identical content, ruleset, inputs, commands,
  seeds, and compatibility versions produce identical authoritative hashes across
  OSes (BW-DET-003). Authoritative outcomes use integer or fixed-point maths
  (BW-DET-001) and no ambient input.
- **No global consumptive RNG.** Randomness uses domain-separated streams with
  stable entity keys and an audit ledger (BW-DET-002, BW-DET-004).
- **Content is data.** Authored domain content is declarative TypeScript decoded
  into a canonical JSON artifact and loaded outside compiler stages;
  authored formulas are data, not embedded programs. Localized text never
  executes code and never controls mechanics (BW-RUL-001, BW-RUL-002).
- **Commands do not mutate state directly**; they pass validation, reservation,
  locking, and explicit resolution outcomes (BW-CMD-001, BW-CMD-002).
- **Boundaries are decoded, never trusted.** Saves, compiled content, IPC/event
  envelopes, and files are decoded with a strict schema before use.
- **Saves are atomic and version-pinned.** A save from a different compatibility
  version is refused before decode, never migrated at runtime (BW-PER-001/002).
- **One validator.** Effect Schema is the single boundary validator; never
  dual-maintain two.
- **Gates are not weakened to pass.** Fix the cause; re-pin golden artefacts only
  deliberately and with a stated reason.

Where a rule and a fixture conflict, the fixture is wrong — or you have found a
genuine design conflict and must stop and raise a decision request (see
[`AGENTS.md`](../../AGENTS.md)).
