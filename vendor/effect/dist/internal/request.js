import * as Context from "../Context.js";
import { dual } from "../Function.js";
import * as MutableHashMap from "../MutableHashMap.js";
import * as Option from "../Option.js";
import { makeEntry } from "../Request.js";
import { Scheduler } from "../Scheduler.js";
import { exitDie, isEffect, withFiber } from "./core.js";
import * as effect from "./effect.js";
/** @internal */
export const request = /*#__PURE__*/dual(2, (self, resolver) => {
  const withResolver = resolver => effect.callback(resume => {
    const entry = addEntry(resolver, self, resume, effect.getCurrentFiber());
    return maybeRemoveEntry(resolver, entry);
  });
  return isEffect(resolver) ? effect.flatMap(resolver, withResolver) : withResolver(resolver);
});
/** @internal */
export const requestUnsafe = (self, options) => {
  const entry = addEntry(options.resolver, self, options.onExit, {
    context: options.context,
    cache: {
      scheduler: Context.get(options.context, Scheduler)
    }
  });
  return () => removeEntryUnsafe(options.resolver, entry);
};
/**
 * Pending batches of resolvers whose `batchKey` is in this set match keys with
 * `Equal` instead of by reference.
 *
 * @internal
 */
export const equalBatchKeys = /*#__PURE__*/new WeakSet();
const makeBatchMap = resolver => {
  if (!equalBatchKeys.has(resolver.batchKey)) return new Map();
  const map = MutableHashMap.empty();
  return {
    get: key => Option.getOrUndefined(MutableHashMap.get(map, key)),
    has: key => MutableHashMap.has(map, key),
    set: (key, batch) => MutableHashMap.set(map, key, batch),
    delete: key => MutableHashMap.remove(map, key)
  };
};
const pendingBatches = /*#__PURE__*/new WeakMap();
// Batches are built outside `addEntry` so their callbacks do not share a closure
// context with per-request entries, which would keep completed requests alive.
const makeBatch = (key, context, resolver, map) => {
  const batch = {
    key,
    context,
    resolver,
    map,
    entrySet: new Set(),
    entries: new Set(),
    delayEffect: effect.flatMap(withFiber(delayFiber => {
      // Reentrant delay callbacks may fill the batch and interrupt this fiber.
      batch.fiber = delayFiber;
      return batch.resolver.delay;
    }), _ => runBatch(batch)),
    run: effect.onExit(effect.suspend(() => batch.resolver.runAll(Array.from(batch.entries), batch.key)), exit => {
      for (const entry of batch.entrySet) {
        entry.completeUnsafe(exit._tag === "Success" ? exitDie(new Error("Effect.request: RequestResolver did not complete request", {
          cause: entry.request
        })) : exit);
      }
      batch.entries.clear();
      return effect.void;
    })
  };
  return batch;
};
const addEntry = (resolver, request, resume, fiber) => {
  let batchMap = pendingBatches.get(resolver);
  if (!batchMap) {
    batchMap = makeBatchMap(resolver);
    pendingBatches.set(resolver, batchMap);
  }
  let batch;
  let completed = false;
  const entry = makeEntry({
    request,
    context: fiber.context,
    uninterruptible: false,
    completeUnsafe(effect) {
      if (completed) return;
      completed = true;
      // Removed entries still notify resolver hooks, but not their cancelled callers.
      if (batch && !batch.entrySet.delete(entry)) return;
      resume(effect);
    }
  });
  if (resolver.preCheck !== undefined && !resolver.preCheck(entry)) {
    return entry;
  }
  const key = resolver.batchKey(entry);
  batch = batchMap.get(key);
  const isNewBatch = batch === undefined;
  if (!batch) {
    batch = makeBatch(key, fiber.context, resolver, batchMap);
    batchMap.set(key, batch);
  }
  batch.entrySet.add(entry);
  batch.entries.add(entry);
  if (isNewBatch) {
    const delayFiber = effect.runForkWith(fiber.context)(batch.delayEffect, {
      scheduler: fiber.cache.scheduler
    });
    // A synchronous delay may have already run this batch.
    if (completed || batchMap.get(key) !== batch) return entry;
    batch.fiber = delayFiber;
  }
  if (batch.resolver.collectWhile(batch.entries)) return entry;
  batch.fiber.interruptUnsafe(fiber.id);
  effect.runForkWith(batch.context)(runBatch(batch), {
    scheduler: Context.get(batch.context, Scheduler)
  });
  return entry;
};
const removeEntryUnsafe = (resolver, entry) => {
  if (entry.uninterruptible) return;
  const batchMap = pendingBatches.get(resolver);
  if (!batchMap) return;
  const key = resolver.batchKey(entry);
  const batch = batchMap.get(key);
  if (!batch) return;
  if (!batch.entries.delete(entry)) return;
  batch.entrySet.delete(entry);
  let fiber;
  if (batch.entries.size === 0) {
    batchMap.delete(key);
    fiber = batch.fiber;
  }
  // Delay finalizers may enqueue new requests, so complete the removed entry first.
  entry.completeUnsafe(effect.exitInterrupt());
  fiber?.interruptUnsafe();
};
const maybeRemoveEntry = (resolver, entry) => effect.sync(() => removeEntryUnsafe(resolver, entry));
function runBatch(batch) {
  if (!batch.map.has(batch.key)) return effect.void;
  batch.map.delete(batch.key);
  return batch.run;
}
//# sourceMappingURL=request.js.map