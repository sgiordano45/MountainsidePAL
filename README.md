# Mountainside PAL Basketball

Static site on GitHub Pages, Firebase (Firestore + Auth) backend.

- **Live:** https://sgiordano45.github.io/MountainsidePAL/
- **Plan:** see `PLAN.md`
- **Grades:** 3rd–8th, one team per grade, selected by tryout

## Structure

```
index.html          home
register.html       registration info + Google Form link
program.html        divisions, tryouts, expectations, FAQ
schedule.html       (Phase 2) games/practices, list + calendar
teams.html          (Phase 3) team index
team.html?id=       (Phase 3) single team template
coaches.html        (Phase 4) staff directory
announcements.html  (Phase 4) archive
404.html            fallback
css/styles.css      all styling, design tokens at top
js/                 shared modules
assets/             logo, photos
admin/              (Phase 2+) admin pages
```

## Setup

1. Create a Firebase project, enable **Firestore** and **Authentication → Google**.
2. Copy your web config into `js/firebase-config.js`, replacing the placeholder values.
3. Publish `firestore.rules` when Phase 3 lands.

Until step 2 is done the site runs fine — dynamic sections stay hidden.

## Local preview

```
python3 -m http.server 8000
```
Then open http://localhost:8000

## Deploy

Push to `main`. GitHub Pages serves from the repo root.

**All paths must be relative** (`./css/styles.css`), never root-absolute (`/css/styles.css`) —
the site is served from `/MountainsidePAL/`, not the domain root.
