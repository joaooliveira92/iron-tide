import { memo } from "react";
import { Alert, AlertDescription } from "../../../components/ui/alert.js";

export const OrderNotice = memo(function OrderNotice({
  notice,
}: {
  readonly notice: string | null;
}) {
  if (notice === null) return null;
  return (
    <Alert>
      <AlertDescription className="whitespace-pre-line">{notice}</AlertDescription>
    </Alert>
  );
});
