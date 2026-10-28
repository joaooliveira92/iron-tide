import {
  OVERLAY_SCHEMA_VERSION,
  OverlayContractError,
  assertOverlayFeature,
  overlayFeatureKey,
  sortOverlayChanges,
  sortOverlayFeatures,
  type OverlayChange,
  type OverlayChangeSet,
  type OverlayFeature,
  type OverlaySelection,
  type OverlaySnapshot,
  type OverlayVisibilityChange,
} from "./overlay-contract.js";

export type OverlayListener = (changeSet: OverlayChangeSet) => void;
export type VisibilityListener = (change: OverlayVisibilityChange) => void;
export type SelectionListener = (selection: OverlaySelection) => void;

export interface OverlayStoreOptions {
  readonly disposeSignal?: AbortSignal;
}

export class OverlayStore {
  private readonly features = new Map<string, OverlayFeature>();
  private readonly visibilityState = new Map<string, boolean>();
  private readonly listeners = new Set<OverlayListener>();
  private readonly visibilityListeners = new Set<VisibilityListener>();
  private readonly selectionListeners = new Set<SelectionListener>();
  private version = 0;
  private selectionState: OverlaySelection = { selectedId: null, hoveredId: null };
  private disposed = false;

  constructor(options: OverlayStoreOptions = {}) {
    options.disposeSignal?.addEventListener("abort", () => this.dispose(), { once: true });
  }

  apply(changes: readonly OverlayChange[]): OverlayChangeSet {
    this.assertOpen();
    const ordered = sortOverlayChanges(changes);
    const seen = new Set<string>();
    const applied: OverlayChange[] = [];
    for (const change of ordered) {
      if (seen.has(change.id)) {
        throw new OverlayContractError("change", `duplicate overlay change for '${change.id}'`);
      }
      seen.add(change.id);
      if (change.type === "upsert") {
        assertOverlayFeature(change.feature);
        if (change.feature.id !== change.id) {
          throw new OverlayContractError(
            "change",
            `overlay change id '${change.id}' does not match its feature`,
          );
        }
        if (
          overlayFeatureKey(change.feature) === overlayFeatureKeyOf(this.features.get(change.id))
        ) {
          continue;
        }
        this.features.set(change.id, change.feature);
        applied.push(change);
      } else {
        if (!this.features.delete(change.id)) continue;
        this.visibilityState.delete(change.id);
        applied.push(change);
      }
    }
    return this.commit(applied);
  }

  replace(features: readonly OverlayFeature[]): OverlayChangeSet {
    this.assertOpen();
    const next = new Map<string, OverlayFeature>();
    for (const feature of features) {
      assertOverlayFeature(feature);
      if (next.has(feature.id)) {
        throw new OverlayContractError("change", `duplicate overlay feature '${feature.id}'`);
      }
      next.set(feature.id, feature);
    }
    const changes: OverlayChange[] = [];
    for (const [id, current] of this.features) {
      if (!next.has(id)) changes.push({ type: "remove", id });
      else {
        const replacement = next.get(id) as OverlayFeature;
        if (overlayFeatureKey(current) !== overlayFeatureKey(replacement)) {
          changes.push({ type: "upsert", id, feature: replacement });
        }
      }
    }
    for (const [id, feature] of next) {
      if (!this.features.has(id)) changes.push({ type: "upsert", id, feature });
    }
    return this.apply(changes);
  }

  replaceRoutes(routes: readonly OverlayFeature[]): OverlayChangeSet {
    this.assertOpen();
    const existingRoutes = [...this.features.values()].filter(
      (feature) => feature.kind === "route",
    );
    const changes: OverlayChange[] = [];
    const next = new Map(routes.map((route) => [route.id, route]));
    for (const route of routes) assertOverlayFeature(route);
    for (const current of existingRoutes) {
      const replacement = next.get(current.id);
      if (replacement === undefined) changes.push({ type: "remove", id: current.id });
      else if (overlayFeatureKey(current) !== overlayFeatureKey(replacement)) {
        changes.push({ type: "upsert", id: current.id, feature: replacement });
      }
    }
    const existingIds = new Set(existingRoutes.map((route) => route.id));
    for (const route of routes) {
      if (!existingIds.has(route.id))
        changes.push({ type: "upsert", id: route.id, feature: route });
    }
    return this.apply(changes);
  }

  snapshot(): OverlaySnapshot {
    return {
      schemaVersion: OVERLAY_SCHEMA_VERSION,
      version: this.version,
      features: sortOverlayFeatures([...this.features.values()]),
    };
  }

  selection(): OverlaySelection {
    return this.selectionState;
  }

  setSelection(selectedId: string | null): void {
    if (selectedId !== null && !this.features.has(selectedId)) return;
    if (this.selectionState.selectedId === selectedId) return;
    this.selectionState = { ...this.selectionState, selectedId };
    this.emitSelection();
  }

  setHovered(hoveredId: string | null): void {
    if (hoveredId !== null && !this.features.has(hoveredId)) return;
    if (this.selectionState.hoveredId === hoveredId) return;
    this.selectionState = { ...this.selectionState, hoveredId };
    this.emitSelection();
  }

  visible(id: string): boolean {
    return this.visibilityState.get(id) ?? true;
  }

  setVisible(id: string, visible: boolean): OverlayVisibilityChange | null {
    this.assertOpen();
    if (!this.features.has(id)) return null;
    if (this.visible(id) === visible) return null;
    this.visibilityState.set(id, visible);
    const change = { id, visible };
    for (const listener of this.visibilityListeners) listener(change);
    return change;
  }

  subscribe(listener: OverlayListener): () => void {
    this.assertOpen();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeVisibility(listener: VisibilityListener): () => void {
    this.assertOpen();
    this.visibilityListeners.add(listener);
    return () => this.visibilityListeners.delete(listener);
  }

  subscribeSelection(listener: SelectionListener): () => void {
    this.assertOpen();
    this.selectionListeners.add(listener);
    return () => this.selectionListeners.delete(listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.features.clear();
    this.visibilityState.clear();
    this.listeners.clear();
    this.visibilityListeners.clear();
    this.selectionListeners.clear();
    this.selectionState = { selectedId: null, hoveredId: null };
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  private commit(changes: readonly OverlayChange[]): OverlayChangeSet {
    const baseVersion = this.version;
    if (changes.length > 0) this.version += 1;
    const changeSet: OverlayChangeSet = {
      schemaVersion: OVERLAY_SCHEMA_VERSION,
      baseVersion,
      version: this.version,
      changes,
    };
    if (changes.length > 0) for (const listener of this.listeners) listener(changeSet);
    return changeSet;
  }

  private emitSelection(): void {
    for (const listener of this.selectionListeners) listener(this.selectionState);
  }

  private assertOpen(): void {
    if (this.disposed) throw new OverlayContractError("store", "overlay store is disposed");
  }
}

function overlayFeatureKeyOf(feature: OverlayFeature | undefined): string | null {
  return feature === undefined ? null : overlayFeatureKey(feature);
}
