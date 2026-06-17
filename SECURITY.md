# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `main` branch | Yes |
| Older releases | No — please upgrade |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by emailing **support@tptsolutions.co.nz** with the subject line `[SECURITY] tpt-production — <brief description>`.

Include in your report:
- Description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept if possible)
- Any suggested mitigations

You can expect an acknowledgement within **48 hours** and a status update within **7 days**.

## Disclosure Policy

We follow responsible disclosure:

1. Report received → acknowledged within 48 h
2. We investigate and confirm the issue
3. We develop and test a fix
4. Fix is merged and a new release is tagged
5. A security advisory is published in GitHub after the fix is released

We ask that you give us reasonable time to address the issue before any public disclosure.

## Security Controls

The following controls are implemented in this project:

- **Rate limiting**: 120 requests/minute per IP on all API endpoints
- **CORS**: Strict origin whitelist via `ALLOWED_ORIGINS` environment variable
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, CSP
- **Input validation**: Zod schemas on every API route via `@hono/zod-openapi`
- **SQL injection**: Prisma ORM with parameterised queries throughout
- **API key hashing**: SHA-256; raw key is never stored or returned after creation
- **Webhook verification**: HMAC-SHA256 signature validation with constant-time comparison
- **Stripe webhooks**: Verified via `STRIPE_WEBHOOK_SECRET`
- **File uploads**: MIME type allowlist + 100 MB size limit

## Known Limitations (by design)

- Consumer identity is not authenticated by default — this is feature-gated and documented. Enabling `ENABLE_PAYMENTS` or `ENABLE_CREDITS` enforces payment/credit gating before order placement.
- The dev Docker Compose (`docker-compose.yml`) runs PostgreSQL and Redis without passwords — this is intentional for local development only. Production uses `docker-compose.prod.yml` which requires secrets via environment variables.
