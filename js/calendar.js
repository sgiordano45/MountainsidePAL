/* Month-grid calendar renderer. Pure DOM, no dependency. */

import { parseLocal } from "./dates.js";
import { eventTitle } from "./events.js";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["January","February","March","April","May","June",
               "July","August","September","October","November","December"];

const esc = s => String(s ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * @param {HTMLElement} mount
 * @param {Array} events
 * @param {Object} teamsById
 * @param {Date}   month   any date inside the month to show
 * @param {Function} onMonthChange
 */
export function renderCalendar(mount, events, teamsById, month, onMonthChange) {
  const y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());          // back up to Sunday
  const todayKey = dayKey(new Date());

  const byDay = new Map();
  for (const ev of events) {
    const d = parseLocal(ev.startAt);
    if (!d) continue;
    const k = dayKey(d);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(ev);
  }

  let cells = DOW.map(d => `<div class="dow">${d}</div>`).join("");

  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const k = dayKey(d);
    const out = d.getMonth() !== m;
    const evs = (byDay.get(k) || []).sort(
      (a, b) => parseLocal(a.startAt) - parseLocal(b.startAt)
    );

    const items = evs.slice(0, 3).map(ev => {
      const t = parseLocal(ev.startAt);
      const time = ev.allDay ? "" :
        `${t.getHours() % 12 || 12}${t.getMinutes() ? ":" + String(t.getMinutes()).padStart(2, "0") : ""}${t.getHours() < 12 ? "a" : "p"} `;
      const cls = `${ev.type}${ev.status === "cancelled" ? " cancelled" : ""}`;
      const label = eventTitle(ev, teamsById);
      return `<span class="ev ${cls}" title="${esc(label)}">${time}${esc(label)}</span>`;
    }).join("");

    const more = evs.length > 3
      ? `<span class="ev" style="border-left-color:transparent;background:transparent;color:var(--muted)">+${evs.length - 3} more</span>`
      : "";

    cells += `<div class="day${out ? " out" : ""}${k === todayKey ? " today" : ""}">
        <span class="daynum">${d.getDate()}</span>${items}${more}
      </div>`;
  }

  mount.innerHTML = `
    <div class="cal-head">
      <button class="btn btn--ghost btn--sm" data-cal="prev">&larr; Prev</button>
      <h3>${MONTH[m]} ${y}</h3>
      <button class="btn btn--ghost btn--sm" data-cal="next">Next &rarr;</button>
    </div>
    <div class="cal">${cells}</div>`;

  mount.querySelector('[data-cal="prev"]').onclick = () => onMonthChange(new Date(y, m - 1, 1));
  mount.querySelector('[data-cal="next"]').onclick = () => onMonthChange(new Date(y, m + 1, 1));
}

function dayKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
