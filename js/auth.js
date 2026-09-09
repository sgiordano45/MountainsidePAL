/* Google sign-in + the Phase 2 admin check.
 *
 * PHASE 2: admins are a hardcoded UID list, mirrored in firestore.rules.
 *          The list here only controls what UI is shown — the rules are the
 *          real boundary. Keep the two in sync.
 * PHASE 3: replace both with a lookup against users/{uid}.role.
 */

import { getFirebase, isConfigured } from "./firebase-config.js";

export const ADMIN_UIDS = [
  // Sign in at login.html, copy the UID it prints, paste it here AND in firestore.rules
  "REPLACE_WITH_YOUR_UID"
];

export const adminListReady = !ADMIN_UIDS.some(u => u.startsWith("REPLACE_"));

const AUTH_URL = "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export async function signInWithGoogle() {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase is not configured yet.");
  const { GoogleAuthProvider, signInWithPopup } = await import(AUTH_URL);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const res = await signInWithPopup(fb.auth, provider);
  return res.user;
}

export async function signOutUser() {
  const fb = await getFirebase();
  if (!fb) return;
  const { signOut } = await import(AUTH_URL);
  await signOut(fb.auth);
}

/** Subscribe to auth state. Fires immediately with null when unconfigured. */
export async function onAuthChange(callback) {
  if (!isConfigured) { callback(null); return () => {}; }
  const fb = await getFirebase();
  const { onAuthStateChanged } = await import(AUTH_URL);
  return onAuthStateChanged(fb.auth, callback);
}

export function isAdmin(user) {
  return !!user && ADMIN_UIDS.includes(user.uid);
}

/**
 * Guard an admin page. Renders a sign-in gate into `mountEl` and calls
 * onReady(user) only once an approved admin is signed in.
 */
export async function requireAdmin(mountEl, onReady) {
  if (!isConfigured) {
    mountEl.innerHTML = setupNoticeHTML();
    return;
  }

  const render = (state, user) => {
    if (state === "in") { mountEl.innerHTML = ""; onReady(user); return; }

    mountEl.innerHTML = `
      <div class="auth-gate">
        <h2>${state === "denied" ? "Not authorised" : "Admin sign-in"}</h2>
        <p class="lede" style="margin:0 auto 1.4em">
          ${state === "denied"
            ? `Signed in as <strong>${user?.email || "unknown"}</strong>, but that account isn't on the admin list.`
            : "Sign in with the Google account approved for schedule editing."}
        </p>
        ${state === "denied"
          ? `<p style="font-size:.85rem;color:var(--muted);margin-bottom:1.2em">
               Your UID is <code>${user?.uid || ""}</code> — add it to
               <code>ADMIN_UIDS</code> in <code>js/auth.js</code> and to
               <code>firestore.rules</code>, then publish the rules.
             </p>
             <button class="btn btn--ghost" id="gateOut">Sign out</button>`
          : `<button class="btn btn--primary btn--lg" id="gateIn">Sign in with Google</button>`}
        ${!adminListReady
          ? `<p class="msg msg--warn" style="text-align:left;margin-top:20px">
               <strong>No admin UID configured yet.</strong> Sign in above, copy the UID
               shown, and paste it into <code>js/auth.js</code> and <code>firestore.rules</code>.
             </p>` : ""}
      </div>`;

    const inBtn  = document.getElementById("gateIn");
    const outBtn = document.getElementById("gateOut");
    if (inBtn)  inBtn.onclick  = () => signInWithGoogle().catch(e => alert(e.message));
    if (outBtn) outBtn.onclick = () => signOutUser();
  };

  onAuthChange((user) => {
    if (!user) return render("out", null);
    render(isAdmin(user) ? "in" : "denied", user);
  });
}

export function setupNoticeHTML() {
  return `
    <div class="setup-notice">
      <h3>Firebase isn't connected yet</h3>
      <p>This page needs a Firebase project before it can do anything. Once you have one:</p>
      <ol>
        <li>Enable <strong>Firestore</strong> and <strong>Authentication &rarr; Google</strong>.</li>
        <li>Add <code>sgiordano45.github.io</code> under Authentication &rarr; Settings &rarr; Authorized domains.</li>
        <li>Paste your web config into <code>js/firebase-config.js</code>.</li>
        <li>Sign in at <code>login.html</code>, copy the UID, and paste it into
            <code>js/auth.js</code> and <code>firestore.rules</code>.</li>
        <li>Publish <code>firestore.rules</code>.</li>
      </ol>
    </div>`;
}
