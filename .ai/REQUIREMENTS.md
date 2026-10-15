# Bluewave Requirement Traceability Index

This file is an initial index. During bootstrap, derive additional stable IDs from `README.md` without changing its meaning or copying large sections.

## Initial requirements

- **BW-ARC-001**: Domain and authoritative simulation logic remain independent of presentation and platform adapters.
- **BW-ARC-002**: UI state is never authoritative simulation state.
- **BW-CMP-001**: Missing required canonical input causes campaign compilation failure.
- **BW-CMP-002**: Compiler output ordering and identifiers are canonicalized reproducibly.
- **BW-CMD-001**: Commands do not mutate authoritative state directly.
- **BW-CMD-002**: Commands pass through validation, reservation, locking, and explicit resolution outcomes.
- **BW-DET-001**: Authoritative outcomes use integer or fixed-point arithmetic.
- **BW-DET-002**: A single global consumptive RNG stream is prohibited.
- **BW-DET-003**: Identical authoritative inputs produce identical hashes across supported operating systems.
- **BW-DET-004**: Random decisions use stable domain-separated keys and produce audit records.
- **BW-PER-001**: Save files pin content, formula, AI, RNG, and format compatibility versions.
- **BW-PER-002**: Saves are committed atomically and retain a recovery state.
- **BW-PER-003**: Save/load preserves deterministic future outcomes.
- **BW-RUL-001**: Localized text never controls simulation mechanics.
- **BW-RUL-002**: Authored normal events and content do not execute arbitrary scripts.
- **BW-STA-001**: Canonical, derived, cached, ledger, and ephemeral authority categories remain distinct.
- **BW-STA-002**: Every completed strategic month ends in a validated canonical snapshot.
- **BW-TST-001**: Repeated campaign compilation is reproducible.
- **BW-TST-002**: UI navigation and reporting do not consume authoritative randomness.
- **BW-TST-003**: Replay reproduces authoritative results.

## Traceability records

```text
Requirement ID: BW-ARC-001
Canonical section: Architecture rules
Normative summary: Domain/authoritative logic independent of presentation and platform adapters
Status: partial
Packages or symbols: contracts, diagnostics, deterministic, desktop (renderer)
Tests: content-boundary.test.ts + check-renderer-bundle.mjs
ADR references: ADR-0001, ADR-0125
Validation evidence: `contracts`, `diagnostics`, `deterministic` have no Node/filesystem dependencies; renderer parses no YAML, bundles no `yaml`/`effect`
Deferred milestone: B0
Approved interpretation notes: Platform independence verified at the package level; Electron boundary deferred to B9
```

```text
Requirement ID: BW-CMP-001
Canonical section: Compiler
Normative summary: Missing required canonical input causes campaign compilation failure
Status: implemented
Packages or symbols: content-compiler (ValidateStage, ParseStage), compiler-cli (content:check/content:build), diagnostics (DiagnosticCollector)
Tests: content-compiler compiler.test.ts — valid pack compiles; invalid manifests produce diagnostics; duplicate IDs and dangling ship-building references fail with file + field path; compiler-cli content-surface.test.ts — content:check/content:build reject a broken pack
ADR references: ADR-0004, ADR-0005, ADR-0122
Validation evidence: `validateAgainstSchema` returns undefined for invalid inputs; collector.hasErrors blocks downstream stages; the full authored surface (content-pack collections + ship-building catalogue) is validated by `content:check`
```

```text
Requirement ID: BW-CMP-002
Canonical section: Compiler
Normative summary: Compiler output ordering and identifiers are canonicalized reproducibly
Status: implemented
Packages or symbols: content-compiler (NormalizeStage sortById/sortByField, CompileStage), deterministic (canonicalSerialize), compiler-cli (content:build)
Tests: deterministic deterministic.test.ts — canonical key ordering; content-compiler compiler.test.ts — repeated compilation produces identical hashes; compiler-cli content-surface.test.ts — two builds over unchanged content are byte-identical
ADR references: ADR-0003, ADR-0004, ADR-0122
Validation evidence: `canonicalSerialize` sorts keys; NormalizeStage sorts entities by stable ID; the content bundle + manifest carry a SHA-256 body hash and are byte-identical across builds
```

```text
Requirement ID: BW-DET-001
Canonical section: Determinism
Normative summary: Authoritative outcomes use integer or fixed-point arithmetic
Status: implemented
Packages or symbols: contracts (SafeInt, checkedAdd, checkedSub, checkedMul, roundToInt)
Tests: contracts safeint.test.ts — 20 tests covering creation, arithmetic, rounding modes
ADR references: ADR-0002
Validation evidence: All arithmetic operations use checked/branded integers; non-integers and unsafe integers rejected at construction
```

