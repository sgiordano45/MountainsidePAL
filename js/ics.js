/* Calendar export.
 *
 * A GitHub Pages site is static — there's no server to host a live-updating
 * subscription feed, and Cloud Functions need a paid Firebase plan. So this
 * generates the .ics in the browser and hands it over as a download: the parent
 * imports it once and the events land in whatever calendar they use.
 *
 * The tradeoff to know about: an imported file is a snapshot. If the league
 * revises the schedule, parents need to re-import. Per-event "add to calendar"
 * links avoid that for one-off changes.
 */

import { parseLocal } from "./dates.js";
import { eventTitle, mapsUrl } from "./events.js";

const PRODID = "-//Mountainside PAL Basketball//EN";

/** RFC 5545 wants UTC stamps ending in Z. */
function stamp(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Long lines must be folded at 75 octets, continued with a leading space. */
function fold(line) {
  const out = [];
  let s = line;
  while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); }
  out.push(s);
  return out.join("\r\n");
}

/** Escape per spec: backslash, semicolon, comma, newline. */
const esc = s => String(s ?? "")
  .replace(/\\/g, "\\\\").replace(/;/g, "\\;")
  .replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildICS(events, teamsById, locsById, calName = "Mountainside PAL Basketball") {
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calName)}`,
    "X-WR-TIMEZONE:America/New_York"
  ];

  for (const ev of events) {
    const start = parseLocal(ev.startAt);
    if (!start) continue;
    const end = ev.endAt ? parseLocal(ev.endAt)
                         : new Date(start.getTime() + 90 * 60000);   // 90 min default

    const loc = locsById?.[ev.locationId];
    const where = loc ? [loc.name, loc.address].filter(Boolean).join(", ") : "";
    const url = mapsUrl(loc);

    const desc = [
      ev.notes || "",
      ev.status === "cancelled" ? "CANCELLED" : "",
      url ? `Map: ${url}` : ""
    ].filter(Boolean).join("\n");

    lines.push(
      "BEGIN:VEVENT",
      fold(`UID:${ev.id}@mountainsidepal`),
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      fold(`SUMMARY:${esc((ev.status === "cancelled" ? "CANCELLED — " : "") +
        eventTitle(ev, teamsById))}`),
      where ? fold(`LOCATION:${esc(where)}`) : null,
      desc  ? fold(`DESCRIPTION:${esc(desc)}`) : null,
      ev.status === "cancelled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

export function downloadICS(text, filename = "mountainside-pal.ics") {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Single-event "add to Google Calendar" link — no download, always current. */
export function googleCalendarUrl(ev, teamsById, locsById) {
  const start = parseLocal(ev.startAt);
  if (!start) return null;
  const end = ev.endAt ? parseLocal(ev.endAt) : new Date(start.getTime() + 90 * 60000);
  const loc = locsById?.[ev.locationId];

  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: eventTitle(ev, teamsById),
    dates: `${stamp(start)}/${stamp(end)}`,
    location: loc ? [loc.name, loc.address].filter(Boolean).join(", ") : "",
    details: ev.notes || ""
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
