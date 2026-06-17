# Contributing to TPT Production

Thank you for your interest in contributing. This document covers the process for submitting changes.

## Getting Started

1. Fork the repository and clone your fork.
2. Follow the [Quick Start](README.md#quick-start) to get a working dev environment.
3. Create a branch: `git checkout -b feat/your-feature` or `fix/your-fix`.

## Development Guidelines

### Code Style

- **Formatter**: Prettier — 100-char width, double quotes, 2-space indent. Run `pnpm format` before committing.
- **Linter**: ESLint. Run `pnpm lint` and fix all warnings before opening a PR.
- **TypeScript**: Strict mode is enabled everywhere. No `any` without a justified comment.
- **Comments**: Only when the *why* is non-obvious. Don't describe what the code does.

### Tests

- New business logic in `packages/core` must have unit tests (Vitest).
- New API endpoints in `apps/api` must have integration tests.
- Run tests with `pnpm --filter @tpt/core test` and `pnpm --filter @tpt/api test`.
- All existing tests must pass before a PR is merged.

### Feature Flags

Any feature that touches credits, DRM, payments, price decay, or AI agents **must** be gated behind the appropriate `ENABLE_*` flag in `packages/core/src/flags.ts`. Features must be fully functional with the flag off (graceful no-op).

### Database Schema Changes

- Add a new Prisma migration: `pnpm --filter @tpt/db migrate:dev --name describe_your_change`.
- Never edit existing migration files.
- If adding a required column to an existing table, provide a sensible default or make it optional.

### Security

- Never commit secrets, tokens, or credentials.
- All new endpoints must have Zod input validation via `@hono/zod-openapi`.
- Admin endpoints must require the `ADMIN_API_TOKEN` auth check.
- File uploads must validate MIME type and size.

## Pull Request Process

1. Ensure `pnpm lint`, `pnpm type-check`, and all tests pass locally.
2. Fill in the PR template with a summary of changes and test steps.
3. Reference any related issues with `Closes #123`.
4. PRs require at least one approving review before merge.
5. Squash-merge is preferred to keep history clean.

## Commit Sign-off

All commits must include a Developer Certificate of Origin sign-off:

```bash
git commit -s -m "feat: add price decay visualisation"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line certifying that you have the right to submit the contribution under the Apache 2.0 license.

## Reporting Issues

Use GitHub Issues. Include:
- Steps to reproduce
- Expected vs. actual behaviour
- Environment details (OS, Node version, relevant env flags)

For security vulnerabilities, see [SECURITY.md](SECURITY.md) instead.

## License

By contributing you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
