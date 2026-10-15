import { GlassCard } from "@/components/ui/glass-card.js";
import { CardContent } from "../../../components/ui/card.js";
import { Skeleton } from "../../../components/ui/skeleton.js";

/** Shown when the base campaign read fails: the whole screen is the error. */
export function OverviewLoadErrorState({ message }: { readonly message: string }) {
  return (
    <div data-guided-target="overview" className="p-8">
      <GlassCard glassVariant="liquid-refract" className="border-destructive/50">
        <CardContent className="p-4 text-destructive">
          Failed to load campaign overview: {message}
        </CardContent>
      </GlassCard>
    </div>
  );
}

/** Shown while the base campaign projection is still loading. */
export function OverviewLoadingState() {
  return (
    <div data-guided-target="overview" className="h-full min-h-[28rem] p-3">
      <Skeleton className="h-full w-full rounded-lg" />
    </div>
  );
}
