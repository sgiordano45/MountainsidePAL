/* Firebase bootstrap.
 *
 * Replace the placeholder values below with your project's web config
 * (Firebase console -> Project settings -> Your apps -> Web app).
 *
 * These values are NOT secret. They are meant to ship in the browser.
 * Firestore security rules are what protect your data, not this file.
 *
 * Until real values are in, `isConfigured` stays false and every page
 * quietly skips its dynamic sections instead of throwing.
 */

export const firebaseConfig = {
    apiKey: "AIzaSyAYvt_SdFg_r9MGfC-nZa6LHJNI8rSQ-Ss",
    authDomain: "mountainsidepal-travel.firebaseapp.com",
    projectId: "mountainsidepal-travel",
    storageBucket: "mountainsidepal-travel.firebasestorage.app",
    messagingSenderId: "601992189567",
    appId: "1:601992189567:web:3ea84767c9712db507d14a"
};

export const isConfigured = !Object.values(firebaseConfig).some(
  v => typeof v === "string" && v.includes("REPLACE_ME")
);

let _app = null, _db = null, _auth = null;

/** Lazily initialise Firebase. Returns null when not yet configured. */
export async function getFirebase() {
  if (!isConfigured) return null;
  if (_app) return { app: _app, db: _db, auth: _auth };

  const [{ initializeApp }, { getFirestore }, { getAuth }] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js")
  ]);

  _app  = initializeApp(firebaseConfig);
  _db   = getFirestore(_app);
  _auth = getAuth(_app);
  return { app: _app, db: _db, auth: _auth };
}
