/* Authentication, user profiles and roles.
 *
 * PHASE 3 model:
 *   users/{uid} = { role: 'admin' | 'coach' | 'parent', teamIds: [], displayName, email }
 *
 * A user doc is created automatically on first sign-in with role 'parent'.
 * Rules let a user create and update their OWN doc but never change their own
 * role or teamIds — only an admin can do that, from admin/users.html.
 *
 * BOOTSTRAP_ADMINS solves the chicken-and-egg: with an empty users collection
 * nobody could grant the first role. These UIDs are admins unconditionally, in
 * both this file and firestore.rules. Keep the two lists identical. Once real
 * admins exist in the users collection you can trim this to just yourself.
 */

import { getFirebase, isConfigured } from "./firebase-config.js";

export const BOOTSTRAP_ADMINS = [
  "zNT9XYRybMQEabbxXFShRIBSZHy2"
];

const AUTH_URL = "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
const FS_URL   = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------- sign in / out ---------------- */

export async function signInWithGoogle() {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase is not configured yet.");
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import(AUTH_URL);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const POPUP_FAILED = [
    "auth/popup-blocked", "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"
  ];

  try {
    const res = await signInWithPopup(fb.auth, provider);
    return res.user;
  } catch (err) {
    if (POPUP_FAILED.includes(err.code)) {
      await signInWithRedirect(fb.auth, provider);
      return null;
    }
    throw err;
  }
}

export async function signOutUser() {
  const fb = await getFirebase();
  if (!fb) return;
  const { signOut } = await import(AUTH_URL);
  await signOut(fb.auth);
}

export async function completeRedirectSignIn() {
  if (!isConfigured) return null;
  try {
    const fb = await getFirebase();
    const { getRedirectResult } = await import(AUTH_URL);
    const res = await getRedirectResult(fb.auth);
    return res?.user || null;
  } catch (err) {
    return { error: err };
  }
}

export async function onAuthChange(callback) {
  if (!isConfigured) { callback(null); return () => {}; }
  const fb = await getFirebase();
  const { onAuthStateChanged } = await import(AUTH_URL);
  return onAuthStateChanged(fb.auth, callback);
}

/* ---------------- profiles & roles ---------------- */

/**
 * Read the signed-in user's profile, creating it on first sign-in.
 * Never throws — a missing or unreadable profile degrades to 'parent'.
 */
export async function loadProfile(user) {
  if (!user) return null;
  const fallback = {
    uid: user.uid, role: "parent", teamIds: [],
    displayName: user.displayName || "", email: user.email || ""
  };
  try {
    const fb = await getFirebase();
    const { doc, getDoc, setDoc, serverTimestamp } = await import(FS_URL);
    const ref  = doc(fb.db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // Self-registration: role is always 'parent'; rules reject anything else.
      const fresh = {
        role: "parent", teamIds: [],
        displayName: user.displayName || "", email: user.email || "",
        createdAt: serverTimestamp()
      };
      await setDoc(ref, fresh);
      return { uid: user.uid, ...fresh };
    }
    return { uid: user.uid, ...snap.data() };
  } catch (err) {
    console.warn("[auth] profile unavailable:", err.message);
    return fallback;
  }
}

export function isAdmin(user, profile) {
  if (!user) return false;
  if (BOOTSTRAP_ADMINS.includes(user.uid)) return true;
  return profile?.role === "admin";
}

export function isCoach(user, profile) {
  return !!user && profile?.role === "coach";
}

export function coachTeams(profile) {
  return Array.isArray(profile?.teamIds) ? profile.teamIds : [];
}

/** Can this person write to content scoped to `teamId`? */
export function canEditTeam(user, profile, teamId) {
  if (isAdmin(user, profile)) return true;
  if (!isCoach(user, profile)) return false;
  return coachTeams(profile).includes(teamId);
}

/** Teams this person may edit — null means "all of them". */
export function editableTeams(user, profile) {
  return isAdmin(user, profile) ? null : coachTeams(profile);
}

/* ---------------- page guards ---------------- */

/**
 * Guard a page. `roles` is ['admin'] or ['admin','coach'].
 * Calls onReady({ user, profile }) once someone with an allowed role is in.
 */
