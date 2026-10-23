import { formatTimestamp } from "../../../lib/presentation-format/index.js";

export function formatEventTime(timestamp: string): string {
  return formatTimestamp(timestamp, { locale: "en-US", style: "time" });
}

export function formatEventDateTime(timestamp: string): string {
  return formatTimestamp(timestamp, { locale: "en-US", style: "dateTime" });
}
