# CyberGuard Academy Implementation Status

The project is an offline-first learning application with an optional Flask
scoreboard, student accounts, teacher-owned classes, and explicit private
student-progress backups. Existing functionality is retained; items marked
missing are not implied to exist elsewhere in the codebase.

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
- Versioned SQLite migrations; student registration, login, current-user, logout
  and progress backup APIs. Students can explicitly merge or delete account-owned
  progress, with no automatic upload. Backups exclude the certificate name and
  unfinished attempt. Passwords use Werkzeug scrypt hashes,
  and account creation cannot assign teacher/admin roles from browser input.
- Node, Python and Playwright test suites, ESLint, Prettier and GitHub Actions CI.

## Broken or unfinished items

- No baseline test failures were found before Phase 2: 27 Node tests, 6 Python
  tests and 1 Playwright test pass; lint and formatting pass.
- Cloud progress is an explicit account backup, not live synchronization: local
  progress remains authoritative during play. Confirmed merges preserve completed
  level records and unique learning events across copies; stale concurrent writes
  are rejected. XP remains a cumulative total without an event ledger and uses the
  higher copy to avoid double counting. No account-linked dashboard or
  teacher-level progress reporting is implemented.
- Teacher onboarding requires a server invite; there is no admin provisioning,
  account recovery, email verification or complete role-based authorization.
  Legacy class creation still returns bearer teacher tokens; account-owned teacher
  classes use identity checks.
- The scoreboard validates score bounds against completed levels, but cannot
  prove a submitted score or event history was genuinely earned by a player.
- Adaptive calculations use a neutral prior internally. Reports now distinguish
  unattempted, hint-only, emerging and established data; mastery is shown only
  after four answered issues in a skill. This threshold is not a statistical
  confidence guarantee.
- Daily practice uses deterministic local level selection. It has unit coverage
  but has not received broader cross-device date/time-zone validation.
- The current certificate is generated locally and explicitly is not a
  professional credential; it has no server signature, verification endpoint
  or revocation mechanism.
- There is no demo seed/reset workflow, production deployment configuration, or
  researcher data model.
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

Post-baseline, the previous dashboard pass passed 29 Node tests, 8 Python API
tests, 1 Playwright flow, lint and formatting. Python scanner packages could not
be installed in the local Python 3.15 environment because their PyYAML dependency
requires unavailable C++ build tools; CI uses Python 3.12. Gitleaks has not yet
run in this local checkout. Lighthouse scores have not been measured. No claim is
made that the missing features or platform-security controls are complete.

## Phase 1 UI and reporting update

- The dashboard now presents the locally recorded rank, XP, player level,
  streak and campaign completion with bilingual labels.
- Reports and the mastery radar no longer portray the neutral 50-point prior
  as measured skill. Unattempted, hint-only and low-sample skills are labelled;
  estimates appear only after four answered issues for that skill.
- The default recommendation explains that it is the next available mission
  until the player has answered issues. Empty mistake counts are not displayed
  as zero before a skill has been attempted.
- Dark-theme accents were softened and duplicate dark token declarations were
  removed. Existing light theme and Urdu RTL behavior remain.
- Verification after these changes: 29 Node tests, 8 Python API tests, 1
  Playwright flow, ESLint, Prettier and `git diff --check` pass. The Playwright
  flow specifically checks empty and
  established mastery states.

## Student account and migration foundation

- SQLite schema changes now run in a write-locked transaction and advance
  `PRAGMA user_version` through explicit migrations. The initial migration is
  safe for existing scoreboard databases; it creates missing legacy tables and
  indexes without replacing existing rows.
- Student registration validates fields, enforces unique case-insensitive
  usernames/emails, stores a scrypt hash, and always assigns the student role.
  Login supports username or email and uses generic credential failures.
  Authentication and logout clear the prior signed-cookie session contents;
  `/api/auth/me` checks that the account is still active.
- Registration/login/logout mutations require the existing same-session CSRF
  header. Tests cover invalid/duplicate registration, role-escalation attempts,
  password hashing, login, CSRF/session rotation, logout and preservation of
  pre-existing class/leaderboard rows during migration.
- The bilingual Account screen now calls these APIs, supports registration,
  username/email login and logout, and reports when the optional Flask service
  is unavailable. The service worker bypasses API URLs rather than using its
  offline cache for authentication.
