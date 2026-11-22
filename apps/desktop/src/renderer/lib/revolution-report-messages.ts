export const REVOLUTION_REPORT_MESSAGES = {
  "reports.revolution.title": "Foreign revolutions",
  "reports.revolution.line":
    "{nation} fell to revolution: its government changed from {before} to {after}.",
  "reports.revolution.government.liberal_democracy": "liberal democracy",
  "reports.revolution.government.limited_democracy": "limited democracy",
  "reports.revolution.government.autocratic": "autocracy",
  "reports.revolution.government.fascist": "fascist state",
  "reports.revolution.government.communist": "communist state",
  "reports.revolution.government.eastern": "eastern monarchy",
} as const satisfies Readonly<Record<string, string>>;
