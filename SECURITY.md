# Security

## Reporting a security issue

Please avoid posting sensitive security details in a public issue until the maintainer has had a reasonable opportunity to review the report.

For the initial Alpha, use the repository's private security-reporting feature if enabled. If private reporting is unavailable, open a minimal issue stating that you have a potential security concern and ask the maintainer for a private contact method. Do not include exploit details, credentials, private user data, or other sensitive information in that public issue.

## Scope

enCounter is local-first software and the current launcher binds to `127.0.0.1`. The local HTTP layer is intended to expose only the application, public notices, and supported asset files; runtime backup files and development/build files should not be browser-accessible. Security reports involving local file handling, backup/import behavior, browser storage, packaged runtime dependencies, cross-origin access, or unintended network/file exposure are welcome.
