export interface HeaderTitleProps {
  readonly title: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-7 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
      <span className="max-w-37.5 truncate text-sm font-medium text-muted-foreground select-none sm:max-w-70">
        {title}
      </span>
    </div>
  );
}
