/* Firestore data layer for teams, locations and events. */

import { getFirebase } from "./firebase-config.js";
import { parseLocal, formatTime, formatDate } from "./dates.js";

const FS = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const SEASON_ID = "2026-27";

export const EVENT_TYPES = [
  { id: "game",       label: "Game" },
  { id: "practice",   label: "Practice" },
  { id: "tryout",     label: "Tryout" },
  { id: "tournament", label: "Tournament" },
  { id: "deadline",   label: "Deadline" }
];

export const GRADES = [3, 4, 5, 6, 7, 8];
export const teamIdForGrade = g => `grade-${g}`;
export const gradeLabel     = g => `${g}${{3:"rd",4:"th",5:"th",6:"th",7:"th",8:"th"}[g]} Grade`;

/* ---------- reads ---------- */

export async function listTeams() {
  const fb = await getFirebase(); if (!fb) return [];
  const { collection, getDocs, query, orderBy } = await import(FS);
  const snap = await getDocs(query(collection(fb.db, "teams"), orderBy("grade")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listLocations() {
  const fb = await getFirebase(); if (!fb) return [];
  const { collection, getDocs, query, orderBy } = await import(FS);
  const snap = await getDocs(query(collection(fb.db, "locations"), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** All events for the season, sorted by start. Filtering happens client-side —
 *  a youth league season is a few hundred rows, not a dataset. */
export async function listEvents() {
  const fb = await getFirebase(); if (!fb) return [];
  const { collection, getDocs, query, where, orderBy } = await import(FS);
  const snap = await getDocs(query(
    collection(fb.db, "events"),
    where("seasonId", "==", SEASON_ID),
    orderBy("startAt")
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ---------- writes ---------- */

export async function createEvent(data, user) {
  const fb = await getFirebase();
  const { collection, addDoc, Timestamp } = await import(FS);
  return addDoc(collection(fb.db, "events"), stamp(data, user, Timestamp));
}

export async function updateEvent(id, data, user) {
  const fb = await getFirebase();
  const { doc, updateDoc, Timestamp } = await import(FS);
  return updateDoc(doc(fb.db, "events", id), stamp(data, user, Timestamp, true));
}

export async function deleteEvent(id) {
  const fb = await getFirebase();
  const { doc, deleteDoc } = await import(FS);
  return deleteDoc(doc(fb.db, "events", id));
}

/** Write many events at once. Firestore batches cap at 500 writes. */
export async function bulkCreateEvents(rows, user) {
  const fb = await getFirebase();
  const { collection, doc, writeBatch, Timestamp } = await import(FS);
  let written = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const batch = writeBatch(fb.db);
    for (const r of rows.slice(i, i + 400)) {
      batch.set(doc(collection(fb.db, "events")), stamp(r, user, Timestamp));
    }
    await batch.commit();
    written += Math.min(400, rows.length - i);
  }
  return written;
}

function stamp(data, user, Timestamp, isUpdate = false) {
  const out = { ...data, updatedAt: Timestamp.now(), updatedBy: user?.uid || null };
  if (!isUpdate) {
    out.seasonId = out.seasonId || SEASON_ID;
    out.status   = out.status   || "scheduled";
    out.source   = out.source   || "manual";
  }
  if (out.start instanceof Date) { out.startAt = Timestamp.fromDate(out.start); delete out.start; }
  return out;
}

/* ---------- seeding ---------- */

/** Create the six teams and the config/site doc if they don't exist. */
export async function seedSeason(user) {
  const fb = await getFirebase();
  const { doc, getDoc, writeBatch } = await import(FS);
  const batch = writeBatch(fb.db);
  let created = 0;

  for (const g of GRADES) {
    const id = teamIdForGrade(g);
    if (!(await getDoc(doc(fb.db, "teams", id))).exists()) {
      batch.set(doc(fb.db, "teams", id), {
        name: gradeLabel(g), grade: g, division: "",
        seasonId: SEASON_ID, coachUids: [], photoUrl: "", active: true
      });
      created++;
    }
  }

  if (!(await getDoc(doc(fb.db, "config", "site"))).exists()) {
    batch.set(doc(fb.db, "config", "site"), {
      seasonId: SEASON_ID, seasonLabel: "2026–27 Season", gradesServed: "3rd–8th",
      alertBanner: { active: false, level: "normal", text: "", link: "" }
    });
    created++;
  }

  await batch.commit();
  return created;
}

export async function saveLocation(id, data) {
  const fb = await getFirebase();
  const { doc, setDoc, collection, addDoc } = await import(FS);
  if (id) { await setDoc(doc(fb.db, "locations", id), data, { merge: true }); return id; }
  const ref = await addDoc(collection(fb.db, "locations"), data);
  return ref.id;
}

/* ---------- shared render helpers ---------- */

export function mapsUrl(loc) {
  if (!loc) return null;
  if (loc.mapsUrl) return loc.mapsUrl;
  const q = [loc.name, loc.address].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

export function eventTitle(ev, teamsById) {
  const team = teamsById?.[ev.teamId];
  const who  = ev.teamId === "all" ? "All Teams" : (team?.name || ev.teamId);
  if (ev.type === "game" || ev.type === "tournament") {
    const prep = ev.isHome === false ? "at" : "vs";
    return ev.opponent ? `${who} ${prep} ${ev.opponent}` : `${who} — ${ev.type}`;
  }
  if (ev.type === "practice") return `${who} Practice`;
  if (ev.type === "tryout")   return `${who} Tryouts`;
  return ev.notes ? `${who} — ${ev.notes}` : who;
}

/**
 * Group events into [{key, date, events}] by calendar day, sorted chronologically —
 * days ascending, and events within each day by start time.
 *
 * Don't rely on the caller having sorted: the importer writes rows in file order
 * and any path that skips Firestore's orderBy would otherwise render a jumbled
 * schedule, which looks broken rather than merely unsorted.
 */
export function groupByDay(events) {
  const out = new Map();
  for (const ev of events) {
    const d = parseLocal(ev.startAt);
    if (!d) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!out.has(key)) {
      out.set(key, {
        key,
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        events: []
      });
    }
    out.get(key).events.push(ev);
  }

  const groups = [...out.values()].sort((a, b) => a.date - b.date);
  for (const g of groups) {
    g.events.sort((a, b) => {
      const da = parseLocal(a.startAt), db = parseLocal(b.startAt);
      return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    });
  }
  return groups;
}

export { formatTime, formatDate, parseLocal };
