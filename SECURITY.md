# Security Policy

CyberGuard is an educational simulation. Do not use it to test real systems,
collect credentials, or send messages to people outside a class that has
explicitly opted into a future in-platform drill.

## Reporting a vulnerability

Please do not publish exploit details in a public issue. Report suspected
vulnerabilities privately through GitHub's Security Advisories for this
repository. Include the affected commit or version, impact, and concise
reproduction steps. Do not include real student data, credentials, or other
personal information.

The maintainers will acknowledge a report and coordinate a fix and disclosure
timeline. This project is maintained on a best-effort basis; no response-time
guarantee is implied.

## Current security limitations

The service now has student registration/login APIs using scrypt password hashes,
versioned SQLite migrations, teacher-owned class/report endpoints, and student
class-membership requests with teacher approval. Teacher registration requires a
deployment-configured invitation code. There is no email
verification, password reset, TOTP, server-side session revocation, or admin
provisioning. Legacy bearer-token classes remain separate from the new ownership
model and are not migrated to accounts. Client-submitted scores are sanity-checked,
not cryptographically proven; there is no signed certificate verification/revocation
or server-verifiable exam evidence. Do not rely on the current service for high-stakes
assessment or sensitive student records.

For production, deploy behind HTTPS, configure a strong persistent
`CYBERGUARD_SECRET_KEY`, set `CYBERGUARD_COOKIE_SECURE=1`, use a shared
rate-limiter across workers, protect the teacher invitation code, configure account
recovery and abuse monitoring, and protect the SQLite database and legacy teacher
tokens. The current rate limiter is process-local. The built-in Flask development
server is for local use only.
