# Mountainside PAL Basketball — Site Plan

**Stack:** static HTML/CSS/vanilla JS (ES modules, no build step) on GitHub Pages, Firebase (Firestore + Auth) as the backend.
**Repo:** `sgiordano45/MountainsidePAL`, Pages served from `main` at root → `https://sgiordano45.github.io/MountainsidePAL/`
**Grades:** 3rd–8th. One team per grade, selected by tryout.
**Status:** Stephen is *building*, not running the program. This is a proposal to show PAL, so it needs to demo well with realistic seed data.

## Decisions locked in

| Area | Decision |
|---|---|
| Registration | Site hosts all the info; button links out to the existing Google Form. No PII or payments on our side. |
| Google Form | `https://docs.google.com/forms/d/e/1FAIpQLSe-KBrx3TRDZA4Z8tgt1Him2eN_BMvPDe7qXtFdd307UYub0Q/viewform` — one form, all grades. |
| Rosters | Login-gated. **Any** Google sign-in can view — no account provisioning. Keeps kids' names out of search engines at zero admin cost. |
| Schedule source of truth | Firestore, edited through an admin page. League produces the game schedule; we display it. |
| Admin | Role-based: `admin` (you, full access) + `coach` (scoped to their own team). |
| Domain | None yet. Lives on the GitHub Pages project URL until PAL adopts it. |
| Branding | Mountainside PAL green/white, bulldog mark. |

---

## 1. Pages

### Public (no login)

| File | Purpose |
|---|---|
| `index.html` | Home. Program blurb, grades served, PAL info, alert banner, next 5 events, latest 3 announcements, three big buttons: **Register / Schedule / Teams**. |
| `register.html` | Deadlines, fees, what registration includes, required forms & waivers, tryout dates, CTA to the Google Form. |
| `program.html` | Grade divisions, tryout process & team selection, season dates, practice & game expectations, travel/tournament philosophy, FAQ accordion. |
| `schedule.html` | Master schedule. Filters: team, event type, date range. **List ⇄ Calendar toggle** in one page (see §5). |
| `teams.html` | Six team cards, 3rd → 8th grade. |
| `team.html?id=grade-5` | **One template**, not six files. Team header, coaches, that team's schedule, team announcements, roster *(gated)*, photo slot. |
| `coaches.html` | Staff directory — name, team, mailto button, optional bio/photo. |
| `announcements.html` | Full archive, newest first, filterable by team. |
| `login.html` | Google sign-in. Returns you to wherever you came from. |
| `404.html` | Friendly fallback. |

### Admin (`/admin/`, login + role required)

| File | Purpose |
|---|---|
| `admin/index.html` | Dashboard — what needs attention, quick links. |
| `admin/events.html` | Add/edit/cancel games, practices, tryouts, tournaments, deadlines. The page you'll live in. |
| `admin/import.html` | Paste the league's schedule → preview → commit. See §4. |
| `admin/announcements.html` | Post/expire announcements, toggle the site-wide alert banner. |
| `admin/teams.html` | Assign coaches, edit rosters. |
| `admin/users.html` | **Admin only.** Grant coach/admin roles, scope coaches to teams. |
| `admin/settings.html` | Season dates, Google Form URL, fees, deadlines — everything most sites hardcode. |

### Shared

```
css/styles.css          single stylesheet, CSS custom properties, dark mode
js/firebase-config.js   init; exports { app, db, auth }
js/auth.js              onAuthChange wrapper, role lookup, requireRole() guard
js/nav.js               header/footer/nav injection + alert banner
js/nav-config.js        nav structure in one place
js/dates.js             ET-safe parsing/formatting (see §7)
js/events.js            event queries + shared render helpers
js/announcements.js     announcement queries + render
js/calendar.js          month-grid renderer
assets/                 pal-logo.png, team photos, favicon
```

**Drop the PAL logo into `assets/` when you get it** — ideally a transparent PNG at 512px+, and an SVG if they have one.

---

## 2. Branding

