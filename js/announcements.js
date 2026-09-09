/* Announcements + the site-wide alert banner. */

import { getFirebase } from "./firebase-config.js";

const FS = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function listAnnouncements() {
  const fb = await getFirebase(); if (!fb) return [];
  const { collection, getDocs } = await import(FS);
  const snap = await getDocs(collection(fb.db, "announcements"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => ts(b.publishedAt) - ts(a.publishedAt));
}

const ts = v => (v && typeof v.toDate === "function" ? v.toDate().getTime() : 0);

export async function createAnnouncement(data, user) {
  const fb = await getFirebase();
  const { collection, addDoc, Timestamp } = await import(FS);
  return addDoc(collection(fb.db, "announcements"), {
    ...clean(data, Timestamp),
    publishedAt: Timestamp.now(),
    authorUid: user?.uid || null,
    authorName: user?.displayName || user?.email || ""
  });
}

export async function updateAnnouncement(id, data) {
  const fb = await getFirebase();
  const { doc, updateDoc, Timestamp } = await import(FS);
  return updateDoc(doc(fb.db, "announcements", id), clean(data, Timestamp));
}

export async function deleteAnnouncement(id) {
  const fb = await getFirebase();
  const { doc, deleteDoc } = await import(FS);
  return deleteDoc(doc(fb.db, "announcements", id));
}

function clean(d, Timestamp) {
  const out = {
    title: d.title, body: d.body,
    level: d.level === "urgent" ? "urgent" : "normal",
    teamId: d.teamId, pinned: !!d.pinned
  };
  out.expiresAt = d.expires instanceof Date ? Timestamp.fromDate(d.expires) : null;
  return out;
}

/* ---- alert banner, stored on config/site ---- */

export async function getSiteConfig() {
  const fb = await getFirebase(); if (!fb) return null;
  const { doc, getDoc } = await import(FS);
  const snap = await getDoc(doc(fb.db, "config", "site"));
  return snap.exists() ? snap.data() : null;
}

export async function setAlertBanner(banner) {
  const fb = await getFirebase();
  const { doc, setDoc, Timestamp } = await import(FS);
  const payload = {
    active: !!banner.active,
    level: banner.level === "urgent" ? "urgent" : "normal",
    text: banner.text || "",
    link: banner.link || "",
    expiresAt: banner.expires instanceof Date ? Timestamp.fromDate(banner.expires) : null
  };
  return setDoc(doc(fb.db, "config", "site"), { alertBanner: payload }, { merge: true });
}
