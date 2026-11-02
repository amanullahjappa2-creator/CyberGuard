# CyberGuard Threat Model

## Scope and trust boundaries

The current product is a static, offline-first browser game plus an optional
Flask/SQLite scoreboard. The client owns level logic and local progress. The
server accepts nickname-based score summaries and exposes public leaderboard
data; teacher-token-protected routes expose class reports. There are no learner,
instructor or administrator accounts, and there is no authenticated exam system.

The browser, imported progress files, HTTP request bodies, URL/query parameters,
nicknames and class codes are untrusted. Production deployments must terminate
TLS and set `CYBERGUARD_COOKIE_SECURE=1`. The development server binds to
localhost by default and is not a production server.

## Assets

- Learner progress, preferences and certificate details stored in browser
  localStorage.
- Scoreboard nicknames, scores, completed-level numbers, aggregate skill/level
  statistics, class codes, and teacher-token hashes in SQLite.
- The raw teacher token returned once when a class is created.
- Static level content, translation files and client-side answer/fix data.
- CI credentials and repository write access.

## Actors and entry points

- Learners using the offline application, local storage and progress import.
- Teachers creating classes and accessing class reports with a bearer token.
- Anonymous callers submitting score data or querying public leaderboards.
- A person with access to the browser profile, SQLite file, deployment, or
  repository.
- Entry points: static HTML/JavaScript/JSON routes; `/api/csrf`,
  `/api/health`, `/api/classes`, `/api/score`, `/api/leaderboard`,
  `/api/classes/<code>/report`, and `/api/classes/<code>/export.csv`.

## Threats and current mitigations

| Threat                                  | Current mitigation                                                                                                                                                                  | Remaining limitation                                                                                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account takeover or teacher-token theft | Random bearer tokens are returned at class creation; only SHA-256 token hashes are stored; reports compare hashes in constant time; HttpOnly and SameSite=Lax Flask session cookies | No teacher login, token rotation/revocation, session inventory or account recovery exists. The token must be protected by HTTPS and kept private.                                                |
| CSRF                                    | State-changing scoreboard endpoints require a same-session synchronizer token in `X-CSRF-Token`                                                                                     | No authenticated account flows exist; CSRF coverage must be extended to every future mutation.                                                                                                   |
| Brute force or request flooding         | Per-IP/per-endpoint process-local rate limits and request-body size limits                                                                                                          | Limits reset on restart and do not coordinate across workers; use a shared production limiter before deployment.                                                                                 |
| XSS and unsafe content                  | UI renders user and level strings with DOM text APIs; CSP restricts scripts to same-origin and disallows objects and framing                                                        | `style-src 'unsafe-inline'` remains for dynamically sized progress UI; review any future HTML renderer and trusted content.                                                                      |
| Injection                               | SQLite statements use parameter binding; class codes, nicknames and numeric summaries are validated                                                                                 | Add tests for every new query and input surface. CSV formula injection must be considered if arbitrary user strings are ever exported.                                                           |
| IDOR / unauthorized class reports       | Report and CSV routes require the class's teacher bearer token                                                                                                                      | Class creation is currently public and learner class membership is not an authenticated relationship. Class codes are not authorization credentials.                                             |
| Score tampering / cheating              | Server rejects impossible totals, duplicate or invalid completed levels, and invalid aggregate statistics                                                                           | Scores and aggregates are still client-submitted and cannot be proven legitimate. There is no authoritative event validation or exam answer boundary.                                            |
| Answer leakage                          | Scenario feedback is local and shown after user selection                                                                                                                           | All answer/fix logic is shipped to the browser; this is a learning game, not a secure assessment system.                                                                                         |
| Certificate forgery                     | Certificate is explicitly labelled as a learning certificate and is not represented as a professional credential                                                                    | No signature, server-side verification or revocation is implemented.                                                                                                                             |
| Malicious uploads                       | JSON progress import is size-limited and normalized; the server does not accept file uploads                                                                                        | Add validation and malware-handling controls if research attachments or other uploads are introduced.                                                                                            |
| Transport / browser policy weaknesses   | Same-origin CSP and security headers; HSTS is sent on HTTPS requests                                                                                                                | TLS termination and secure-cookie configuration are deployment responsibilities. HSTS will not be emitted when TLS is terminated upstream unless the trusted proxy communicates HTTPS correctly. |
| Dependency or secret exposure           | `npm audit`, `pip-audit`, Bandit and Gitleaks are included in CI                                                                                                                    | Scanner results do not replace review; keep dependencies and scanner actions current.                                                                                                            |

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
