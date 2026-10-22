# Changelog

All notable changes to Vigour UI Review are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

No additional unreleased changes recorded.

## [0.0.2-beta.4] - 2026-10-23

Apple Silicon-only unsigned preview refresh, **macOS 14.5+**, with app/extension version 0.0.2. Retains PaddleOCR dependencies and includes shared fractional-DPR stitching, capture-processing status, Markdown-export and OCR-capability fixes. The locked Paddle binaries require 14.5; Intel core-only remains 14.0.

Native arm64 CI covers sealed-package checks, architecture/deployment targets, core analysis, OCR dependency availability and checksum-pinned beta.1-to-current isolated data migration. Same-schema rollback, repair and data-preserving uninstall are checked separately; direct downgrade of migrated data to beta.1 is not guaranteed. Real Chrome, clean-machine, minimum-OS, idle/sleep and offline OCR acceptance remain pending. Windows beta.2, Intel beta.3 and all old assets are preserved; Windows 11 retesting remains pending. See [beta.4 notes](docs/releases/v0.0.2-beta.4.md) and [delivery evidence](docs/DELIVERY-STATUS.md).

Documentation follow-up (2026-10-23): synchronize published platform downloads, installation/testing instructions and delivery evidence for Intel beta.3, Windows beta.2 and Apple Silicon beta.1. No runtime, version, tag or existing release-asset changes; real-machine acceptance remains pending as documented.

## [0.0.2-beta.3] - 2026-10-22

Published Intel Mac core-only preview, macOS 14+ x64. Independent native CI build and matched extension; no local OCR. Binary architecture/deployment checks, isolated lifecycle testing, explicit payload platform validation, and actual OCR capability reporting. Intel user-machine/minimum-OS acceptance remains pending; unsigned/unnotarized. Windows beta.2 and Apple Silicon beta.1 assets are unchanged; Windows 11 retesting remains pending. See [release notes](docs/releases/v0.0.2-beta.3.md) and [delivery evidence](docs/DELIVERY-STATUS.md).

## [0.0.2-beta.2] - 2026-10-22

Windows-only unsigned test refresh; app and extension still display 0.0.2. Use only matching assets from this build. **Windows 11 real-machine retesting remains pending.** macOS beta.1 and all previous release assets remain unchanged.

- Preserve actual raster pixels when stitching fractional-DPR captures; retain dimension, coverage and image-limit validation.
- Persist capture processing status and safe error codes; do not report a saved but unusable capture as successful.
- Repair Windows pairing to the supplied extension ID using a reversible configuration switch.
- Harden Windows uninstall completion, interrupted cleanup and stale-lock recovery; add phase diagnostics. The reported nine-minute hang still requires Windows 11 retesting, not a confirmed root-cause closure.
- Export Markdown with issue coordinates, qualified local suggestions and portable PNG evidence references.
- Add adversarial regression tests and isolated capture-recovery UI checks. See [fix verification and retest checklist](docs/WINDOWS-FIX-VERIFICATION.md).

## [0.0.2-beta.1] - 2026-10-19

Unsigned public prerelease for macOS Apple Silicon and Windows x64; application and extension versions are 0.0.2. **Windows 11 real-machine testing remains pending.** Existing v0.0.1 assets are unchanged. See [beta notes](docs/releases/v0.0.2-beta.1.md) and [delivery status](docs/DELIVERY-STATUS.md). This release does not imply signing, notarization, stable-platform acceptance or store approval.

### Added

- Native Messaging host with constrained commands, exact extension-origin pairing, process reuse, one-time workbench tickets, and idle lifecycle management.
- Apple Silicon graphical companion installer with payload verification, install/update/repair, same-schema rollback, and data-preserving uninstall.
- Windows x64 current-user companion installer and matched 0.0.2 tester-candidate staging for public Beta delivery; Windows 11 user acceptance remains pending.
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
- Align the macOS installer deployment target and minimum-system metadata at 14.0; prevent prerelease tags from invoking the stable Release publisher.

### Planned

- Clean-machine companion installation and Windows 11 real Chrome capture-to-export acceptance. macOS maintainer-machine capture-to-export passed on October 19.
- Chrome store distribution and matching store-ID pairing (the Beta uses actual unpacked extension IDs).
- Real elapsed idle/sleep tests, minimum macOS verification, and installation fault recovery.
- Narrow-screen layout and complete English UI; Intel Mac remains outside this beta.
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
