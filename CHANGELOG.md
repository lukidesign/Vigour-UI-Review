# Changelog

All notable changes to Vigour UI Review are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

Source-only development update; no new downloadable release or store approval is implied. Existing v0.0.1 artifacts are unchanged. See [delivery status](docs/DELIVERY-STATUS.md) for acceptance gates.

### Added

- Native Messaging host with constrained commands, exact extension-origin pairing, process reuse, one-time workbench tickets, and idle lifecycle management.
- Apple Silicon graphical companion installer with payload verification, install/update/repair, same-schema rollback, and data-preserving uninstall.
- Extension icons, bilingual store copy, actual synthetic-demo screenshots, privacy disclosures, and private-beta checklists.
- Regression coverage for capture cancellation, Native framing/session lifecycle, installer ownership, and workbench authentication.

### Changed

- Standardize publisher and project copyright attribution as LukiDesign; retain Vigour UI Review as the product name.
- New-source workbench and extension credentials use session storage; normal Native pairing does not require manual token copying.
- Link the known store draft ID and distinguish source development from the legacy downloadable package.
- Include store-material validation in the basic release-check pipeline; Native and installer integration remain separate gates.
- Automatically normalize development screenshots when their aspect ratio differs from the design by at most 1%, without modifying the original asset.
- Show the original size, target size, and scale used by automatic normalization in the workbench.

### Fixed

- Bind capture to the initiating document and viewport; cancel safely on navigation, tab changes, timeout, or user cancellation, with page restoration safeguards.
- Keep side-by-side image edges reachable and preserve horizontal access when zooming the canvas.
- Replace the opaque `ANALYSIS_FAILED` response for incompatible images with a structured size and aspect-ratio explanation.
- Reject aspect-ratio differences over 1% before creating a failed run.
- Prevent normal packaged-app startup from writing Python bytecode caches into the installation directory.

### Planned

- Real Chrome toolbar capture-to-export acceptance and clean-machine companion installation.
- Coordinated beta package versions, fixed store-ID pairing, download URL and SHA-256.
- Real elapsed idle/sleep tests, minimum macOS verification, and installation fault recovery.
- Narrow-screen layout and complete English UI; Windows and Intel Mac remain outside the first beta.
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
