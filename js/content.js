/* Editable site copy.
 *
 * Everything PAL needs to change without a deploy lives in config/site.content.
 * Pages mark their slots with data-cfg / data-cfg-list / data-faq attributes;
 * applyContent() fills them in. Any slot with no saved value is LEFT ALONE, so
 * the hardcoded "TBD" chip stays visible until someone fills it — which is what
 * you want on a page you're about to show to a board.
 */

import { getFirebase, isConfigured } from "./firebase-config.js";

const FS = "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/** Every editable field, grouped for the settings screen. */
export const CONTENT_FIELDS = [
  { group: "Season Dates", fields: [
    { key: "seasonLabel",          label: "Season name",            ph: "2026–27 Season" },
    { key: "registrationOpens",    label: "Registration opens",     ph: "October 1" },
    { key: "registrationDeadline", label: "Registration deadline",  ph: "October 24" },
    { key: "tryoutDates",          label: "Tryout dates",           ph: "November 2 & 3" },
    { key: "teamsAnnounced",       label: "Teams announced",        ph: "November 8" },
    { key: "practicesBegin",       label: "Practices begin",        ph: "November 15" },
    { key: "firstGame",            label: "First game",             ph: "December 6" },
    { key: "seasonEnds",           label: "Season ends",            ph: "Early March" }
  ]},
  { group: "Registration", fields: [
    { key: "fee",             label: "Registration fee",  ph: "$150" },
    { key: "whoCanRegister",  label: "Who can register",  ph: "Mountainside residents, grades 3–8" },
    { key: "paymentInfo",     label: "How to pay",        ph: "Check payable to Mountainside PAL, dropped at…", type: "textarea" },
    { key: "registrationIncludes", label: "What registration includes", type: "list",
      ph: "One item per line" },
    { key: "formsRequired",   label: "Required forms & waivers", type: "list",
      ph: "One item per line" }
  ]},
  { group: "Tryouts", fields: [
    { key: "tryoutLocation", label: "Tryout location", ph: "Deerfield School Gym" },
    { key: "tryoutBring",    label: "What to bring",   ph: "Sneakers, water bottle, reversible shirt" },
    { key: "tryoutNotes",    label: "Anything else",   type: "textarea" }
  ]},
  { group: "Practices & Games", fields: [
    { key: "practiceFrequency", label: "Practices per week", ph: "Two" },
    { key: "practiceLocation",  label: "Practice location",  ph: "Deerfield School Gym" },
    { key: "gameDays",          label: "Games are played on", ph: "Sundays" },
    { key: "arriveBefore",      label: "Arrive before tip-off (minutes)", ph: "30" },
    { key: "travelPhilosophy",  label: "Travel & tournament philosophy", type: "textarea",
      ph: "How far teams travel, whether the program enters outside tournaments…" },
    { key: "divisionsIntro",    label: "How divisions work", type: "textarea",
      ph: "Describe how PAL splits grades into teams." }
  ]},
  { group: "FAQs", fields: [
    { key: "faqRegister", label: "Registration page FAQs", type: "faq" },
    { key: "faqProgram",  label: "Program page FAQs",      type: "faq" }
  ]}
];

export const FIELD_INDEX = Object.fromEntries(
  CONTENT_FIELDS.flatMap(g => g.fields.map(f => [f.key, f]))
);

const esc = s => String(s ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- read / write ---------- */

export async function loadContent() {
  if (!isConfigured) return {};
  try {
    const fb = await getFirebase();
    const { doc, getDoc } = await import(FS);
    const snap = await getDoc(doc(fb.db, "config", "site"));
    return (snap.exists() && snap.data().content) || {};
  } catch (err) {
    console.warn("[content] unavailable:", err.message);
    return {};
  }
}

export async function saveContent(content) {
  const fb = await getFirebase();
  const { doc, setDoc } = await import(FS);
  return setDoc(doc(fb.db, "config", "site"), { content }, { merge: true });
}

/* ---------- render ---------- */

const filled = v => v !== undefined && v !== null &&
  (Array.isArray(v) ? v.length > 0 : String(v).trim() !== "");

/** Fill every marked slot on the page. Unfilled keys keep their placeholder markup. */
export function renderContent(content, root = document) {
  // simple text slots
  for (const el of root.querySelectorAll("[data-cfg]")) {
    const v = content[el.dataset.cfg];
    if (!filled(v)) continue;
    el.classList.remove("tbd");
    el.innerHTML = esc(v).replace(/\n/g, "<br>");
  }

  // bullet lists
  for (const el of root.querySelectorAll("[data-cfg-list]")) {
    const v = content[el.dataset.cfgList];
    if (!filled(v)) continue;
    el.innerHTML = v.map(item => `<li>${esc(item)}</li>`).join("");
  }

  // FAQ accordions
  for (const el of root.querySelectorAll("[data-faq]")) {
    const v = content[el.dataset.faq];
    if (!filled(v)) continue;
    el.innerHTML = v.map(({ q, a }) => `
      <details>
        <summary>${esc(q)}</summary>
        <p>${esc(a).replace(/\n/g, "<br>")}</p>
      </details>`).join("");
  }
}

/** Convenience: load and render in one call. */
export async function applyContent(root = document) {
  const content = await loadContent();
  renderContent(content, root);
  return content;
}
