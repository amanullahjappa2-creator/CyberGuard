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

| Area                            | Finding                                                                                                                                                                                                                                                                                                             | Action                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline and unused files       | The prior level-list state is unavailable in history. The `pre-polish` tag now preserves the current clean baseline. The one-time `migrate-issue-difficulty.mjs` script is not referenced by project scripts and its migration is already present in all levels.                                                    | Remove the obsolete migration script. Keep the level generator as the source for generated level content.                                                                                     |
| Dead UI/CSS                     | Map-era `.chapter-section`, `.chapter-nodes`, `.map-node`, and node styles remain after the map was removed; the E2E test still asserts that `.city-map` is absent.                                                                                                                                                 | Remove the dead styles and replace the stale assertion with checks for the current chapter list.                                                                                              |
| Duplicate styling               | `style.css` redeclares shared selectors such as `.topbar`, `.brand`, `.hero`, `.button`, `.level-card`, `.scenario-card`, and `.certificate` in later blocks. The cascade makes final appearance difficult to audit and maintain.                                                                                   | Consolidate the overlapping declarations into the existing component rules while preserving responsive and print behavior.                                                                    |
| Navigation and feature scope    | All six current navigation destinations work, but Badges and Settings occupy primary-navigation slots instead of the requested Learn and Tests destinations. Learn and a formal question-bank assessment do not exist; adding links without those features would create dead routes.                                | Keep working surfaces reachable and avoid presenting absent sections as available. Move secondary controls out of the main learner navigation only when their destinations remain accessible. |
| Level metadata and presentation | Levels are grouped by chapter, but cards omit numeric difficulty, duration, issue count, stars, explicit lock reason, chapter description, and chapter progress bar. Catalog difficulty labels (`learner`, `defender`, `expert`) are player settings, not the requested 1–5 level rating.                           | Add validated numeric level ratings and estimated duration metadata and render the requested progress/status details.                                                                         |
| Content volume                  | The catalogue has 30 levels and 107 issues (all levels have 3–6). Both locales have 57 glossary entries. There are no structured lessons or question bank, and no Threat Intel field.                                                                                                                               | Preserve the working 30-level content. Record lessons, assessment bank, and the 80-term target as content gaps rather than implying they exist.                                               |
| Content quality                 | Each level has a four-field learning card, but much of the wrong-answer feedback is generic. The level-13 simulated payment content names real wallet brands. Several catalog levels have only coarse difficulty labels.                                                                                            | Replace real brands in fictional scam material; improve question-order variation and level metadata. Keep all existing fix explanations and bilingual validation.                             |
| Naming and copy                 | The final level is labelled “Final Boss,” an achievement is called “Boss Slayer,” and the completion result uses `gameComplete`.                                                                                                                                                                                    | Use Academy/Level/Lab terminology consistently in visible copy and internal completion results.                                                                                               |
| Translations                    | Existing level scenarios, choices, explanations, hints, learning cards, and glossary entries have English and Urdu data and pass `validateLevel`. New Learn/Tests content has no translations because those modules are absent. A few generic startup/error messages are hard-coded in English.                     | Keep both locale files in sync for any UI/content changes; do not claim untranslated modules are complete.                                                                                    |
| Dependencies and assets         | The five JavaScript development dependencies are installed and used by linting, formatting, unit tests, or Playwright. All four self-hosted fonts are referenced by CSS and precached; their license files are required. No unused runtime asset or package was confirmed.                                          | Retain dependencies, fonts, and licenses.                                                                                                                                                     |
| Logging and placeholders        | No `console.log`, TODO/FIXME, or Lorem Ipsum placeholder was found. `console.error` calls report handled storage, media, network, and startup failures and are intentional.                                                                                                                                         | Keep error reporting; do not silence operational failures.                                                                                                                                    |
| Visual and accessibility QA     | Existing browser coverage checks persistence, Urdu, offline operation, keyboard focus movement, scoreboard consent, and one phone-width overflow case. It does not cover every screen/type at all requested widths, theme combinations, overlap, clipping, or browser console errors. Lighthouse is not configured. | Expand browser QA incrementally; do not report unmeasured Lighthouse scores.                                                                                                                  |
| Screenshots and docs            | README screenshots cover dashboard, levels, and reports only. There are no saved captures for a scenario, results, assessment, teacher report, or certificate.                                                                                                                                                      | Update screenshots only for screens that currently exist and identify absent screens honestly.                                                                                                |

## Baseline checks

The current baseline has 24 passing Node tests, 6 passing Python API tests, and 1
passing Playwright end-to-end test. ESLint, Prettier, and `git diff --check` pass.

## Scope note

The existing project does not include Learn lessons, a formal assessment bank,
accounts, assignments, certificate signing, or a content-administration workflow.
These are not treated as implemented by this polish pass. Implementing them safely
requires new product and data models rather than cosmetic cleanup.
