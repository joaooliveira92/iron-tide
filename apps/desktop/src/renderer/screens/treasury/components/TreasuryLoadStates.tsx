import { Skeleton } from "../../../components/ui/skeleton.js";

export function TreasuryLoadErrorState({ message }: { readonly message: string }) {
  return (
    <div data-guided-target="treasury">
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load Treasury: {message}
      </div>
    </div>
  );
}

export function TreasuryLoadingState() {
  return (
    <div data-guided-target="treasury" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {[0, 1, 2].map((idx) => (
        <Skeleton key={idx} className="h-28" />
      ))}
    </div>
  );
}
