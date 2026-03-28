import { describe, expect, it } from "vitest";

import {
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
  toLocalDateKey,
  toLocalWeekStartKey,
  weekStartFromDateKey,
} from "@/lib/time";

describe("time helpers", () => {
  it("uses Asia/Shanghai local date for diary归档", () => {
    expect(toLocalDateKey(new Date("2026-03-28T16:30:00.000Z"))).toBe(
      "2026-03-29",
    );
  });

  it("computes ISO week start from a date key", () => {
    expect(weekStartFromDateKey("2026-03-28")).toBe("2026-03-23");
  });

  it("computes current local week start from a timestamp", () => {
    expect(toLocalWeekStartKey(new Date("2026-03-28T03:00:00.000Z"))).toBe(
      "2026-03-23",
    );
  });

  it("round-trips datetime-local values in Asia/Shanghai", () => {
    expect(toDateTimeLocalValue(new Date("2026-03-28T16:30:00.000Z"))).toBe(
      "2026-03-29T00:30",
    );
    expect(fromDateTimeLocalValue("2026-03-29T00:30")?.toISOString()).toBe(
      "2026-03-28T16:30:00.000Z",
    );
  });
});
