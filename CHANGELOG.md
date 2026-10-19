# Changelog

All notable changes to Vigour UI Review are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

Source-only development update; no new downloadable release or store approval is implied. Existing v0.0.1 artifacts are unchanged. See [delivery status](docs/DELIVERY-STATUS.md) for acceptance gates.

The unreleased source version is 0.0.2. Successful PR #10 builds may upload an unsigned Windows tester installer and matching unpacked extension as public-repository Actions artifacts with three-day retention. These are not permanent Release downloads or Windows 11 acceptance evidence.

### Added

- Native Messaging host with constrained commands, exact extension-origin pairing, process reuse, one-time workbench tickets, and idle lifecycle management.
- Apple Silicon graphical companion installer with payload verification, install/update/repair, same-schema rollback, and data-preserving uninstall.
- Windows 11 x64 current-user companion installer source and matched 0.0.2 tester-candidate staging; no permanent installer Release or Windows 11 user acceptance yet.
- Extension icons, bilingual store copy, actual synthetic-demo screenshots, privacy disclosures, and private-beta checklists.
- Regression coverage for capture cancellation, Native framing/session lifecycle, installer ownership, and workbench authentication.

### Changed

- Standardize publisher and project copyright attribution as LukiDesign; retain Vigour UI Review as the product name.
- New-source workbench and extension credentials use session storage; normal Native pairing does not require manual token copying.
- Replace the token-first disconnected-workbench dialog with guided extension recovery, keep manual token entry under developer diagnostics, and surface pairing failures inline.
- Clarify first-run analysis states, unify empty states and square zoom controls, move contextual AI actions into the issue header, and add a generated Vigour UI Review product mark with the current version in the title bar.
- Default the project sidebar to a compact icon rail with explicit accessible expand and collapse controls.
- Align the primary review action with the source cards, compact its state labels, normalize zoom controls, and colocate exports with the issue list.
- Show issue annotations in every comparison mode, with one accessible global visibility control and issue-list reveal on marker selection.
- Separate AI problem explanations from component-level business-logic inference within one focused dialog, progressively disclose provider settings, and present task-specific structured results with per-request consent.
- Refine workbench controls with centered zoom icons, a compact review action, a state-aware theme icon, and a larger product title.
- Link the known store draft ID and distinguish source development from the legacy downloadable package.
- Include store-material validation in the basic release-check pipeline; Native and installer integration remain separate gates.
- Automatically normalize development screenshots when their aspect ratio differs from the design by at most 1%, without modifying the original asset.
- Show the original size, target size, and scale used by automatic normalization in the workbench.

### Fixed

- Consume AI UI confirmation on every attempt; invalidate it when the provider, model, task, run, issue selection, image option, or dialog state changes. Snapshot the submitted context and suppress stale asynchronous results.
- Disclose that optional AI image input contains the complete annotated evidence image, not only the selected component, and describe both supported system credential stores.
- Patch production dependencies to Fastify 5.12.5, fast-uri 3.1.8/4.1.5, and brace-expansion 5.0.12; production audit reported no known vulnerabilities on October 19, 2026.
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
