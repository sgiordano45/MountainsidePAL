/* Shared admin chrome + small helpers. */

import { signOutUser } from "./auth.js";

export const ADMIN_NAV = [
  { href: "index.html",         label: "Dashboard" },
  { href: "events.html",        label: "Schedule" },
  { href: "import.html",        label: "Import" },
  { href: "announcements.html", label: "Announcements" },
  { href: "teams.html",         label: "Teams & Rosters" },
  { href: "users.html",         label: "People",   adminOnly: true },
  { href: "settings.html",      label: "Content",  adminOnly: true }
];

export const esc = s => String(s ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function renderAdminBar(mount, user, currentHref, profile) {
  const admin = !!profile?.isAdmin;
  const links = ADMIN_NAV
    .filter(n => admin || !n.adminOnly)
    .map(n => `<a href="./${n.href}"${n.href === currentHref ? ' aria-current="page"' : ""}>${n.label}</a>`)
    .join("");

  const role = profile?.role
    ? ` · ${profile.role === "admin" ? "Administrator" : profile.role === "coach" ? "Coach" : profile.role}`
    : "";

  mount.innerHTML = `
    <div class="admin-bar">
      <div class="wrap">
        <span class="who">${esc(user.displayName || user.email)}${esc(role)}</span>
        ${links}
        <a href="../index.html">View site</a>
        <button class="btn btn--ghost btn--sm" id="adminOut">Sign out</button>
      </div>
    </div>`;
  document.getElementById("adminOut").onclick = () => signOutUser();
}

/** Flash a message into an element. */
export function say(el, text, kind = "ok") {
  el.innerHTML = `<div class="msg msg--${kind}">${text}</div>`;
  if (kind === "ok") setTimeout(() => { if (el.firstChild) el.innerHTML = ""; }, 6000);
}

/** <input type="date"> value from a Date, in local time. */
export function dateInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function timeInputValue(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
/** Combine the two inputs into a real local Date. Never parses a string as UTC. */
export function localDateFrom(dateStr, timeStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mi] = (timeStr || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, h || 0, mi || 0, 0, 0);
}
