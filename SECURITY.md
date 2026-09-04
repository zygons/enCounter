# Security Policy

## Supported Versions

enCounter is currently Alpha / pre-release software.

Security fixes will generally be applied to the latest published Alpha or Beta release.

| Version | Supported |
| --- | --- |
| Latest Alpha / Beta release | Yes |
| Older pre-release versions | No |
| Unreleased development branches | Best effort |

Users are encouraged to update to the latest available release before reporting a security issue that may already have been corrected.

## Reporting a Security Vulnerability

Please do **not** report security vulnerabilities through public GitHub Issues, Discussions, pull requests, or other public channels.

### Preferred method

Use GitHub's **Private Vulnerability Reporting** feature for this repository.

After private vulnerability reporting is enabled, use:

**Security → Report a vulnerability**

This allows the report and any follow-up discussion to remain private between the reporter and the project maintainer.

### Alternate contact

If GitHub Private Vulnerability Reporting is unavailable, contact the project maintainer privately at:

**encounterapp.project@gmail.com**

Please include, when possible:

- affected enCounter version
- operating system
- browser
- steps required to reproduce the issue
- expected and observed behavior
- potential security impact
- relevant logs or screenshots that do not contain sensitive personal data
- any suggested mitigation or fix

Please do not include passwords, access tokens, private campaign data, personal information, or other unnecessary sensitive material.

## What to Expect

Security reports will be reviewed as reasonably practical for a small, independently maintained open-source project.

The maintainer may:

- request additional information
- attempt to reproduce the issue
- develop and test a fix
- prepare an updated release
- coordinate public disclosure when appropriate

There is currently no guaranteed response or remediation timeframe.

## Scope

enCounter is local-first software. The current launcher binds its local HTTP server to `127.0.0.1`.

The local HTTP layer is intended to expose only the application, public notices, and supported asset files needed by enCounter. Runtime backup data and development/build files should not be browser-accessible.

Security reports are welcome for issues involving:

- unintended network exposure
- local HTTP server behavior
- cross-origin access
- path traversal or unintended local file access
- backup, export, import, or restore handling
- browser IndexedDB storage
- uploaded or imported asset handling
- packaged runtime dependencies
- privilege or permission issues
- exposure of private campaign, Library, or backup data
- malicious files causing unintended execution or file access

## Out of Scope

The following generally are not considered security vulnerabilities by themselves:

- the Windows Alpha executable being unsigned
- Windows SmartScreen or unknown-publisher warnings
- a user intentionally sharing an export, backup, or asset file
- access by someone who already has unrestricted access to the user's local computer and files
- issues that require modifying enCounter's source code or packaged files before launching it, unless they reveal a broader security weakness

## Disclosure

Please allow the maintainer a reasonable opportunity to investigate and, where appropriate, prepare a fix before publicly disclosing technical details that could put users at risk.