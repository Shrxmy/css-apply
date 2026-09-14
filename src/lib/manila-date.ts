const MANILA_TIME_ZONE = "Asia/Manila";

/** Returns a calendar date key in Philippine time. */
export function getManilaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export const MANILA_TIME_ZONE_NAME = MANILA_TIME_ZONE;
