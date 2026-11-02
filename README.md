# CyberGuard Academy

CyberGuard Academy is an offline-first, bilingual cyber-safety learning platform for
students and families. It currently provides 30 safe, simulated scenario levels,
local progress and reports, and an optional nickname-only scoreboard. It does not
perform real security tests, access real accounts, or send network traffic during
offline learning.

The Academy transition is staged. The level catalogue and scenario renderer are
available now; structured lessons, formal assessments, learner accounts, assignments
and content administration are not yet part of this baseline.

## Run locally

There is no front-end build step. From the project folder, run:

```powershell
npx serve .
```

Open the localhost address printed by the server. Serving from localhost enables
local JSON loading and the offline service worker. After the first successful load,
the app shell, fonts, translations and level data are cached. Progress and settings
are kept in this browser.

## Optional scoreboard service

The scoreboard is optional. To run the browser app and API together:

```powershell
python -m pip install -r requirements.txt
$env:CYBERGUARD_SECRET_KEY = (python -c "import secrets; print(secrets.token_hex(32))")
python app.py
```

Open `http://127.0.0.1:5000`. The server binds to localhost by default and stores
scoreboard data in `instance/cyberguard.sqlite3`. Joining requires explicit consent
and a nickname; learners can continue without uploading anything. The service uses
CSRF protection, rate limiting, input validation and score sanity checks. Teacher
reports are available from the Reports screen.

## Learning levels

The 30 levels are organized into six chapters: Foundations, Everyday Threats,
Digital Life, Networks and Systems, Web and Cloud Security, and Incident Response
and Forensics. The Levels screen presents them as an accessible chapter-by-chapter
list. Locked levels remain unavailable until earlier levels are completed; completed
levels can be reviewed. Selecting an available level opens its scenario renderer.

Scenarios use simulated emails, messages, router settings, websites, app permissions,
logs, code and incident reports. Learners identify an issue, select a safe fix, and
review the explanation and practical guidance. English and Urdu, right-to-left
layout, light and dark themes, keyboard controls, self-hosted fonts, responsive
layouts and offline use are supported.

## Current project structure

- `index.html`, `css/`, `js/`: application shell, interface, level engine, local
  progress, adaptive recommendations, reporting and scenario renderers.
- `levels/` and `level-catalog.json`: localized 30-level scenario data and index.
- `lang/`: English and Urdu interface, level text, explanations and glossary.
- `app.py`, `js/scoreboard.js`, `js/teacher.js`, `teacher.html`: optional scoreboard
  API, browser client and teacher report.
- `assets/fonts/`: self-hosted typefaces and their licenses.
- `tests/`, `e2e/`: Node, Python and browser checks.
- `.github/workflows/ci.yml`: automated lint, formatting and test checks.
- `service-worker.js`, `manifest.webmanifest`: offline installation support.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for existing components, migration status
and the Academy modules that remain to be implemented.

## Checks

Install JavaScript development dependencies and run the test suites:

```powershell
npm ci
npm run lint
npm run format:check
npm test
npm run test:e2e
```

Run the API tests with:

```powershell
python -m pip install -r requirements.txt
python -m unittest discover -s tests -p "test_app.py"
```

## Screenshots

![CyberGuard Academy dashboard](./screenshots/home.png)

![Chapter level list in English](./screenshots/levels.png)

![Chapter level list in Urdu](./screenshots/levels-urdu.png)

![Player report in English](./screenshots/report.png)

![Player report in Urdu](./screenshots/report-urdu.png)

## License

This project is released under the MIT License. See [LICENSE](./LICENSE).
