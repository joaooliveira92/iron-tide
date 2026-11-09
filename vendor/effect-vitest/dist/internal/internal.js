/**
 * @since 4.0.0
 */
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import { constVoid, flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Scope from "effect/Scope";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import * as V from "vitest";
const getCurrentSuite = V.TestRunner.getCurrentSuite;
const runPromise = (effect, ctx) => Effect.runPromise(
// Only the test is interruptible: once the signal aborts, the fiber stops
// at its next interruptible step, which would skip reporting the defects
// raised by finalizers.
Effect.uninterruptibleMask(restore => Effect.gen(function* () {
  const exit = yield* Effect.exit(restore(effect));
  if (Exit.isFailure(exit)) {
    const errors = Cause.prettyErrors(exit.cause);
    for (let i = 0; i < errors.length; i++) {
      yield* Effect.logError(errors[i]);
    }
  }
  return yield* exit;
})), {
  signal: ctx?.signal
});
const settleOnAbort = (ctx, promise) => {
  // Vitest stops awaiting the promise once the signal aborts (timeout or
  // cancellation), so only then add a hook that waits for the finalizers.
  // Registering it unconditionally would change the teardown of every test.
  const onAbort = () => ctx.onTestFinished(() => promise.then(constVoid, constVoid));
  ctx.signal.addEventListener("abort", onAbort, {
    once: true
  });
  const cleanup = () => ctx.signal.removeEventListener("abort", onAbort);
  promise.then(cleanup, cleanup);
  // A retry after a timed-out attempt reuses the aborted signal, so no event fires.
  if (ctx.signal.aborted) onAbort();
  return promise;
};
/** @internal */
const runTest = ctx => effect => {
  const promise = runPromise(effect, ctx);
  return ctx ? settleOnAbort(ctx, promise) : promise;
};
const TestEnv = /*#__PURE__*/Layer.mergeAll(TestConsole.layer, /*#__PURE__*/TestClock.layer());
/** @internal */
export const addEqualityTesters = () => {
  V.expect.addEqualityTesters([]);
};
/** @internal */
const testOptions = timeout => typeof timeout === "number" ? {
  timeout
} : timeout ?? {};
const hookTimeout = timeout => timeout === undefined ? undefined : Duration.toMillis(Duration.fromInputUnsafe(timeout));
const propertyTestOptions = timeout => typeof timeout === "number" ? undefined : timeout;
const checkOptions = timeout => propertyTestOptions(timeout)?.arbitrary;
const compileArbitraryInput = input => Arbitrary.isArbitrary(input) ? input : Arbitrary.schema(input);
const makeArbitrary = arbitraries => Arbitrary.all(Array.isArray(arbitraries) ? arbitraries.map(compileArbitraryInput) : Object.fromEntries(Object.entries(arbitraries).map(([key, input]) => [key, compileArbitraryInput(input)])));
const normalizeProperty = (property, value) => Effect.catchCause(Effect.suspend(() => {
  const output = property(value);
  return Effect.isEffect(output) ? output : Effect.succeed(output);
}), cause => Cause.hasInterrupts(cause) ? Effect.failCause(cause) : Effect.fail(cause));
const runCheck = (ctx, arbitrary, property, options) => runTest(ctx)(Effect.flatMapEager(Arbitrary.checkEffect(arbitrary, value => normalizeProperty(property, value), options), result => {
  const failure = Arbitrary.formatCheckFailure(result);
  return failure === undefined ? Effect.void : Effect.die(new Error(failure));
}));
// Vitest decides which fixtures to set up by parsing the source of a test
// function's context parameter, and there is no public API to supply the names
// for a wrapper, so wrappers expose the source of the function they call.
const withFixturesOf = (source, f) => Object.defineProperty(f, "toString", {
  value: () => source.toString()
});
const runHook = (fn, run) => withFixturesOf(fn, (...args) => {
  const result = fn(...args);
  if (!Effect.isEffect(result)) {
    return result;
  }
  const scope = Scope.makeUnsafe();
  // Everything the hook leaves behind lives in the scope: the resources it
  // acquired and, ahead of them, a cleanup function it returned. On failure
  // the scope closes inside the fiber, so interrupting it awaits the release.
  const effect = Scope.provide(result, scope).pipe(Effect.flatMap(cleanup => typeof cleanup === "function" ? Scope.addFinalizer(scope, Effect.promise(async () => await cleanup())) : Effect.void), Effect.onError(cause => Scope.close(scope, Exit.failCause(cause))));
  return run(args, effect, scope);
});
// Closing must outlive an already-aborted signal, so it runs without one.
const closeHookScope = scope => runPromise(Scope.close(scope, Exit.void));
/** @internal */
export const beforeAll = (fn, timeout) => {
  let dispose = () => Promise.resolve();
  // Vitest drops the cleanup of a setup that outlives its timeout, so the
  // scope is disposed by the cleanup of a hook registered just before this
  // one. It runs in the same cleanup phase, in the slot next to this hook's,
  // with this hook's timeout.
  V.beforeAll(() => () => dispose(), timeout);
  V.beforeAll(runHook(fn, (_, effect, scope) => {
    const fiber = Effect.runFork(effect);
    // Interrupting a setup that Vitest stopped waiting for awaits its release.
    dispose = () => runPromise(Effect.andThen(Fiber.interrupt(fiber), Scope.close(scope, Exit.void)));
    return runPromise(Fiber.join(fiber));
  }), timeout);
};
/** @internal */
export const beforeEach = (fn, timeout) => V.beforeEach(runHook(fn, ([ctx], effect, scope) =>
// The scope closes when Vitest runs the hook's cleanup after the test,
// and the next test waits for it even if that cleanup times out.
runTest(ctx)(effect).then(() => () => settleOnAbort(ctx, closeHookScope(scope)))), timeout);
const makeItProxy = (it, overrides) => new Proxy(it, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, argArray);
  },
  get(target, property, receiver) {
    if (Object.hasOwn(overrides, property)) {
      return Reflect.get(overrides, property);
    }
    // do not bind: binding would strip vitest's static helpers (e.g. `describe.each`)
    return Reflect.get(target, property, receiver);
  }
});
const collectTasks = (tasks, acc = []) => {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (task.type === "test" && task.mode !== "skip" && task.mode !== "todo") {
      acc.push(task);
    } else if (task.tasks !== undefined) {
      collectTasks(task.tasks, acc);
    }
  }
  return acc;
};
const runsMoreThanOnce = task => {
  const retry = typeof task.retry === "number" ? task.retry : task.retry?.count;
  return (retry ?? 0) > 0 || (task.repeats ?? 0) > 0;
};
const registerProp = (it, name, arbitraries, property, timeout) => {
  const arbitrary = makeArbitrary(arbitraries);
  // Property callbacks receive only the base context; the empty source requests no fixtures.
  it(name, testOptions(timeout), withFixturesOf(() => {}, ctx => runCheck(ctx, arbitrary, values => property(values, ctx), checkOptions(timeout))));
};
const makeTester = (mapEffect, it) => {
  const run = (ctx, args, self) => pipe(Effect.suspend(() => self(...args)), mapEffect, runTest(ctx));
  const register = test => (name, self, timeout) => test(name, testOptions(timeout), withFixturesOf(self, ctx => run(ctx, [ctx], self)));
  const each = cases => (name, self, timeout) => it.for(cases)(name, testOptions(timeout), withFixturesOf(self, (args, ctx) => run(ctx, [args, ctx], self).then(constVoid)));
  const prop = (name, arbitraries, self, timeout) => registerProp(it, name, arbitraries, (values, ctx) => Effect.mapEager(mapEffect(Effect.suspend(() => self(values, ctx))), value => value !== false), timeout);
  return Object.assign(register(it), {
    skip: register(it.skip),
    skipIf: condition => register(it.skipIf(condition)),
    runIf: condition => register(it.runIf(condition)),
    only: register(it.only),
    each,
    fails: register(it.fails),
    prop
  });
};
const makeProp = it => (name, arbitraries, self, timeout) => registerProp(it, name, arbitraries, (values, ctx) => {
  const result = self(values, ctx);
  if (result !== undefined && typeof result !== "boolean") {
    throw new TypeError("it.prop callbacks must return boolean or void. Use it.effect.prop for Effect callbacks.");
  }
  return result !== false;
}, timeout);
const makeLayer = it => (layer_, options) => (...args) => {
  const excludeTestServices = options?.excludeTestServices ?? false;
  const withTestEnv = excludeTestServices ? layer_ : Layer.provideMerge(layer_, TestEnv);
  const memoMap = options?.memoMap ?? Effect.runSync(Layer.makeMemoMap);
  const buildPerTest = options?.buildPerTest ?? false;
  const suiteOptions = options?.concurrent === undefined ? {} : {
    concurrent: options.concurrent
  };
  const makeBlockMethods = provide => makeItProxy(it, {
    effect: makeTester(effect => provide(Effect.scoped(effect)), it),
    prop: makeProp(it),
    flakyTest,
    layer(nestedLayer, nestedOptions) {
      return makeLayer(it)(Layer.provideMerge(nestedLayer, withTestEnv), {
        ...nestedOptions,
        memoMap: Layer.forkMemoMapUnsafe(memoMap),
        excludeTestServices,
        // The services of a per-test block only exist during a test, so
        // blocks nested in it are built per test as well.
        buildPerTest: buildPerTest || nestedOptions?.buildPerTest === true
      });
    }
  });
  if (buildPerTest) {
    // Each test builds into its own fork of the memo map, so it reuses the
    // services of enclosing blocks and releases the rest when it finishes.
    const methods = makeBlockMethods(effect => Effect.scopedWith(scope => Layer.buildWithMemoMap(withTestEnv, Layer.forkMemoMapUnsafe(memoMap), scope).pipe(Effect.orDie, Effect.flatMap(context => Effect.provide(effect, context)))));
    if (args.length === 1) {
      return args[0](methods);
    }
    return V.describe(args[0], suiteOptions, () => args[1](methods));
  }
  const scope = Effect.runSync(Scope.make());
  const contextEffect = Layer.buildWithMemoMap(withTestEnv, memoMap, scope).pipe(Effect.orDie, Effect.cached, Effect.runSync);
  let closed = false;
  const closeScope = () => {
    if (closed) {
      return Promise.resolve();
    }
    closed = true;
    // Layer cleanup must outlive the last test's already-aborted signal.
    return runPromise(Scope.close(scope, Exit.void));
  };
  const methods = makeBlockMethods(effect => Effect.flatMap(contextEffect, context => Effect.provide(effect, context)));
  if (args.length === 1) {
    const currentSuite = getCurrentSuite();
    const previousTasks = new Set(currentSuite.tasks);
    args[0](methods);
    const blockTasks = collectTasks(currentSuite.tasks.filter(task => !previousTasks.has(task)));
    if (blockTasks.length === 0) {
      V.afterAll(() => closeScope(), hookTimeout(options?.timeout));
      return;
    }
    const blockTaskSet = new Set(blockTasks);
    // Vitest runs hooks once per retry and repeat attempt, so a test's last
    // attempt cannot be counted. Blocks with such tests are released by `afterAll`.
    const releaseAfterLastTest = !blockTasks.some(runsMoreThanOnce);
    let remaining = blockTasks.length;
    V.beforeEach(
    // Destructured so Vitest can parse the hook once the suite defines fixtures.
    ({
      onTestFinished,
      signal,
      task
    }) => {
      if (!blockTaskSet.has(task)) {
        return;
      }
      if (releaseAfterLastTest) {
        onTestFinished(() => {
          remaining--;
          if (remaining === 0) {
            return closeScope();
          }
        });
      }
      return runPromise(Effect.asVoid(contextEffect), {
        signal
      });
    }, hookTimeout(options?.timeout));
    V.afterAll(() => closeScope(), hookTimeout(options?.timeout));
    return;
  }
  return V.describe(args[0], suiteOptions, () => {
    V.beforeAll(() => runPromise(Effect.asVoid(contextEffect)), hookTimeout(options?.timeout));
    V.afterAll(() => closeScope(), hookTimeout(options?.timeout));
    return args[1](methods);
  });
};
/** @internal */
export const flakyTest = (self, timeout = Duration.seconds(30)) => pipe(self, Effect.scoped, Effect.sandbox, Effect.retry(pipe(Schedule.recurs(10), Schedule.while(_ => Effect.succeed(Duration.isLessThanOrEqualTo(Duration.fromInputUnsafe(_.elapsed), Duration.fromInputUnsafe(timeout)))))), Effect.orDie);
/** @internal */
export const makeMethods = it => makeItProxy(it, {
  effect: makeTester(flow(Effect.scoped, Effect.provide(TestEnv)), it),
  live: makeTester(Effect.scoped, it),
  flakyTest,
  layer: makeLayer(it),
  prop: makeProp(it)
});
/** @internal */
export const it = /*#__PURE__*/makeMethods(V.it);
/** @internal */
export const {
  /** @internal */
  effect,
  /** @internal */
  layer,
  /** @internal */
  live,
  /** @internal */
  prop
} = it;
/** @internal */
export const describeWrapped = (name, f) => V.describe(name, () => f(it));
//# sourceMappingURL=internal.js.map