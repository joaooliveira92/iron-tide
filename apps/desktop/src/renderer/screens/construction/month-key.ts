import {
  formatCampaignMonth,
  type PresentationFormat,
} from "../../lib/presentation-format/index.js";

const MONTH_KEY = /^(\d{4})-(\d{2})$/;

export function formatMonthKey(format: PresentationFormat, key: string): string {
  const match = MONTH_KEY.exec(key);
  if (match === null) return "unknown month";
  const year = Number(match[1]);
  const month = Number(match[2]);
  return formatCampaignMonth({ year, month }, { locale: format.locale });
}