Green/white, bulldog mark. Starting tokens — I'll sample exact values off the logo file once you have it:

```css
:root {
  --pal-green:        #1C4F2E;   /* primary — header, buttons, headings */
  --pal-green-dark:   #123520;   /* hover, footer */
  --pal-green-light:  #2E7D4F;   /* accents, badges */
  --pal-white:        #FFFFFF;
  --ink:              #1A1A1A;
  --muted:            #5C6660;
  --surface:          #F5F7F5;   /* page background */
  --line:             #DDE3DE;
  --alert:            #C1272D;   /* urgent announcements / cancellations ONLY */
}
```

Red is reserved for cancellations and urgent alerts so it means something when it appears. (The red/black on the Rutgers flyer is Rutgers' branding, not PAL's — not carrying that over.)

---

## 3. Firestore data model

```
config/site
  seasonId, seasonLabel, gradesServed
  registrationUrl, registrationDeadline, fees[], registrationIncludes[]
  formsRequired[{label,url}]
  tryoutInfo { dates[], location, whatToBring, notes }
  alertBanner { active, level, text, link, expiresAt }

seasons/{seasonId}                 e.g. "2026-27"
  label, startDate, endDate, keyDates[{label,date}]

teams/{teamId}                     "grade-3" … "grade-8"
  name, grade, division, seasonId, coachUids[], photoUrl, active

teams/{teamId}/roster/{playerId}   ← the only protected collection
  firstName, lastName, lastInitial, jersey

events/{eventId}
  type: game | practice | tryout | tournament | deadline
  teamId: "<teamId>" | "all"
  seasonId
  startAt (Timestamp), endAt, allDay
  opponent, isHome
  locationId  → locations/{id}
  notes
  status: scheduled | cancelled | postponed
  source: manual | import
  updatedAt, updatedBy

locations/{locationId}
  name, address, mapsUrl, notes        ← type the gym address once

announcements/{id}
  title, body, level: urgent | normal
  teamId: "all" | "<teamId>"
  publishedAt, expiresAt, authorUid, pinned

coaches/{uid}
  displayName, email, phone, teamIds[], bio, photoUrl, showEmail

users/{uid}
  role: admin | coach
  displayName, email, teamIds[]
```

**`division` stays on the team doc even though it's one team per grade today.** Costs nothing now; if PAL ever splits boys/girls or adds a B team, you're not re-keying every event.

**Why `locations` is separate:** you'd otherwise retype "Deerfield School Gym, 302 Central Ave" a few hundred times, and one typo breaks the Maps link.

**Why `teamId: "all"`:** one row fans out to the whole program — a snow cancellation, a registration deadline — instead of six.

---

## 4. Auth & roles

Google sign-in only. No passwords to reset for 60 parents in February.

- **Any signed-in Google account** → can view rosters. No provisioning, no approval queue.
- **admin** (`users/{uid}.role == "admin"`) → everything.
- **coach** → edit events, announcements, and roster *only* where `teamId` ∈ their `teamIds[]`.

Roles live in `users/{uid}`, read from rules via `get()`. No Cloud Functions, no custom claims, stays entirely on the free tier.

### Security rules sketch

```
match /teams/{teamId}/roster/{playerId} {
  allow read:  if request.auth != null;
  allow write: if isAdmin() || isCoachOf(teamId);
}
match /events/{id} {
  allow read:  if true;
  allow write: if isAdmin() || isCoachOf(request.resource.data.teamId);
}
match /users/{uid} {
  allow read:  if request.auth.uid == uid || isAdmin();
  allow write: if isAdmin();          // roles are never self-assigned
}
// config, seasons, teams, coaches, locations, announcements: public read, admin write
```

Your Firebase web config ships in the client and that is fine — it's designed to. The rules are the security boundary, not the config. Don't spend effort hiding it; do spend effort on the rules.

---

## 5. Getting the schedule in

Two paths, because you have two very different jobs:

