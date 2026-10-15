export function formatEventTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function formatEventDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}
