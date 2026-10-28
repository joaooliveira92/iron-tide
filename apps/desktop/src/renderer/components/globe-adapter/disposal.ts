export type Disposer = () => void;

export class DisposalRegistry {
  private readonly disposers: Disposer[] = [];
  private disposed = false;

  add(disposer: Disposer): () => void {
    if (this.disposed) {
      disposer();
      return () => undefined;
    }
    this.disposers.push(disposer);
    return () => {
      const index = this.disposers.indexOf(disposer);
      if (index >= 0) this.disposers.splice(index, 1);
    };
  }

  get size(): number {
    return this.disposers.length;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (let index = this.disposers.length - 1; index >= 0; index--) {
      const disposer = this.disposers[index];
      this.disposers.splice(index, 1);
      disposer?.();
    }
  }
}
