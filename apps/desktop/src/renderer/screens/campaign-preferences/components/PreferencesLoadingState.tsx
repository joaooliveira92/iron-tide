import { memo } from "react";
import { Skeleton } from "../../../components/ui/skeleton.js";

export const PreferencesLoadingState = memo(function PreferencesLoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <Skeleton className="h-28 rounded-lg" />
    </div>
  );
});
