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

Current public testing targets are macOS 14+ Apple Silicon and Windows x64 in v0.0.2-beta.1. Windows 11 real-machine acceptance remains pending. See the [installation guide](../docs/INSTALL.md) and [delivery status](../docs/DELIVERY-STATUS.md); passing CI does not imply platform acceptance.

See the [repository layout](../docs/architecture/REPOSITORY.md), [documentation index](../docs/README.md), and [script index](../scripts/README.md) before adding new files. Keep package/runtime configuration at its discovery location; preserve published entry points unless a migration is explicitly planned.

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
