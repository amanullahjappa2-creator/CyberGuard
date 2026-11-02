# Architecture

## Current baseline

CyberGuard Academy is being migrated in stages from the offline-first CyberGuard
training app. The current baseline contains a static browser client, 30 bilingual
scenario levels, local progress and reporting, and an optional Flask/SQLite
scoreboard. The main navigation currently exposes Dashboard, Levels, Reports,
Badges, Dictionary and Settings. Learn modules, formal assessments, user accounts,
assignments and content administration are not implemented yet.

The available Git history starts with the complete app at `e86c76d`; it does not
contain a separate pre-CyberCity level-list revision. The `pre-academy-restructure`
tag preserves the current baseline before this migration. To remove the map, the
level list is rebuilt from the existing chapter metadata and localized level
catalog, while keeping the scenario engine and renderers.

## Existing components retained

- `index.html` provides the app shell, navigation, content region, CSP and PWA
  manifest link.
- `js/ui.js` renders the dashboard and screens, handles locale/RTL and theme
  preferences, loads level JSON on demand, and coordinates progress and reports.
- `js/engine.js` validates level data and implements level progression, issue
  selection, scoring, hints, XP, badges, timers and existing adaptive hooks.
- `js/adaptive.js` calculates local skill observations, recommendations and report
  summaries. Its current formula is transitional and does not yet implement the
  Academy brief's five-item initialization and confidence thresholds.
- `js/storage.js` wraps local storage and validates exported/imported progress.
- `js/levels/renderers.js` renders selectable and ordered scenario items.
- `levels/level01.json` through `levels/level30.json` hold scenario structures and
  fix identifiers. `level-catalog.json` supplies lightweight index metadata.
- `lang/en.json` and `lang/ur.json` hold English and Urdu UI and scenario content.
- `app.py`, `js/scoreboard.js`, `js/teacher.js` and `teacher.html` implement the
  optional privacy-consented nickname scoreboard and teacher reports.
- `css/style.css` provides responsive themes, RTL layout, accessibility states and
  scenario presentation. Fonts are self-hosted under `assets/fonts/`.
- `service-worker.js` precaches the app shell, locale files, levels and assets for
  offline use after the first successful load.

## Intended Academy direction

The existing level JSON, bilingual translations, input validation, offline shell,
and scenario renderers are the foundation for the Academy's Labs. The separate
Learn and Assessments modules, secure assessment delivery, accounts/roles,
instructor classes and assignments, signed certificate verification, and
administrative content workflow still require implementation. When the mastery
module is replaced, its result must remain the single source for dashboards,
recommendations and learner/instructor reports.

## Validation

- `npm test`: Node unit tests and level data validation.
- `npm run lint`: ESLint for application, tests, scripts, browser tests and service
  worker.
- `npm run format:check`: Prettier verification.
- `npm run test:e2e`: Playwright browser checks.
- `python -m unittest discover -s tests -p "test_app.py"`: scoreboard API tests.
