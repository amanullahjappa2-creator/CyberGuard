# CyberGuard Threat Model

## Scope and trust boundaries

The current product is an offline-first browser game plus an optional
Flask/SQLite service. The browser owns level logic and local progress; an
authenticated student can explicitly merge a bounded progress snapshot with the
snapshot stored for that account. The service also supports student/teacher
accounts, teacher-owned classes, student membership requests, and a separate
nickname-based scoreboard. No formal exams or administrator portal are implemented.

The browser, imported progress files, HTTP request bodies, URL/query parameters,
nicknames and class codes are untrusted. Production deployments must terminate
TLS and set `CYBERGUARD_COOKIE_SECURE=1`. The development server binds to
localhost by default and is not a production server.

## Assets

- Learner progress, preferences and certificate details stored in browser
  localStorage.
- Student account identity, password hashes, and per-account progress snapshots
  in SQLite. Snapshots omit the certificate name and unfinished attempt.
- Teacher-owned class codes and student membership states in SQLite.
- Legacy scoreboard nicknames, scores, completed-level numbers, aggregate
  skill/level statistics, legacy class codes, and teacher-token hashes in SQLite.
- The raw teacher token returned once when a class is created.
- Static level content, translation files and client-side answer/fix data.
- CI credentials and repository write access.

## Actors and entry points

- Students using local progress, authenticated account and class membership APIs,
  and explicit progress merge controls.
- Teachers creating account-owned classes and accessing reports as the owner.
- Legacy teachers using bearer tokens for token-owned class reports.
- Anonymous callers submitting score data or querying public leaderboards.
- A person with access to the browser profile, SQLite file, deployment, or
  repository.
- Entry points: static HTML/JavaScript/JSON routes; `/api/auth/*`,
  `/api/student/progress`, `/api/student/classes`, `/api/teacher/classes/*`,
  `/api/csrf`, `/api/health`, `/api/classes`, `/api/score`,
  `/api/leaderboard`, and class report/export routes.

## Threats and current mitigations

| Threat                                  | Current mitigation                                                                                                                                                                           | Remaining limitation                                                                                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account takeover or teacher-token theft | Passwords use Werkzeug scrypt hashes; login rotates the signed Flask session and CSRF token; cookies are HttpOnly and SameSite=Lax; account-owned teacher routes check ownership             | No email verification, password reset, TOTP, server-side session revocation or session inventory exists. Teacher accounts require a deployment invite code.                                      |
| CSRF                                    | Account, class, membership, score and progress mutations require a same-session token in `X-CSRF-Token`                                                                                      | The signed-cookie session has no server-side revocation; keep secret keys private and use HTTPS/secure cookies in deployment.                                                                    |
| Brute force or request flooding         | Per-IP/per-endpoint process-local rate limits and request-body size limits                                                                                                                   | Limits reset on restart and do not coordinate across workers; use a shared production limiter before deployment.                                                                                 |
| XSS and unsafe content                  | UI renders user and level strings with DOM text APIs; CSP restricts scripts to same-origin and disallows objects and framing                                                                 | `style-src 'unsafe-inline'` remains for dynamically sized progress UI; review any future HTML renderer and trusted content.                                                                      |
| Injection                               | SQLite statements use parameter binding; class codes, nicknames and numeric summaries are validated                                                                                          | Add tests for every new query and input surface. CSV formula injection must be considered if arbitrary user strings are ever exported.                                                           |
| IDOR / unauthorized class reports       | Account-owned reports and membership controls enforce the authenticated owner; student progress queries are keyed to the authenticated student ID; legacy reports require their bearer token | Legacy token-owned classes remain a separate compatibility path. Client progress and scoreboard values are not proof of independently verified learning.                                         |
| Score tampering / cheating              | Server rejects impossible totals, duplicate or invalid completed levels, and invalid aggregate statistics; progress snapshots have bounded field validation and revision checks              | Snapshots and scores are still client-submitted and cannot be proven legitimate. There is no authoritative event validation or exam answer boundary.                                             |
| Answer leakage                          | Scenario feedback is local and shown after user selection                                                                                                                                    | All answer/fix logic is shipped to the browser; this is a learning game, not a secure assessment system.                                                                                         |
| Certificate forgery                     | Certificate is explicitly labelled as a learning certificate and is not represented as a professional credential                                                                             | No signature, server-side verification or revocation is implemented.                                                                                                                             |
| Malicious uploads                       | JSON import is size-limited and normalized. Account progress payloads are size-bounded, schema-validated, account-scoped, and never cached by the service worker                             | Client-side validation is not tamper-proof; there are no file uploads. Add validation and malware-handling controls if attachments are introduced.                                               |
| Transport / browser policy weaknesses   | Same-origin CSP and security headers; HSTS is sent on HTTPS requests                                                                                                                         | TLS termination and secure-cookie configuration are deployment responsibilities. HSTS will not be emitted when TLS is terminated upstream unless the trusted proxy communicates HTTPS correctly. |
| Dependency or secret exposure           | `npm audit`, `pip-audit`, Bandit and Gitleaks are included in CI                                                                                                                             | Scanner results do not replace review; keep dependencies and scanner actions current.                                                                                                            |

## Security boundaries for planned features

Research exports must use random participant codes and exclude direct
identifiers. Study consent and withdrawal must be recorded before collecting
study responses. No study data should be uploaded without the configured
instructor/admin controls and an explicit participant consent flow.

Simulated phishing drills remain inside the application by default. Never collect
credentials or free-form values from a simulated sign-in page. Email delivery
must remain disabled unless a separate, reviewed consent and opt-out design is
implemented.

## Verification

Automated checks cover API CSRF requirements, rate limits, score bounds, teacher
report authorization, static-file allowlisting, response security headers and
HTTPS-only HSTS behavior. Further route-level tests are required as new server
features are added. See [SECURITY.md](./SECURITY.md) for reporting instructions.
