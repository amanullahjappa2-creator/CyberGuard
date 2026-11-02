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

The optional service is a nickname scoreboard, not an account or exam platform.
It has no authenticated learner/instructor accounts, password reset, TOTP,
global logout, signed certificate verification/revocation, or server-verifiable
exam evidence. Client-submitted scores are sanity-checked, not cryptographically
proven. Do not rely on the current service for high-stakes assessment or sensitive
student records.

For production, deploy behind HTTPS, configure a strong persistent
`CYBERGUARD_SECRET_KEY`, set `CYBERGUARD_COOKIE_SECURE=1`, use a shared
rate-limiter across workers, and protect the SQLite database and teacher tokens.
The built-in Flask development server is for local use only.
