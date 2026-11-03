import { useCallback, useEffect, useMemo, useState } from "react";
import type { WideTelemetryEvent } from "../../../lib/telemetry.js";
import { clearWideEvents, getRecordedWideEvents } from "../../../lib/telemetry.js";
import type { OutcomeFilter } from "../types.js";
import { filterEvents } from "../utils/filter.js";

export interface UseTelemetryInspectorReturn {
  readonly events: readonly WideTelemetryEvent[];
  readonly filteredEvents: readonly WideTelemetryEvent[];
  readonly eventSearchTerm: string;
  readonly outcomeFilter: OutcomeFilter;
  readonly selectedEvent: WideTelemetryEvent | null;
  readonly setEventSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  readonly setOutcomeFilter: React.Dispatch<React.SetStateAction<OutcomeFilter>>;
  readonly setSelectedEvent: React.Dispatch<React.SetStateAction<WideTelemetryEvent | null>>;
  readonly clearEvents: () => void;
}

export function useTelemetryInspector(): UseTelemetryInspectorReturn {
  const [events, setEvents] = useState<readonly WideTelemetryEvent[]>([]);
  const [eventSearchTerm, setEventSearchTerm] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [selectedEvent, setSelectedEvent] = useState<WideTelemetryEvent | null>(null);

  useEffect(() => {
    setEvents(getRecordedWideEvents());
  }, []);

  const clearEvents = useCallback(() => {
    clearWideEvents();
    setEvents([]);
    setSelectedEvent(null);
  }, []);

  const filteredEvents = useMemo(
    () => filterEvents(events, eventSearchTerm, outcomeFilter),
    [events, eventSearchTerm, outcomeFilter],
  );

  return {
    events,
    filteredEvents,
    eventSearchTerm,
    outcomeFilter,
    selectedEvent,
    setEventSearchTerm,
    setOutcomeFilter,
    setSelectedEvent,
    clearEvents,
  };
}
