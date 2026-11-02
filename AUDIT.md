# CyberGuard Academy Polish Audit

Audit baseline: `pre-polish` tag at `24a4b38b5b2f63f0dfb0151e030de7ea7f22c500`.

## Architecture

- `index.html` owns the static application shell, CSP, primary navigation, theme and
  language controls, and live feedback region.
- `js/ui.js` renders all learner screens, loads bilingual level JSON on demand,
  handles settings, and connects local reports to the optional scoreboard.
- `js/engine.js`, `js/adaptive.js`, and `js/storage.js` implement progression,
  scoring, mastery observations, report data, and validated local import/export.
- `js/levels/renderers.js` renders the scenario cards shared by all level types.
- `level-catalog.json` is the lightweight index; `levels/level01.json` through
  `level30.json` hold scenario mechanics. `lang/en.json` and `lang/ur.json` hold
  localized screens, scenario copy, learning cards, and glossary entries.
- `app.py`, `js/scoreboard.js`, `js/teacher.js`, and `teacher.html` implement the
  optional consent-based classroom service and its teacher report.
- `css/style.css` provides the responsive, light/dark, RTL, and print presentation.
  `service-worker.js` precaches the app shell and all current level data.
- Node, Python, and Playwright checks live in `tests/` and `e2e/`; GitHub Actions
  runs the configured checks.

## Findings

| Area                            | Finding                                                                                                                                                                                                                                                                                                  | Action                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Baseline and unused files       | The `pre-polish` tag preserves the pre-cleanup baseline. The unused difficulty migration script has been removed; the generator remains the source for generated level data.                                                                                                                             | Complete.                                                                                                  |
| Dead UI/CSS                     | Map-era styles and the stale `.city-map` assertion have been removed; browser tests now assert the chapter list and level count.                                                                                                                                                                         | Complete.                                                                                                  |
| Duplicate styling               | `style.css` still layers later visual rules over base selectors such as `.topbar`, `.hero`, `.button`, `.level-card`, and `.scenario-card`. This preserves existing behavior but makes the cascade harder to maintain.                                                                                   | Consolidate only with focused visual regression coverage; not addressed in this pass.                      |
| Navigation and feature scope    | Primary navigation now contains Dashboard, Levels, Reports and Dictionary; Badges, Settings, language and theme are in the Options menu. Learn and a formal question-bank assessment do not exist, so no dead links were added.                                                                          | Complete for the current working feature set.                                                              |
| Level metadata and presentation | Chapter descriptions and progress, level difficulty (1–5), estimated duration, issue count, stars, availability and chapter-end Lab markers are shown and validated.                                                                                                                                     | Complete.                                                                                                  |
| Content volume                  | The catalogue has 30 levels and 107 issues (all levels have 3–6). Both locales have 57 glossary entries. Structured lessons, a formal question bank, and the 80-term glossary target are not present.                                                                                                    | Record these as future content work; do not imply they exist.                                              |
| Content quality                 | The fictional payment scenario no longer names real wallet brands. Choice order is deterministic per attempt and remains stable during rerenders. Some wrong-answer explanations remain generic.                                                                                                         | Complete the targeted changes; continue reviewing generic feedback in a separate content pass.             |
| Naming and copy                 | Visible completion copy uses Academy/Level/Lab terminology, including the final level and chapter-end achievement descriptions.                                                                                                                                                                          | Complete.                                                                                                  |
| Translations                    | Existing level scenarios, choices, explanations, hints, learning cards, and glossary entries have English and Urdu data and pass `validateLevel`. New Learn/Tests content has no translations because those modules are absent. A few generic startup/error messages are hard-coded in English.          | Keep both locale files in sync for any UI/content changes; do not claim untranslated modules are complete. |
| Dependencies and assets         | The five JavaScript development dependencies are installed and used by linting, formatting, unit tests, or Playwright. All four self-hosted fonts are referenced by CSS and precached; their license files are required. No unused runtime asset or package was confirmed.                               | Retain dependencies, fonts, and licenses.                                                                  |
| Logging and placeholders        | No `console.log`, TODO/FIXME, or Lorem Ipsum placeholder was found. `console.error` calls report handled storage, media, network, and startup failures and are intentional.                                                                                                                              | Keep error reporting; do not silence operational failures.                                                 |
| Visual and accessibility QA     | Browser coverage checks persistence, Urdu, offline operation, keyboard focus movement, scoreboard consent, and mobile navigation overflow at 360px. It does not cover every screen/type at every requested width, theme combinations, clipping, or browser console errors. Lighthouse is not configured. | Continue incremental browser checks; do not report unmeasured Lighthouse scores.                           |
| Screenshots and docs            | README screenshots document the current dashboard, chapter list, and reports in both locales. There are no saved captures for a scenario, teacher report, or certificate.                                                                                                                                | Keep screenshots synchronized with implemented screens; identify absent screens honestly.                  |

## Polish-pass verification

The final polish pass has 27 passing Node tests, 6 passing Python API tests, and 1
passing Playwright end-to-end test. ESLint, Prettier, and `git diff --check` pass.
The browser flow checks English and Urdu, light and dark themes, offline progress,
keyboard navigation, and the 360px primary navigation layout.

## Scope note

The existing project does not include Learn lessons, a formal assessment bank,
accounts, assignments, certificate signing, or a content-administration workflow.
These are not treated as implemented by this polish pass. Implementing them safely
requires new product and data models rather than cosmetic cleanup.