- This is not a complete authentication phase: no account recovery, email
  verification, admin setup or server-side session revocation. Legacy
  bearer-token class creation remains for compatibility.
- Verification before wiring the Account screen: 29 Node tests, 10 Python API
  tests, 1 Playwright flow, ESLint, Prettier, Python compilation and
  `git diff --check` passed. The migration preserved existing scoreboard rows.

## Student account interface

- Added the bilingual account screen under Options, with registration, username
  or email login, password confirmation, authenticated profile summary and logout.
- Account API responses are fetched without caching; the service worker bypasses
  `/api/` paths, leaving authenticated functionality unavailable offline while
  the learning game continues to work.
- Added an end-to-end account flow that registers a student, signs out, logs back
  in and switches to Urdu.

## Teacher-owned classes

- Added migration version 3 to associate new classes with the creating teacher
  account without changing existing token-based class rows.
- Teacher account registration is granted only when the server's
  `CYBERGUARD_TEACHER_INVITE_CODE` matches; a browser role field cannot grant
  teacher access. Teacher invite values are compared in constant time.
- Teachers can list/create their own classes and access only their owned reports
  and exports. Students and different teachers are denied. Existing legacy
  bearer-token class creation and reporting continue to work separately.
- The teacher dashboard detects a signed-in teacher and switches to account-owned
  class management; it lists, creates, reports and exports owned classes.
- Added migration version 4 and student membership requests. Students can request
  a class by code; the owner teacher can approve/reject pending requests and
  remove active members. Membership APIs disclose only name, username and status.
- Score submission to account-owned classes now requires the learner to be
  signed in and have an active approved membership. Legacy unowned classes keep
  the old nickname flow.
- Account and teacher screens show the student's class status and provide owner
  approval/removal controls. E2E coverage exercises student request, teacher
  approval, student status refresh and teacher removal.
- Membership requests are limited to account-owned classes; a code for a legacy
  bearer-token class cannot create an unapprovable account membership.

## Latest verification

- `npm test`: 31 passing.
- Python API tests: 14 passing.
- Playwright: 3 passing, including student auth, teacher-owned classroom
  management, explicit account-progress upload/restore/delete, membership
  approval/removal and offline progress.
- ESLint, Prettier, Python compilation and `git diff --check`: passing.

## Student progress backup

- Migration version 5 adds one private progress snapshot per student, keyed by
  the authenticated account and removed when that account is deleted.
- The Account screen lets students explicitly merge browser progress with the
  account backup or delete it. No game activity is automatically uploaded, and
  local learning continues offline.
- The API accepts bounded, validated learning data only; it omits the certificate
  name and unfinished attempt, requires CSRF protection for changes, rejects
  teacher access, returns data only to its owning student, and rejects stale
  concurrent writes using the snapshot revision.
- The browser merge retains the better completed-level records, unions distinct
  achievements and learning events, preserves browser-only progress on restore,
  and is idempotent for repeated syncs. XP uses the greater cumulative total to
  avoid duplicate awards; a per-award XP history is not yet available.
- Tests cover private account boundaries, role restrictions, invalid payloads,
  stale-write conflicts, snapshot merges, account backup deletion, and browser
  upload/restore flows.

## Implementation order

Continue with learning content and assessment modules, then connect account
progress to carefully scoped learner/teacher reports. Keep local play available
offline and verify every increment against the bilingual browser flow.

## Next development phase checklist

- [x] Audit current documentation, account APIs, teacher routes, local storage,
      service-worker behavior, and existing browser/API test coverage.
- [x] Make account progress upload and restore merge-safe across devices, with
      conflict protection and tests proving existing records are retained.
- [x] Design structured, attributable learning and XP history before presenting
      account-level analytics or teacher access to individual learning records.
- [ ] Add bilingual structured courses, lessons, knowledge checks, bookmarks,
      and resume state.
- [ ] Add server-authorized examinations and class assignments only after the
      account/class data model and answer-release rules are specified.
- [ ] Add verified certificates and administrative workflows after authorization,
      audit logging, and course-completion criteria are in place.

The learning-event and XP-ledger design is recorded in
`LEARNING_DATA_MODEL.md`. It specifies stable event identity, legacy XP handling,
offline-first capture, explicit revision-checked upload, privacy boundaries, and
authorization gates. The implementation and its acceptance tests remain pending.