**Games — bulk, from the league.** `admin/import.html`: paste tab- or comma-separated rows out of whatever the league sends (spreadsheet, email table, PDF copy-paste), map columns once, preview the parsed rows with warnings for unknown locations or bad dates, then commit. One paste, whole season. Re-running it updates matched events instead of duplicating — league schedules get revised.

**Practices — recurring, from you.** In `admin/events.html`:
- Add an event in under 15 seconds: type, team, date, time, location dropdown.
- **"Repeat weekly until \<date\>"** — one action creates the season's practice block.
- **Duplicate** button on every event.
- **Cancel toggles, never deletes.** A cancelled game stays visible, struck through, so parents don't think they missed it. Cancelling offers to auto-post an announcement.
- Everything editable inline; no separate edit page.

---

## 6. Schedule & calendar

One page, two views, one query — a separate calendar page would duplicate every filter for nothing.

- **List view (default):** grouped by date — type badge, time, team, opponent, location with Maps link. Defaults to upcoming.
- **Calendar view:** month grid, colored dots by type, tap a day for detail.
- Filters live in the URL (`schedule.html?team=grade-5&view=calendar`) so you can text a parent a link straight to their kid's schedule.
- Team pages run the same query pre-filtered.

Phase 5 candidate: an `.ics` feed so parents subscribe once and stop asking. You already know what that's worth from consolidating four teams through Teamup.

---

## 7. Build phases

**Phase 0 — Foundation.** Repo, Pages enabled, Firebase project, Firestore, Google Auth, first rules, `firebase-config.js`, shared CSS + nav shell, logo in place.

**Phase 1 — Static public site.** Home, Register, Program, 404. *Deployable and useful on its own* — this alone beats emailing a form link around, and it's the version you can put in front of PAL early.

**Phase 2 — Schedule engine.** `events` + `locations`, `admin/events.html`, `admin/import.html`, `schedule.html` both views. Biggest chunk, highest payoff. The importer belongs here rather than later, since the league hands you the schedule in bulk.

**Phase 3 — Auth, teams, rosters.** Google sign-in, `users` roles, rules tightened, `teams.html`, `team.html`, gated rosters, `admin/teams.html`.

**Phase 4 — Announcements & coaches.** Announcement CRUD, site-wide alert banner, `announcements.html`, `coaches.html`. This is the weather-cancellation path — want it before the first January snow.

**Phase 5 — Nice to have.** `.ics` feed, team photos, scores/standings, PWA install, push notifications.

**Phase 6 — Handoff.** Seed one realistic demo season, write a one-page admin guide, walk PAL through it.

---

## 8. Known traps

- **Never `new Date(dateString)`** — parses as UTC and silently shifts a 6:00 PM Friday game to Saturday. Parse from local components; store Firestore `Timestamp`s, not strings. This will bite hardest in the schedule importer.
- Force `America/New_York` explicitly anywhere a date is formatted outside the browser.
- Don't use `enableIndexedDbPersistence()` — deprecated.
- Use `onAuthChange` from `js/auth.js`, never a raw `getAuth()` in page scripts.
- **Project-repo paths.** The site is served from `/MountainsidePAL/`, not `/`. Every asset and link must be relative (`./css/styles.css`, `../js/auth.js`) — never root-absolute (`/css/styles.css`). That's the classic "works locally, blank white page on Pages" bug, and it's the single most likely thing to eat an evening. If PAL later buys a domain, the problem disappears, but build relative from day one anyway.
- Nav injection: every page needs the wrapper div `nav.js` expects, or that page silently loses navigation.
- Emoji in CSS `::after` — use Unicode escapes.

---

## 9. Still open

1. Fees, registration deadline, and season start/end dates — need real values (placeholders are fine to start).
2. Tryout dates and format — worth its own block on `register.html`.
3. Coach names and whether they want emails public or behind a contact form.
4. Practice/game locations — which gyms, with addresses.
5. What the league's schedule actually looks like when it arrives (a sample file would let me build the importer against reality instead of a guess).
