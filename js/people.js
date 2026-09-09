/* Users, roles, coaches and rosters. */

import { getFirebase } from "./firebase-config.js";

const FS = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- users & roles ---------- */

export async function listUsers() {
  const fb = await getFirebase(); if (!fb) return [];
  const { collection, getDocs } = await import(FS);
  const snap = await getDocs(collection(fb.db, "users"));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
    .sort((a, b) => String(a.displayName || a.email).localeCompare(String(b.displayName || b.email)));
}

/** Admin-only. Changing someone to anything but coach clears their team scope. */
export async function setUserRole(uid, role, teamIds = []) {
  const fb = await getFirebase();
  const { doc, updateDoc } = await import(FS);
  return updateDoc(doc(fb.db, "users", uid), {
    role,
    teamIds: role === "coach" ? teamIds : []
  });
}

/* ---------- coaches (the public-facing directory) ---------- */

export async function listCoaches() {
  const fb = await getFirebase(); if (!fb) return {};
  const { collection, getDocs } = await import(FS);
  const snap = await getDocs(collection(fb.db, "coaches"));
  return Object.fromEntries(snap.docs.map(d => [d.id, { uid: d.id, ...d.data() }]));
}

export async function saveCoach(uid, data) {
  const fb = await getFirebase();
  const { doc, setDoc } = await import(FS);
  return setDoc(doc(fb.db, "coaches", uid), data, { merge: true });
}

export async function removeCoach(uid) {
  const fb = await getFirebase();
  const { doc, deleteDoc } = await import(FS);
  return deleteDoc(doc(fb.db, "coaches", uid));
}

/** Set a team's coach list. Admin-only per the rules. */
export async function setTeamCoaches(teamId, coachUids) {
  const fb = await getFirebase();
  const { doc, updateDoc } = await import(FS);
  return updateDoc(doc(fb.db, "teams", teamId), { coachUids });
}

/* ---------- rosters ---------- */

export async function listRoster(teamId) {
  const fb = await getFirebase(); if (!fb) return [];
  const { collection, getDocs } = await import(FS);
  const snap = await getDocs(collection(fb.db, "teams", teamId, "roster"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(byJersey);
}

const byJersey = (a, b) =>
  (a.jersey ?? 999) - (b.jersey ?? 999) ||
  String(a.firstName).localeCompare(String(b.firstName));

export async function savePlayer(teamId, playerId, data) {
  const fb = await getFirebase();
  const { collection, doc, addDoc, setDoc } = await import(FS);
  const payload = {
    firstName: data.firstName || "",
    lastName:  data.lastName  || "",
    // Stored separately so public-facing views can show "Jake M." without ever
    // needing the full surname client-side.
    lastInitial: (data.lastName || "").trim().charAt(0).toUpperCase(),
    jersey: data.jersey === "" || data.jersey === null ? null : Number(data.jersey)
  };
  if (playerId) { await setDoc(doc(fb.db, "teams", teamId, "roster", playerId), payload, { merge: true }); return playerId; }
  const ref = await addDoc(collection(fb.db, "teams", teamId, "roster"), payload);
  return ref.id;
}

export async function deletePlayer(teamId, playerId) {
  const fb = await getFirebase();
  const { doc, deleteDoc } = await import(FS);
  return deleteDoc(doc(fb.db, "teams", teamId, "roster", playerId));
}

/** Bulk-add from pasted "number, first last" lines — one player per line. */
export function parseRosterPaste(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    // "12 Jake Miller" | "12, Jake Miller" | "Jake Miller"
    const m = line.match(/^(\d{1,3})[\s,.\-]+(.*)$/);
    const jersey = m ? Number(m[1]) : null;
    const name = (m ? m[2] : line).replace(/,/g, " ").trim();
    const parts = name.split(/\s+/);
    return {
      jersey,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ")
    };
  }).filter(p => p.firstName);
}
