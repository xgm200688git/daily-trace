import { addDays, format, parseISO, startOfWeek, subDays, type Day } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import { DEFAULT_TIMEZONE, DEFAULT_WEEK_STARTS_ON } from "@/lib/constants";

export function toLocalDateKey(
  date: Date,
  timezone = DEFAULT_TIMEZONE,
): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function formatLocalTime(date: Date, timezone = DEFAULT_TIMEZONE): string {
  return formatInTimeZone(date, timezone, "HH:mm");
}

export function toDateTimeLocalValue(
  date: Date | string,
  timezone = DEFAULT_TIMEZONE,
): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm");
}

export function fromDateTimeLocalValue(
  value: string,
  timezone = DEFAULT_TIMEZONE,
): Date | undefined {
  if (!value.trim()) {
    return undefined;
  }

  try {
    return fromZonedTime(value, timezone);
  } catch {
    return undefined;
  }
}

export function toLocalWeekStartKey(
  date: Date,
  timezone = DEFAULT_TIMEZONE,
  weekStartsOn = DEFAULT_WEEK_STARTS_ON,
): string {
  const zoned = toZonedTime(date, timezone);
  return format(startOfWeek(zoned, { weekStartsOn: weekStartsOn as Day }), "yyyy-MM-dd");
}

export function weekStartFromDateKey(
  dateKey: string,
  weekStartsOn = DEFAULT_WEEK_STARTS_ON,
): string {
  return format(
    startOfWeek(parseISO(`${dateKey}T00:00:00`), { weekStartsOn: weekStartsOn as Day }),
    "yyyy-MM-dd",
  );
}

export function weekEndFromStartKey(weekStart: string): string {
  return format(addDays(parseISO(`${weekStart}T00:00:00`), 6), "yyyy-MM-dd");
}

export function listDateKeysInRange(start: string, end: string): string[] {
  const startDate = parseISO(`${start}T00:00:00`);
  const endDate = parseISO(`${end}T00:00:00`);
  const keys: string[] = [];

  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    keys.push(format(cursor, "yyyy-MM-dd"));
  }

  return keys;
}

export function todayKey(timezone = DEFAULT_TIMEZONE): string {
  return toLocalDateKey(new Date(), timezone);
}

export function yesterdayKey(timezone = DEFAULT_TIMEZONE): string {
  return toLocalDateKey(subDays(new Date(), 1), timezone);
}

export function chineseDateLabel(dateKey: string): string {
  return format(parseISO(`${dateKey}T00:00:00`), "M月d日");
}
