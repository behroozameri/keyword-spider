# Security Policy

## Supported versions

Security fixes are applied to the latest released version of Keyword Spider.

## Reporting a vulnerability

Please do not disclose security vulnerabilities in a public issue.

Use [GitHub's private vulnerability reporting](https://github.com/behroozameri/keyword-spider/security/advisories/new) to describe the issue, its impact, and a minimal reproduction. Remove personal page content, cookies, credentials, and authentication tokens from all reports.

You should receive an initial response within seven days. Confirmed issues will be prioritized based on impact, and a coordinated disclosure date will be agreed upon when appropriate.

## Security principles

Keyword Spider is designed to:

- Process page content locally.
- Request only temporary `activeTab` access and the `scripting` permission.
- Avoid remote code, analytics, trackers, and external APIs.
- Keep browser profiles, generated results, and recordings outside version control.
