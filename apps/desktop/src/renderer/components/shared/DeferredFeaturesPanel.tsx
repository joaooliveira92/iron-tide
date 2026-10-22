export interface DeferredFeature {
  readonly id: string;
  readonly name: string;
  readonly reason: string;
}

export interface DeferredFeaturesPanelProps {
  readonly items: readonly DeferredFeature[];
  readonly testId: string;
  readonly title?: string;
}

export function DeferredFeaturesPanel({
  items,
  testId,
  title = "Not yet modelled by the engine",
}: DeferredFeaturesPanelProps) {
  return (
    <div className="mt-3 rounded-md border border-dashed px-3 py-2" data-testid={testId}>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="mt-1.5 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <span className="font-medium">{item.name}</span>
            <span className="text-muted-foreground"> — {item.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
