/* Date helpers.
 *
 * RULE: never `new Date("2027-01-15")` — that parses as UTC and drags a
 * Friday evening game onto Saturday for anyone east of Greenwich, and onto
 * Thursday for us. Always build from local components.
 */

export const TZ = "America/New_York";

/** "2027-01-15" or "2027-01-15 18:30" -> local Date */
export function parseLocal(value) {
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === "function") return value.toDate(); // Firestore Timestamp
  if (typeof value !== "string") return null;

  const m = value.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/
  );
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(+y, +mo - 1, +d, h ? +h : 0, mi ? +mi : 0, 0, 0);
}

const fmt = (opts) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts });

/** Fri, Jan 15 */
export function formatDate(value, opts = {}) {
  const d = parseLocal(value);
  if (!d) return "";
  return fmt({ weekday: "short", month: "short", day: "numeric", ...opts }).format(d);
}

/** January 15, 2027 */
export function formatLongDate(value) {
  return formatDate(value, { weekday: undefined, month: "long", year: "numeric" });
}

/** 6:30 PM */
export function formatTime(value) {
  const d = parseLocal(value);
  if (!d) return "";
  return fmt({ hour: "numeric", minute: "2-digit" }).format(d);
}

/** Fri, Jan 15 · 6:30 PM */
export function formatDateTime(value) {
  const d = parseLocal(value);
  if (!d) return "";
  return `${formatDate(d)} · ${formatTime(d)}`;
}

export function isPast(value) {
  const d = parseLocal(value);
  return d ? d.getTime() < Date.now() : false;
}

/** "in 12 days" / "today" / "3 days ago" */
export function relativeDays(value) {
  const d = parseLocal(value);
  if (!d) return "";
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(new Date())) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}
