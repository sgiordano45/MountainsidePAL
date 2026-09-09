/* Tiny CSV/TSV parser and the league-schedule row mapper.
 *
 * Handles quoted fields, embedded commas and newlines, and \r\n.
 * No dependency, because a schedule importer is not worth a build step.
 */

/** Detect the delimiter from the header line. */
export function sniffDelimiter(text) {
  const line = text.split(/\r?\n/).find(l => l.trim()) || "";
  const counts = { "\t": 0, ",": 0, ";": 0, "|": 0 };
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ",";
}

/** Parse delimited text into an array of string arrays. */
export function parseDelimited(text, delim) {
  const d = delim || sniffDelimiter(text);
  const rows = [];
  let row = [], field = "", inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === d) {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  return rows
    .map(r => r.map(c => c.trim()))
    .filter(r => r.some(c => c !== ""));
}

/* ---- column detection ---- */

const ALIASES = {
  date:     ["date", "game date", "gamedate", "day", "when"],
  time:     ["time", "start", "start time", "starttime", "tip", "tipoff", "tip off"],
  opponent: ["opponent", "opp", "vs", "versus", "against", "team", "opposing team"],
  location: ["location", "loc", "site", "gym", "venue", "place", "where", "facility"],
  team:     ["our team", "grade", "division", "our grade", "home team", "pal team"],
  homeaway: ["home/away", "home away", "h/a", "ha", "homeaway", "site type"]
};

const norm = s => String(s || "").toLowerCase().replace(/[^a-z/ ]/g, "").trim();

/** Guess which column index holds each field. Returns {field: index|null}. */
export function detectColumns(header) {
  const out = {};
  const cells = header.map(norm);
  for (const [field, names] of Object.entries(ALIASES)) {
    let idx = cells.findIndex(c => names.includes(c));
    if (idx === -1) idx = cells.findIndex(c => c && names.some(n => c.includes(n)));
    out[field] = idx === -1 ? null : idx;
  }
  return out;
}

/** Does row 0 look like a header rather than data? */
export function looksLikeHeader(row) {
  const cells = row.map(norm);
  const known = Object.values(ALIASES).flat();
  return cells.filter(c => known.some(n => c === n || c.includes(n))).length >= 2;
}

/* ---- date & time parsing ---- */

const MONTHS = {
  jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
  jul:6, aug:7, sep:8, oct:9, nov:10, dec:11
};

/**
 * Parse a date string into local Y/M/D parts. US convention (M/D) — the league
 * is in New Jersey. Returns null if it can't be read with confidence.
 */
export function parseDateParts(value, defaultYear) {
  const s = String(value || "").trim();
  if (!s) return null;

  // 2027-01-15
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return { y: +m[1], m: +m[2] - 1, d: +m[3] };

  // 1/15/2027, 1-15-27, 1/15
  m = s.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  if (m) {
    let y = m[3] ? +m[3] : defaultYear;
    if (m[3] && m[3].length === 2) y = 2000 + +m[3];
    return { y, m: +m[1] - 1, d: +m[2] };
  }

  // Jan 15 2027 / January 15, 2027 / Sat Jan 15
  m = s.match(/([a-z]{3,})\.?\s+(\d{1,2})(?:\w*)?(?:,?\s*(\d{4}))?/i);
  if (m && norm(m[1]).slice(0, 3) in MONTHS) {
    return { y: m[3] ? +m[3] : defaultYear, m: MONTHS[norm(m[1]).slice(0, 3)], d: +m[2] };
  }
  return null;
}

/** "6:30 PM", "6:30pm", "18:30", "630pm" -> {h, min} in 24h. */
export function parseTimeParts(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[:.]?(\d{2})?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  const ap = m[3] ? m[3].replace(/\./g, "") : null;
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, min };
}

/** Build a real local Date from parsed parts — never `new Date(string)`. */
export function toLocalDate(dateParts, timeParts) {
  if (!dateParts) return null;
  return new Date(
    dateParts.y, dateParts.m, dateParts.d,
    timeParts ? timeParts.h : 0,
    timeParts ? timeParts.min : 0, 0, 0
  );
}

/** Read a home/away cell. Returns true, false, or null when unknown. */
export function parseHomeAway(value) {
  // Normalise punctuation-only markers first: "@" is the common shorthand for away,
  // and norm() would strip it to an empty string.
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "@") return false;

  const s = norm(raw);
  if (!s) return null;
  if (/^(h|home)$/.test(s)) return true;
  if (/^(a|away|at|road|v|vs)$/.test(s)) return false;
  return null;
}