```text
Requirement ID: BW-DET-003
Canonical section: Determinism
Normative summary: Identical authoritative inputs produce identical hashes across supported operating systems
Status: verified
Packages or symbols: deterministic (canonicalSerialize, sha256Hex, createEnvelope, verifyEnvelope), content-compiler (buildContentBundleArtifact), compiler-cli (content:build), cross-process-test (run-child, cross-process.test)
Tests: deterministic deterministic.test.ts — 11 tests; content-compiler compiler.test.ts — repeated compilation identical hashes; compiler-cli content-surface.test.ts — two full-surface builds byte-identical; cross-process-test cross-process.test.ts — 2 tests
ADR references: ADR-0003, ADR-0007, ADR-0122
Validation evidence: Cross-process child-process test proves identical hashes across clean process restarts; the compiled content artifact is byte-identical across builds; CI matrix verifies Linux, Windows, and macOS; golden hash file committed
```

```text
Requirement ID: BW-RUL-002
Canonical section: Content rules
Normative summary: Authored normal events and content do not execute arbitrary scripts
Status: implemented
Packages or symbols: content-schema (parseYamlSafe), content-compiler (inert artifact), desktop (contentArtifact)
Tests: content-schema yaml-parser.test.ts — malformed YAML rejected; compiler-cli content-surface.test.ts — do-not-edit marker; desktop contentArtifact.test.ts — tampered/absent artifact fails closed
ADR references: ADR-0005, ADR-0122, ADR-0123
Validation evidence: YAML parser uses `yaml` package with no executable tags; size, nesting and alias limits enforced; the compiled artifact is inert JSON, verified before the app runs on it
```

```text
Requirement ID: BW-PER-001
Canonical section: Persistence
Normative summary: Save files pin content, formula, AI, RNG, and format compatibility versions
Status: implemented
Packages or symbols: desktop (contentArtifact, shipBuildingContent)
Tests: shipBuildingContent.test.ts; continuityCommands.test.ts
ADR references: ADR-0093, ADR-0109, ADR-0123
Validation evidence: Recorded content identity is the artifact's canonical body hash, domain-separated; startup verification fails closed on a tampered or absent artifact
```

```text
Requirement ID: BW-TST-001
Canonical section: Testing
Normative summary: Repeated campaign compilation is reproducible
Status: verified
Packages or symbols: content-compiler (Compiler), deterministic (canonicalSerialize, sha256Hex), cross-process-test (run-child, cross-process.test)
Tests: content-compiler compiler.test.ts — produces deterministic output on repeated compilation; cross-process-test cross-process.test.ts — cross-process child-process determinism proof
ADR references: ADR-0003, ADR-0007
Validation evidence: Compiler produces identical rawHash and envelopeHash on repeated runs in test; cross-process child-process test proves identical hashes across clean process restarts; CI matrix verifies Linux, Windows, macOS
```

```text
Requirement ID: BW-DIAG-001
Canonical section: Diagnostics (derived)
Normative summary: Structured diagnostics with stable code, severity, stage, source location, entity ID, and remediation
Status: implemented
Packages or symbols: diagnostics (DiagnosticCollector, Diagnostic, DiagnosticCode)
Tests: diagnostics diagnostics.test.ts — 7 tests covering collection, human/JSON output, clearing
Validation evidence: Collector accumulates errors/warnings/info; toHuman and toJSON produce stable output
```

```text
Requirement ID: BW-CLI-001
Canonical section: CLI (derived)
Normative summary: CLI supports validate, compile, inspect, verify, compare commands with human and JSON output modes
Status: implemented
Packages or symbols: compiler-cli (main.ts, commands.ts)
Tests: N/A — CLI not tested in unit tests (requires child-process integration tests)
Validation evidence: Commands use structured exit codes: 0=success, 1=validation-error, 2=compile-error, 3=aborted, 4=internal-error, 5=usage-error
```

```text
Requirement ID: BW-TST-003
Canonical section: Testing (derived)
Normative summary: Replay reproduces authoritative results
Status: verified
Packages or symbols: phase-engine (ReplayVerifier), cross-process-test (run-child, cross-process.test)
Tests: phase-engine integration.test.ts — replay reproduces hashes; cross-process-test cross-process.test.ts — cross-process replay verification
ADR references: ADR-0007
Validation evidence: ReplayVerifier test proves same-process replay; cross-process child-process test proves replay across process restarts
```

```text
Requirement ID: BW-DET-004
Canonical section: Determinism (derived)
Normative summary: Domain packages do not import forbidden ambient input modules
Status: verified
Packages or symbols: cross-process-test (ambient-input.test)
Tests: cross-process-test ambient-input.test.ts — 11 tests covering all domain packages
ADR references: ADR-0007
Validation evidence: Automated scan of all domain package source files verifies no imports of os, process, child_process, timers, perf_hooks
```

## Traceability record format

For every implementation requirement, record:

```text
Requirement ID:
Canonical section:
Normative summary:
Status: planned | partial | implemented | verified | deferred
Packages or symbols:
Tests:
ADR references:
Validation evidence:
Deferred milestone:
Approved interpretation notes:
```

A requirement is not `verified` merely because code exists. Verification requires named automated evidence or a documented manual gate where automation is impossible.
