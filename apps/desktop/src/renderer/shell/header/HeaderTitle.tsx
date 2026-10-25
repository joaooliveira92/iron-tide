import { useScreenHeaderSlot } from "../screen-header.js";

export interface HeaderTitleProps {
  readonly title: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  const { spec } = useScreenHeaderSlot();
  const Icon = spec?.icon;
  return (
    <div className="pointer-events-none absolute left-1/2 top-7 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
      {spec === null ? (
        <span className="max-w-37.5 truncate text-sm font-medium text-muted-foreground select-none sm:max-w-70">
          {title}
        </span>
      ) : (
        <>
          <span className="sr-only">{title}</span>
          <h1 className="flex max-w-80 items-center gap-2 truncate text-base font-medium tracking-tight select-none">
            {Icon !== undefined && (
              <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
            )}
            {spec.title}
          </h1>
        </>
      )}
    </div>
  );
}
