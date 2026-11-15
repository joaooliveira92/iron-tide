export const PRESENCE_WARNING_MESSAGES = {
  "fleet.presenceWarning.title": "Presence warning",
  "fleet.presenceWarning.row":
    "{station}: the queued orders leave {present} t on station against {required} t required, a shortfall of {shortfall} t (was {before} t).",
  "fleet.presenceWarning.advice":
    "A shortfall at month end costs prestige. You can cancel or change the queued orders.",
  "reports.presence.title": "Foreign-station presence",
  "reports.presence.prestige": "Prestige {delta} for the presence shortfall.",
  "reports.presence.row":
    "{station}: {present} t on station against {required} t required, short {shortfall} t.",
} as const;
