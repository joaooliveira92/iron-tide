import { memo } from "react";
import { Card, CardContent } from "../../../components/ui/card.js";
import { Skeleton } from "../../../components/ui/skeleton.js";

export const LoadingState = memo(function LoadingState() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Fleet</h2>
      </div>
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 py-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    </div>
  );
});
