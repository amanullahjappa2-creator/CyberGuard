# CyberGuard Phase 2 Status

Baseline tag: `pre-phase2` at `f77e985` (2026-11-03).

This status records the repository before Phase 2 implementation. The project is
an offline-first learning application with an optional Flask scoreboard, not yet
an account-based learning and testing platform. Existing functionality is retained;
items marked missing are not implied to exist elsewhere in the codebase.

## What exists

- A browser application with 30 bilingual, simulated security levels in six
  chapters, local progress, scoring, hints, stars, XP, badges and a final
  client-side learning certificate.
- Scenario renderers, localized level explanations and learning cards, and a
  lightweight level catalogue.
- Rule-based mastery observations, recommendations, difficulty settings, daily
  practice, a final timed challenge, skill radar and local performance reports.
- Dictionary, settings, progress import/export, dark/light themes, RTL layout,
  self-hosted fonts, responsive styling and a service worker.
- An optional Flask/SQLite scoreboard with nickname consent, CSRF tokens,
  process-local rate limits, score-range checks, class codes, teacher-token
  reports and CSV export.
- Node, Python and Playwright test suites, ESLint, Prettier and GitHub Actions CI.

## Broken or unfinished items

- No baseline test failures were found before Phase 2: 27 Node tests, 6 Python
  tests and 1 Playwright test pass; lint and formatting pass.
- The application has no student, instructor or admin accounts or role model.
  Class creation is public and returns a bearer teacher token; classroom
  membership is represented by a class code, not an authenticated user.
- The scoreboard validates score bounds against completed levels, but cannot
  prove a submitted score or event history was genuinely earned by a player.
- Adaptive mastery starts at 50 and reports numerical estimates immediately;
  it does not implement a minimum answered-item threshold or an uncertainty
  state such as “Not enough data.”
- Daily practice uses deterministic local level selection. It has unit coverage
  but has not received broader cross-device date/time-zone validation.
- The current certificate is generated locally and explicitly is not a
  professional credential; it has no server signature, verification endpoint
  or revocation mechanism.
- There is no demo seed/reset workflow, migration framework, production
  deployment configuration, or researcher data model.
- Phase 2 security foundations now add a server CSP and browser security headers;
  HTTPS responses receive HSTS. CI is configured for npm audit, pip-audit,
  Bandit and Gitleaks. Their CI results are pending.

## Missing from the Phase 2 brief

- Connected NovaTech story, named colleague briefings, case-closed summaries,
  skill-gain cards and a skip-briefing preference.
- Toolkit screens and analyzers (password strength/passphrase generation, scam
  message, URL and email-header analysis, and personal security check-up).
- Spaced review scheduling, review sessions, a mistake notebook, a
  personalized learning path, interleaved practice and confidence tracking.
- Research consent and study flow, anonymized exports, SUS survey, research
  statistics, charts and study guide.
- Five dedicated multi-skill Lab assessments and six micro-lessons; current
  chapter-end levels are not a replacement for these specified additions.
- Authentication and account recovery, instructor/admin TOTP, global logout,
  data deletion, certificate signing/revocation and validation of per-issue
  event evidence on the server.
- Seeded demo accounts/data, Docker/PostgreSQL deployment and backup/restore
  documentation, full multi-screen browser QA and Lighthouse measurements.
- In-platform phishing drills are intentionally deferred until the core platform
  and privacy model are stable. Email delivery is not implemented.

## Baseline verification

Checked on 2026-11-03 before Phase 2 edits:

- `npm test`: 27 passing.
- `python -m unittest discover -s tests -p "test_app.py"`: 6 passing.
- `npm run test:e2e`: 1 passing.
- `npm run lint`: passing.
- `npm run format:check`: passing.

Post-baseline, the server security headers pass eight Python API tests, and
the 27 Node tests, Playwright flow, lint and npm audit continue to pass. The
Python scanner packages could not be installed in the local Python 3.15
environment because their PyYAML dependency requires unavailable C++ build
tools; CI uses Python 3.12. Gitleaks has not yet run in this local checkout.
Lighthouse scores have not been measured. No claim is made that the missing
features or platform-security controls are complete.

## Implementation order

Follow the Phase 2 priority order: platform security and a safe demo-data plan;
offline Toolkit; connected story; spaced review and learning path; research mode;
content expansion; deployment and viva documents; only then consider safe,
opt-in simulated drills and final visual/accessibility hardening. Verify and
commit each coherent stage while preserving the existing test suite.