export async function requireRole(mountEl, roles, onReady) {
  if (!isConfigured) { mountEl.innerHTML = setupNoticeHTML(); return; }

  const allowed = (user, profile) =>
    (roles.includes("admin") && isAdmin(user, profile)) ||
    (roles.includes("coach") && isCoach(user, profile));

  onAuthChange(async (user) => {
    if (!user) return renderGate(mountEl, "out", null, roles);
    const profile = await loadProfile(user);
    if (allowed(user, profile)) { mountEl.innerHTML = ""; onReady({ user, profile }); return; }
    renderGate(mountEl, "denied", { user, profile }, roles);
  });
}

/** Admin-only shorthand. */
export function requireAdmin(mountEl, onReady) {
  return requireRole(mountEl, ["admin"], ({ user, profile }) => onReady(user, profile));
}

function renderGate(mountEl, state, ctx, roles) {
  const need = roles.includes("coach") ? "a coach or administrator" : "an administrator";

  mountEl.innerHTML = `
    <div class="auth-gate">
      <h2>${state === "denied" ? "Not authorised" : "Sign in"}</h2>
      <p class="lede" style="margin:0 auto 1.4em">
        ${state === "denied"
          ? `Signed in as <strong>${ctx?.user?.email || "unknown"}</strong>, which is
             registered as <strong>${ctx?.profile?.role || "parent"}</strong>.
             This page needs ${need}.`
          : `This page is for ${need}.`}
      </p>
      ${state === "denied"
        ? `<p style="font-size:.85rem;color:var(--muted);margin-bottom:1.2em">
             Ask an administrator to grant you access. Your UID is
             <code>${ctx?.user?.uid || ""}</code>.
           </p>
           <button class="btn btn--ghost" id="gateOut">Sign out</button>`
        : `<button class="btn btn--primary btn--lg" id="gateIn">Sign in with Google</button>
           <div id="gateErr" style="margin-top:18px"></div>`}
    </div>`;

  const inBtn = document.getElementById("gateIn");
  if (inBtn) inBtn.onclick = (e) => {
    e.target.disabled = true;
    signInWithGoogle()
      .catch(err => {
        const box = document.getElementById("gateErr");
        if (box) box.innerHTML =
          `<div class="msg msg--err" style="text-align:left">${explainAuthError(err)}</div>`;
        console.error("[auth]", err);
      })
      .finally(() => { e.target.disabled = false; });
  };
  const outBtn = document.getElementById("gateOut");
  if (outBtn) outBtn.onclick = () => signOutUser();
}

/* ---------------- error help ---------------- */

/** Every one of these is a console setting, not a code bug. Say which. */
export function explainAuthError(err) {
  const code = err?.code || "";
  const host = location.hostname;

  switch (code) {
    case "auth/unauthorized-domain":
      return `<strong>${host} isn't an authorised domain.</strong>
        Firebase console &rarr; <em>Authentication &rarr; Settings &rarr; Authorized domains</em>,
        add <code>${host}</code>. Takes a minute or two to take effect.`;
    case "auth/operation-not-allowed":
      return `<strong>Google sign-in isn't enabled.</strong>
        <em>Authentication &rarr; Sign-in method</em>, enable Google, set a support email, save.`;
    case "auth/configuration-not-found":
      return `<strong>No auth configuration found.</strong> Open <em>Authentication</em>
        in the console, click Get started, then enable Google.`;
    case "auth/popup-blocked":
      return `<strong>The sign-in popup was blocked.</strong> Allow popups for this site —
        it should fall back to a full-page redirect automatically.`;
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return `Sign-in was cancelled before it finished. Try again.`;
    case "auth/invalid-api-key":
      return `<strong>The API key in <code>js/firebase-config.js</code> isn't valid.</strong>
        Re-copy the web config from <em>Project settings &rarr; Your apps</em>.`;
    case "auth/network-request-failed":
      return `Network request failed — check the connection and try again.`;
    default:
      return `Sign-in failed${code ? ` (<code>${code}</code>)` : ""}: ${
        err?.message || "unknown error"}`;
  }
}

export function setupNoticeHTML() {
  return `
    <div class="setup-notice">
      <h3>Firebase isn't connected yet</h3>
      <p>This page needs a Firebase project before it can do anything:</p>
      <ol>
        <li>Enable <strong>Firestore</strong> and <strong>Authentication &rarr; Google</strong>.</li>
        <li>Add this site's domain under Authentication &rarr; Settings &rarr; Authorized domains.</li>
        <li>Paste your web config into <code>js/firebase-config.js</code>.</li>
        <li>Publish <code>firestore.rules</code>.</li>
      </ol>
    </div>`;
}
