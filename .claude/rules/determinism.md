---
paths:
  - "packages/**"
  - "apps/compiler-cli/**"
  - "content/**"
---

# Determinism

Same content, ruleset, inputs, seeds, versions → same hashes on every OS. In authoritative code: no `Math.random`, UUIDs, wall-clock, `process.env`, locale, fs order, network, pid, mutable globals, path separators. Use domain-separated hierarchical RNG, integer/fixed-point math, the versioned canonical serializer with domain-separated SHA-256. [RULES.md](../../RULES.md#determinism).
