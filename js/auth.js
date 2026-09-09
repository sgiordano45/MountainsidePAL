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

/**
 * Sign in with Google.
 *
 * Popup first, because it keeps the user on the page. Browsers that block the
 * popup (Safari with strict settings, some in-app browsers, iOS) fall back to a
 * full-page redirect, which always works but reloads the page — completeRedirectSignIn()
 * picks the result back up on the way in.
 */
export async function signInWithGoogle() {
  const fb = await getFirebase();
  if (!fb) throw new Error("Firebase is not configured yet.");
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import(AUTH_URL);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const POPUP_FAILED = [
    "auth/popup-blocked",
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
    "auth/web-storage-unsupported"
  ];

  try {
    const res = await signInWithPopup(fb.auth, provider);
    return res.user;
  } catch (err) {
    if (POPUP_FAILED.includes(err.code)) {
      await signInWithRedirect(fb.auth, provider);
      return null;                      // page navigates away
    }
    throw err;
  }
}

/** Call once on page load to collect a redirect-flow result. */
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

/**
 * Turn a Firebase auth error into something actionable. Every one of these is a
 * console setting, not a code bug — which is why the raw message is unhelpful.
 */
export function explainAuthError(err) {
  const code = err?.code || "";
  const host = location.hostname;

  switch (code) {
    case "auth/unauthorized-domain":
      return `<strong>${host} isn't an authorised domain.</strong>
        In the Firebase console go to <em>Authentication &rarr; Settings &rarr;
        Authorized domains</em> and add <code>${host}</code>. This is the usual
        cause on GitHub Pages, and it takes a minute or two to take effect.`;

    case "auth/operation-not-allowed":
      return `<strong>Google sign-in isn't enabled for this project.</strong>
        Go to <em>Authentication &rarr; Sign-in method</em>, enable
        <em>Google</em>, set a support email, and save.`;

    case "auth/configuration-not-found":
      return `<strong>No auth configuration found.</strong> Authentication hasn't
        been set up on this Firebase project yet — open <em>Authentication</em> in
        the console and click Get started, then enable Google.`;

    case "auth/popup-blocked":
      return `<strong>The sign-in popup was blocked.</strong> Allow popups for this
        site and try again — it should switch to a full-page redirect automatically.`;

    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return `Sign-in was cancelled before it finished. Try again.`;

    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return `<strong>The API key in <code>js/firebase-config.js</code> isn't valid
        for this project.</strong> Re-copy the web config from
        <em>Project settings &rarr; Your apps</em>.`;

    case "auth/network-request-failed":
      return `Network request failed — check the connection and try again.`;

    default:
      return `Sign-in failed${code ? ` (<code>${code}</code>)` : ""}: ${
        err?.message || "unknown error"}`;
  }
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
          : `<button class="btn btn--primary btn--lg" id="gateIn">Sign in with Google</button>
             <div id="gateErr" style="margin-top:18px"></div>`}
        ${!adminListReady
          ? `<p class="msg msg--warn" style="text-align:left;margin-top:20px">
               <strong>No admin UID configured yet.</strong> Sign in above, copy the UID
               shown, and paste it into <code>js/auth.js</code> and <code>firestore.rules</code>.
             </p>` : ""}
      </div>`;

    const inBtn  = document.getElementById("gateIn");
    const outBtn = document.getElementById("gateOut");
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
