/**
 * `@bluewave/armament` — the platform-independent authoritative armament domain (ADR-0093).
 *
 * A neutral leaf package (depends only on `@bluewave/contracts`) so both `@bluewave/ship-design` and
 * `@bluewave/combat` can consume armament resolution without depending on one another. It carries
 * no React, Electron, Node filesystem, campaign-state or persistence dependency.
 */
export * from "./ids.js";
export * from "./provenance.js";
export * from "./model.js";
export * from "./compiled.js";
export * from "./torpedo.js";
export * from "./findings.js";
export * from "./arithmetic.js";
export * from "./resolver.js";
export * from "./lint.js";
