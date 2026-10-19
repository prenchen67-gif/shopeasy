This branch updates several direct dependencies to safer minor releases to reduce known vulnerabilities.

Changes proposed:
- bcrypt -> ^5.1.1
- better-sqlite3 -> ^9.1.1
- express -> ^4.19.2
- jsonwebtoken -> ^9.0.2
- helmet -> ^7.0.0
- express-rate-limit -> ^7.0.0

After merging, run:

    npm install
    npm audit

If any transitive vulnerabilities remain, we'll follow up with targeted fixes or overrides.
