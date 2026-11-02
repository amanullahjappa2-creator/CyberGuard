# Architecture

CyberGuard is an offline-first learning game built with HTML, CSS and vanilla JavaScript ES modules. Campaign play has no backend, build step, analytics or third-party runtime service. An optional same-origin Flask/SQLite service provides an explicitly opted-in class scoreboard.

## Application layers

- `index.html` supplies the accessible app shell, navigation, content region, CSP and PWA manifest link.
- `js/ui.js` owns screen rendering, preferences, language/RTL handling, progress import/export, the certificate and lazy loading of the selected level JSON. User-provided and translated strings are inserted with DOM APIs and `textContent`.
- `js/engine.js` validates level data and implements campaign unlocking, trust, hints, scoring, stars, XP, ranks, mastery, badges, timers and deterministic daily challenges.
- `js/adaptive.js` updates per-skill mastery using the documented weighted moving-average formula, chooses explainable recommendations, and aggregates the local performance report.
- `js/storage.js` validates progress imports and wraps browser local storage with explicit errors.
- `js/scoreboard.js` is the opt-in API client. It sends only a nickname, score and aggregate progress after consent; it does not transmit raw issue events.
- `js/teacher.js` and `teacher.html` provide the bilingual class dashboard and teacher-only exports.
- `app.py` serves an allowlisted set of static files and exposes the optional scoreboard API. It uses SQLite, session-bound CSRF tokens, rate limiting, nickname/input validation, bounded-score sanity checks, hashed teacher tokens and parameterized SQL.
- `js/levels/renderers.js` renders safe, selectable scenario cards. Log and terminal cards use a monospace presentation; timeline and alert levels provide ordered interactions.
- `levels/level01.json` through `level30.json` contain scenario structure and fix identifiers. Matching localized content, hints, explanations, learning cards and glossary entries live in `lang/en.json` and `lang/ur.json`.
- `css/style.css` defines responsive design tokens, dark and light themes, reduced-motion handling, RTL typography and scenario presentation. Fonts are self-hosted under `assets/fonts/`.
- `service-worker.js` precaches the app shell, both locales, all level data, CSS, modules, fonts and icon for offline use after the first successful load.

## Data flow

At startup the UI loads and validates the two locale files, then creates a lightweight 30-level index. Selecting a level fetches and validates its JSON before the engine begins play. This keeps individual level content lazy-loaded while allowing the CyberCity map and daily challenge to appear immediately. Progress, adaptive observations and preferences remain in local storage. Scoreboard requests do not occur until a player explicitly accepts the privacy notice; later synchronization is limited to that opt-in state.

## Content organization

The campaign has six chapters of five levels each. Every level has an ID, chapter, bilingual title and scenario, difficulty, skill tag, renderer type, three to six issues, a correct fix and two wrong fixes per issue, two hints, glossary references, localized explanations and a Pakistan-relevant learning card.

## Quality checks

`npm test` uses Node's built-in test runner for engine, adaptive logic, progress persistence, scoreboard payloads and level-data validation. `python -m unittest discover -s tests -p "test_app.py"` checks the optional API and security controls. `npm run test:e2e` runs the Playwright campaign, locale, theme, persistence, offline and phone-layout flow. `npm run lint` checks application, test, service-worker, browser-test and content-generation JavaScript; `npm run format:check` checks formatting. GitHub Actions runs these checks on pushes and pull requests.
