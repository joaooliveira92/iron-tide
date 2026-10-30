# @bluewave/compiler-cli

**Role:** Command-line entrypoint that runs the content compiler.

**Boundary:** An entrypoint: the full Effect runtime is allowed here, and file contents are decoded with a strict schema before use.

**Invariants:**

- No ambient randomness, wall-clock time or environment reads reach compiled artifacts.

Root rules in [AGENTS.md](../../AGENTS.md) apply.
