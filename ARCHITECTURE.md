# Architecture

## Current baseline

CyberGuard Academy is being migrated in stages from the offline-first CyberGuard
training app. The current baseline contains a static browser client, 30 bilingual
scenario levels, local progress and reporting, and an optional Flask/SQLite
scoreboard. Primary navigation exposes Dashboard, Levels, Reports and Dictionary;
Badges, Settings, language and theme controls are grouped in the Options menu.
Learn modules, formal assessments, assignments and content administration are not
implemented yet. The bilingual Account screen provides registration/login and
student-controlled progress backup, restore and deletion. Local progress remains
available offline and is not uploaded automatically.

The `pre-polish` tag preserves the application before this cleanup pass. The former
map is replaced by the chapter-based level list, reusing the existing progression,
scenario engine and renderers.

## Existing components retained

- `index.html` provides the app shell, navigation, content region, CSP and PWA
  manifest link.
- `js/ui.js` renders the dashboard and screens, handles locale/RTL and theme
  preferences, loads level JSON on demand, and coordinates progress and reports.
- `js/engine.js` validates level data and implements level progression, issue
  selection, scoring, hints, XP, badges, timers, persisted answer order and
  existing adaptive hooks.
- `js/adaptive.js` calculates local skill observations, recommendations and report
  summaries. The interface labels unattempted or emerging skill data explicitly;
  it only presents mastery estimates after four answered issues in a skill.
- `js/storage.js` wraps local storage, validates exported/imported progress, and
  merges account backups while retaining completed records and unique learning
  events from both copies.
- `js/levels/renderers.js` renders selectable and ordered scenario items.
- `levels/level01.json` through `levels/level30.json` hold scenario structures and
  fix identifiers. `level-catalog.json` supplies lightweight index metadata.
- `lang/en.json` and `lang/ur.json` hold English and Urdu UI and scenario content.
- `app.py` implements the optional privacy-consented nickname scoreboard,
  teacher reports, student registration/login and private student progress backup
  APIs, and transactional, versioned SQLite migrations. Progress writes use an
  optimistic revision check. Teacher accounts activated by the server invite
  code can create owned classes; report endpoints enforce owner identity.
  Students can request membership in owned classes; teachers approve/reject
  pending requests and remove active members.
  `js/scoreboard.js`, `js/teacher.js` and
  `teacher.html` provide the browser clients. Flask response headers
  include a same-origin CSP, frame restrictions, and other browser security
  policies. The service worker bypasses API routes and does not offline-cache
  authentication responses.
- `css/style.css` provides responsive themes, RTL layout, accessibility states,
  chapter and level-card presentation, and scenario styles. Fonts are self-hosted
  under `assets/fonts/`; shared dark-theme tokens use a restrained cyan, blue and
  status palette.
- `service-worker.js` precaches the app shell, locale files, levels and assets for
  offline use after the first successful load.
- `THREAT_MODEL.md` and `SECURITY.md` document the current boundaries, known
  limitations and private vulnerability-reporting process.

## Intended Academy direction

The existing level JSON, bilingual translations, input validation, offline shell,
and scenario renderers are the foundation for the Academy's Labs. The separate
Learn and Assessments modules, secure assessment delivery, complete role
provisioning and authorization, instructor classes and assignments, signed
certificate verification, and administrative content workflow still require
implementation. When the mastery module is replaced, its result must remain the
single source for dashboards, recommendations and learner/instructor reports.

## Validation

The prerequisite event and XP accounting design is documented in
`LEARNING_DATA_MODEL.md`. Implementation must retain offline local play, treat
the current XP total as a legacy balance rather than inventing award history,
and keep teacher reporting behind approved membership and server-side ownership
checks.

- `npm test`: Node unit tests and level data validation.
- `npm run lint`: ESLint for application, tests, scripts, browser tests and service
  worker.
- `npm run format:check`: Prettier verification.
- `npm run test:e2e`: Playwright browser checks.
- `python -m unittest discover -s tests -p "test_app.py"`: scoreboard API tests.
