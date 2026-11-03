import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    printWidth: 100,
    tabWidth: 2,
    sortPackageJson: false,
    ignorePatterns: [
      ".agents/**",
      ".claude/**",
      ".muse/**",
      ".worktrees/**",
      "docs/**",
      "codefetch/**",
      "golden/**",
      // Frozen save artifacts: `campaign.json` is hashed byte-for-byte by its
      // signature, so reformatting it would break the fixture.
      "packages/persistence/test/fixtures/**",
      "dist/**",
      "out/**",
      // Vendored upstream code (byte-identical published artifacts) and the
      // read-only Effect source subtree are reference material — never ours to
      // lint or reformat (see AGENTS.md "Vendored repositories").
      "vendor/**",
      "repos/**",
      "pnpm-lock.yaml",
      "docs/audit/MANIFEST.json",
      "docs/contracts/**",
      "docs/requirements/**",
      "SOURCE-DESIGN-v1.0.md",
      "README.md",
      "skills-lock.json",
    ],
  },
  lint: {
    // `.agents/**` holds vendored third-party agent skills (e.g. anatomy, with its own
    // LICENSE and CHANGELOG); `fmt` already excludes it and it is not repository code.
    ignorePatterns: ["vendor/**", "repos/**", ".agents/**", ".worktrees/**"],
    plugins: ["typescript", "unicorn", "oxc"],
    categories: {
      correctness: "error",
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    env: {
      builtin: true,
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  run: {
    cache: { scripts: true, tasks: false },
    tasks: {
      "gate:git-state": { command: "node scripts/preflight.cjs" },
      "gate:single-copy-self-test": {
        command: "node scripts/assert-single-effect.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:single-copy": {
        command: "node scripts/assert-single-effect.mjs",
        dependsOn: ["gate:single-copy-self-test"],
      },
      "gate:runtime-free-self-test": {
        command: "node scripts/assert-runtime-free.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:runtime-free": {
        command: "node scripts/assert-runtime-free.mjs",
        dependsOn: ["gate:runtime-free-self-test"],
      },
      "gate:determinism-self-test": {
        command: "node scripts/assert-authoritative-determinism.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:determinism": {
        command: "node scripts/assert-authoritative-determinism.mjs",
        dependsOn: ["gate:determinism-self-test"],
      },
      "gate:tagged-errors-self-test": {
        command: "node scripts/assert-tagged-errors.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:tagged-errors-engine": {
        command: "node scripts/assert-tagged-errors.mjs --scope engine",
        dependsOn: ["gate:tagged-errors-self-test"],
      },
      "gate:tagged-errors-surface": {
        command: "node scripts/assert-tagged-errors.mjs --scope surface",
        dependsOn: ["gate:tagged-errors-self-test"],
      },
      "gate:boundary-decode-self-test": {
        command: "node scripts/assert-boundary-decode.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:boundary-decode-compiler": {
        command: "node scripts/assert-boundary-decode.mjs --scope compiler",
        dependsOn: ["gate:boundary-decode-self-test"],
      },
      "gate:boundary-decode-desktop": {
        command: "node scripts/assert-boundary-decode.mjs --scope desktop",
        dependsOn: ["gate:boundary-decode-self-test"],
      },
      "gate:boundary-decode-cli": {
        command: "node scripts/assert-boundary-decode.mjs --scope cli",
        dependsOn: ["gate:boundary-decode-self-test"],
      },
      "gate:boundary-decode-persistence": {
        command: "node scripts/assert-boundary-decode.mjs --scope persistence",
        dependsOn: ["gate:boundary-decode-self-test"],
      },
      "gate:boundary-decode-options": {
        command: "node scripts/assert-boundary-decode.mjs --scope decode-options",
        dependsOn: ["gate:boundary-decode-self-test"],
      },
      "gate:stage-io-self-test": {
        command: "node scripts/assert-no-stage-io.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:stage-io": {
        command: "node scripts/assert-no-stage-io.mjs",
        dependsOn: ["gate:stage-io-self-test"],
      },
      "gate:canonical-serialization-self-test": {
        command: "node scripts/assert-canonical-serialization.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:canonical-serialization": {
        command: "node scripts/assert-canonical-serialization.mjs",
        dependsOn: ["gate:canonical-serialization-self-test"],
      },
      "gate:library-console-self-test": {
        command: "node scripts/assert-no-library-console.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:library-console": {
        command: "node scripts/assert-no-library-console.mjs",
        dependsOn: ["gate:library-console-self-test"],
      },
      "gate:claude-skill-links": {
        command: "node scripts/link-claude-skills.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:docs": { command: "node scripts/docs-check.cjs", dependsOn: ["gate:git-state"] },
      "gate:doc-budgets": {
        command: "node scripts/verify-doc-budgets.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:package-agents-self-test": {
        command: "node scripts/verify-package-agents.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:package-agents": {
        command: "node scripts/verify-package-agents.mjs",
        dependsOn: ["gate:package-agents-self-test", "gate:doc-budgets"],
      },
      "gate:dependency-policy": {
        command: "node scripts/verify-package-dependencies.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:workspace-graph-self-test": {
        command: "node scripts/verify-workspace-graph.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:workspace-graph": {
        command: "node scripts/verify-workspace-graph.mjs",
        dependsOn: ["gate:workspace-graph-self-test"],
      },
      "gate:unknown-casts": {
        command: "node scripts/verify-no-unknown-casts.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:torpedo-model-constants-self-test": {
        command: "node scripts/verify-no-torpedo-model-constants.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:torpedo-model-constants": {
        command: "node scripts/verify-no-torpedo-model-constants.mjs",
        dependsOn: ["gate:torpedo-model-constants-self-test"],
      },
      "gate:upgradepath-refit-readers-self-test": {
        command: "node scripts/verify-no-upgradepath-refit-readers.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:upgradepath-refit-readers": {
        command: "node scripts/verify-no-upgradepath-refit-readers.mjs",
        dependsOn: ["gate:upgradepath-refit-readers-self-test"],
      },
      "gate:test-focus": {
        command: "node scripts/verify-test-focus.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:presentation-format-self-test": {
        command: "node scripts/assert-presentation-formatting.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:presentation-format": {
        command: "node scripts/assert-presentation-formatting.mjs",
        dependsOn: ["gate:presentation-format-self-test"],
      },
      "gate:no-comments": {
        command: "node scripts/strip-comments.mjs --scope packages --scope apps --check",
        dependsOn: ["gate:git-state"],
      },
      "gate:worktrees": {
        command: "node scripts/verify-worktrees.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:version-coherence": {
        command: "node scripts/verify-version-coherence.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:check-parity": {
        command: "node scripts/verify-check-parity.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:tsgo-integration": {
        command: "node scripts/verify-tsgo-integration.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:vitest-config-self-test": {
        command: "node scripts/verify-vitest-config-parity.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:vitest-config": {
        command: "node scripts/verify-vitest-config-parity.mjs",
        dependsOn: ["gate:vitest-config-self-test"],
      },
      "gate:content-lock": {
        command: "node scripts/verify-content-lock.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:reachability-ledger": {
        command: "node scripts/verify-reachability-ledger.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:explanation-coverage": {
        command: "node scripts/verify-explanation-coverage.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:ui-acceptance-map": {
        command: "node scripts/verify-ui-acceptance-map.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:agent-context": {
        command: "node scripts/verify-agent-context.mjs --check",
        dependsOn: ["gate:git-state"],
      },
      "gate:content-placeholder-gate": {
        command: "node scripts/verify-content-gate.mjs",
        dependsOn: ["gate:content-lock"],
      },
      "gate:codemod-determinism": {
        command: "node scripts/verify-codemod-determinism.mjs",
        dependsOn: ["gate:git-state"],
      },
      "gate:yaml-boundary-self-test": {
        command: "node scripts/assert-no-foreign-yaml.mjs --self-test",
        dependsOn: ["gate:git-state"],
      },
      "gate:yaml-boundary": {
        command: "node scripts/assert-no-foreign-yaml.mjs",
        dependsOn: ["gate:yaml-boundary-self-test"],
      },
      "gates:preflight": {
        command: "node -p 0",
        dependsOn: [
          "gate:single-copy",
          "gate:runtime-free",
          "gate:determinism",
          "gate:tagged-errors-engine",
          "gate:tagged-errors-surface",
          "gate:boundary-decode-compiler",
          "gate:boundary-decode-desktop",
          "gate:boundary-decode-cli",
          "gate:boundary-decode-persistence",
          "gate:boundary-decode-options",
          "gate:stage-io",
          "gate:canonical-serialization",
          "gate:library-console",
          "gate:claude-skill-links",
          "gate:docs",
          "gate:doc-budgets",
          "gate:package-agents",
          "gate:dependency-policy",
          "gate:workspace-graph",
          "gate:unknown-casts",
          "gate:torpedo-model-constants",
          "gate:upgradepath-refit-readers",
          "gate:test-focus",
          "gate:presentation-format",
          "gate:no-comments",
          "gate:worktrees",
          "gate:version-coherence",
          "gate:check-parity",
          "gate:tsgo-integration",
          "gate:vitest-config",
          "gate:content-placeholder-gate",
          "gate:codemod-determinism",
          "gate:yaml-boundary",
          "gate:reachability-ledger",
          "gate:explanation-coverage",
          "gate:ui-acceptance-map",
          "gate:agent-context",
        ],
      },
    },
  },
});
