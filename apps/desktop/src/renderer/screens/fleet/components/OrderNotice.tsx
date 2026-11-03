import { memo } from "react";

export const OrderNotice = memo(function OrderNotice({
  notice,
}: {
  readonly notice: string | null;
}) {
  if (notice === null) return null;
  return (
    <p
      role="status"
      className="whitespace-pre-line border-l-2 border-admiralty-border pl-3 text-sm text-admiralty-ink-muted"
    >
      {notice}
    </p>
  );
});
