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
  apiKey:            "REPLACE_ME",
  authDomain:        "REPLACE_ME.firebaseapp.com",
  projectId:         "REPLACE_ME",
  storageBucket:     "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId:             "REPLACE_ME"
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
