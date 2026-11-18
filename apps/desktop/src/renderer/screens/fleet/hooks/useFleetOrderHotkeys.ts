import { useCallback, useMemo } from "react";
import { orderHotkeyIntent, stepDivisionSelection } from "../fleet-hotkeys.js";
import type { DivisionPickerRow } from "../fleet-screen-state.js";
import { useFleetHotkeys } from "./useFleetHotkeys.js";
import type { UseFleetScreenReturn } from "./useFleetScreen.js";

export function useFleetOrderHotkeys(
  screen: UseFleetScreenReturn,
  divisionRows: readonly DivisionPickerRow[],
  orderBusy: boolean,
): void {
  const {
    selectedDivision,
    destinationAreaId,
    pendingRoute,
    setSelectedDivisionId,
    submit,
    replace,
    cancel,
  } = screen;
  const divisionIds = useMemo(() => divisionRows.map((row) => row.divisionId), [divisionRows]);
  const runOrderHotkey = useCallback(
    (action: "submit-order" | "cancel-order") => {
      const intent = orderHotkeyIntent(action, {
        busy: orderBusy,
        divisionSelected: selectedDivision !== null,
        destinationChosen: destinationAreaId !== null,
        pendingCommandId: pendingRoute?.commandId ?? null,
      });
      if (intent === null) return;
      if (intent.kind === "submit") submit();
      else if (intent.kind === "replace") replace(intent.commandId);
      else cancel(intent.commandId);
    },
    [orderBusy, selectedDivision, destinationAreaId, pendingRoute, submit, replace, cancel],
  );
  useFleetHotkeys({
    "previous-division": () =>
      setSelectedDivisionId((current) => stepDivisionSelection(divisionIds, current, -1)),
    "next-division": () =>
      setSelectedDivisionId((current) => stepDivisionSelection(divisionIds, current, 1)),
    "focus-destination": () =>
      document.querySelector<HTMLElement>("[data-fleet-destination]")?.focus(),
    "submit-order": () => runOrderHotkey("submit-order"),
    "cancel-order": () => runOrderHotkey("cancel-order"),
  });
}
