import * as internal from "./internal/internal.js";
/**
 * Re-exports the `vitest` API unchanged.
 *
 * @stability unstable
 * @since 4.0.0
 */
export * from "vitest";
/**
 * Invokes the Effect Vitest equality-tester registration hook.
 *
 * @stability unstable
 * @category utils
 * @since 4.0.0
 */
export const addEqualityTesters = internal.addEqualityTesters;
/**
 * Registers a callback to run once before all tests in the current suite. If
 * the callback returns an `Effect`, it is run and awaited with a `Scope` that
 * closes in a cleanup after the suite's `afterAll` hooks, within the hook's
 * timeout. The `Effect` must not require any other services.
 *
 * **Details**
 *
 * If Vitest stops waiting for the setup, the setup is interrupted before the
 * `Scope` closes. As with any `beforeAll` cleanup, Vitest reports a closing
 * that exceeds the hook's timeout and does not wait for it.
 *
 * @stability unstable
 * @category hooks
 * @since 4.0.0
 */
export const beforeAll = internal.beforeAll;
/**
 * Registers a callback to run before each test in the current suite. If the
 * callback returns an `Effect`, it is run and awaited with a `Scope` that
 * closes when the test finishes, and interrupted if the hook times out. The
 * `Effect` must not require any other services.
 *
 * @stability unstable
 * @category hooks
 * @since 4.0.0
 */
export const beforeEach = internal.beforeEach;
/**
 * Runs a scoped Effect test with test clock and console services.
 *
 * @stability unstable
 * @category testing
 * @since 4.0.0
 */
export const effect = internal.effect;
/**
 * Runs a scoped Effect test with live services.
 *
 * @stability unstable
 * @category testing
 * @since 4.0.0
 */
export const live = internal.live;
/**
 * Share a `Layer` between multiple tests, optionally wrapping
 * the tests in a `describe` block if a name is provided.
 *
 * **Details**
 *
 * Named layers accept `concurrent` to override inherited suite concurrency.
 * Anonymous layers always inherit the enclosing suite's concurrency.
 * Use `ctx.expect` in concurrent tests for test-local snapshots and assertion counts.
 *
 * Pass `buildPerTest: true` to build the layer once per test instead of once
 * per block. Each test gets new services, released when the test finishes,
 * while services from an enclosing `layer` block stay shared. A build failure
 * fails only that test. Blocks nested inside a per-test block are built per
 * test as well. `timeout` has no effect on a per-test block, since the test's
 * own timeout covers the build.
 *
 * **Example** (Sharing layers between tests)
 *
 * ```ts
 * import { assert, layer } from "@effect/vitest"
 * import { Effect, Layer, Context } from "effect"
 *
 * class Foo extends Context.Service<Foo, "foo">()("Foo") {
 *   static layer = Layer.succeed(Foo, "foo")
 * }
 *
 * class Bar extends Context.Service<Bar, "bar">()("Bar") {
 *   static layer = Layer.effect(
 *     Bar,
 *     Effect.map(Foo, () => "bar" as const)
 *   )
 * }
 *
 * layer(Foo.layer)("layer", (it) => {
 *   it.effect("adds context", () =>
 *     Effect.gen(function*() {
 *       const foo = yield* Foo
 *       assert.strictEqual(foo, "foo")
 *     }))
 *
 *   it.layer(Bar.layer)("nested", (it) => {
 *     it.effect("adds context", () =>
 *       Effect.gen(function*() {
 *         const foo = yield* Foo
 *         const bar = yield* Bar
 *         assert.strictEqual(foo, "foo")
 *         assert.strictEqual(bar, "bar")
 *       }))
 *   })
 * })
 * ```
 *
 * **Example** (Building a layer for each test)
 *
 * ```ts
 * import { assert, layer } from "@effect/vitest"
 * import { Effect, Layer, Context, Ref } from "effect"
 *
 * class Database extends Context.Service<Database, "database">()("Database") {
 *   static layer = Layer.succeed(Database, "database")
 * }
 *
 * class Cache extends Context.Service<Cache, Ref.Ref<Array<string>>>()("Cache") {
 *   static layer = Layer.effect(
 *     Cache,
 *     Effect.andThen(Database, Ref.make<Array<string>>([]))
 *   )
 * }
 *
 * layer(Database.layer)("repository", (it) => {
 *   // Database is shared, Cache is built for each test
 *   it.layer(Cache.layer, { buildPerTest: true })((it) => {
 *     it.effect("writes to the cache", () =>
 *       Effect.gen(function*() {
 *         const cache = yield* Cache
 *         yield* Ref.update(cache, (keys) => [...keys, "a"])
 *         assert.deepStrictEqual(yield* Ref.get(cache), ["a"])
 *       }))
 *
 *     it.effect("starts with an empty cache", () =>
 *       Effect.gen(function*() {
 *         const cache = yield* Cache
 *         assert.deepStrictEqual(yield* Ref.get(cache), [])
 *       }))
 *   })
 * })
 * ```
 *
 * @stability unstable
 * @category testing
 * @since 4.0.0
 */
export const layer = internal.layer;
/**
 * Retries a scoped Effect to tolerate intermittent test failures, dying on exhausted retries.
 *
 * @stability unstable
 * @category testing
 * @since 4.0.0
 */
export const flakyTest = internal.flakyTest;
/**
 * Runs a synchronous property test using schemas or arbitraries.
 *
 * @stability unstable
 * @category testing
 * @since 4.0.0
 */
export const prop = internal.prop;
/**
 * Vitest test API extended with Effect test helpers.
 *
 * @stability unstable
 * @category testing
 * @since 4.0.0
 */
export const it = internal.it;
/**
 * Creates the Effect test helpers for a Vitest test API, such as one extended with fixtures.
 *
 * **Details**
 *
 * Tests receive the fixtures they destructure from their context. Vitest sets them up before the test and tears
 * them down after the test's scope closes, as it does for its own tests. `it.effect.each` passes the context
 * after the test case, and named and anonymous `it.layer` blocks keep the fixtures.
 *
 * **Gotchas**
 *
 * Vitest reads the destructured names to decide which fixtures to set up. Once any fixture is defined, a test that
 * takes the whole context as a plain parameter, such as `(ctx) =>`, fails with a `FixtureParseError`. Property
 * tests receive only the base test context and cannot request fixtures; auto fixtures still run.
 *
 * **Example** (Using a Vitest fixture in an Effect test)
 *
 * ```ts
 * import { assert, makeMethods, test } from "@effect/vitest"
 * import { Effect } from "effect"
 *
 * const it = makeMethods(
 *   test.extend("config", { scope: "file" }, () => ({ port: 3000 }))
 * )
 *
 * it.effect("reads the config fixture", ({ config }) =>
 *   Effect.sync(() => {
 *     assert.strictEqual(config.port, 3000)
 *   }))
 * ```
 *
 * @stability unstable
 * @category constructors
 * @since 4.0.0
 */
export const makeMethods = internal.makeMethods;
/**
 * Creates a named Vitest suite whose callback receives Effect test helpers.
 *
 * @stability unstable
 * @category testing
 * @since 4.0.0
 */
export const describeWrapped = internal.describeWrapped;
//# sourceMappingURL=index.js.map