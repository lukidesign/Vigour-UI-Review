# Contributing to Vigour UI Review

Thank you for helping improve Vigour UI Review.

## Before opening an issue

- Search existing issues first.
- Do not include private designs, screenshots, access tokens, API keys, session tokens, or customer data.
- Use GitHub Private Vulnerability Reporting for security issues; do not open a public security issue.

## Development setup

```bash
pnpm install --frozen-lockfile
uv sync --project apps/vision-engine --python 3.12 --extra dev --extra ocr --frozen
pnpm release:check
```

The supported runtime target for `v0.0.1` is macOS 14+ on Apple Silicon. TypeScript-only changes may be developed elsewhere, but release acceptance must pass on the supported target.

## Pull requests

1. Keep each pull request focused on one problem.
2. Add or update tests for behavior changes.
3. Update English and Chinese documentation when user-visible behavior changes.
4. Preserve the offline core and explicit-consent boundary for external services.
5. Run `pnpm release:check` before requesting review.
6. Confirm that generated files, local data, screenshots with private data, and credentials are not included.

Pull requests are reviewed for correctness, privacy, accessibility, regression risk, and consistency with the product specification.

## Commit messages

Use concise imperative messages. Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`, and `chore:` are encouraged but not required.

## License

By contributing, you agree that your contribution is licensed under the repository's MIT License.
