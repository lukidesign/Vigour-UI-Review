# Changelog

All notable changes to Vigour UI Review are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- Human-labeled production Web benchmark.
- Signed and notarized macOS package.
- Chrome Web Store distribution.

## [0.0.1] - 2026-08-28

### Added

- Local position, size, color, missing, extra, and optional OCR difference detection.
- Chrome MV3 viewport and full-page capture with DOM/computed-style metadata.
- Three-column Vue workbench with annotation, side-by-side, and overlay comparison modes.
- Project history, severity/type filters, role views, scoring, and issue state updates.
- PNG, Markdown, and JSON export.
- Figma PAT Frame import with semantic node extraction.
- Optional OpenAI, Gemini, Kimi, and DeepSeek explanations with one-time consent receipts.
- Nine preset themes and a custom theme editor.
- Portable macOS Apple Silicon developer package with bundled Node.js, Python, and OCR dependencies.
- Safe migration from legacy Design Acceptance 2.0 data and Keychain entries.

### Security

- Loopback-only service, bearer token, CSRF protection, and Origin allowlist.
- Input, path, image, Figma download, AI payload, and response limits.
- macOS Keychain storage for all optional external-service credentials.

### Known limitations

- Unsigned Apple Silicon developer preview.
- Synthetic regression benchmark only; real-page quality has not yet been measured.

[Unreleased]: ../../compare/v0.0.1...HEAD
[0.0.1]: ../../releases/tag/v0.0.1
