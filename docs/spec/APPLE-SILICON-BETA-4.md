# Apple Silicon beta.4 refresh

## Problem Statement

The published October 19 Apple Silicon beta.1 predates shared capture-stitching, processing-state, Markdown-export and OCR-capability fixes now on main. M-series Mac testers need a matching installer and extension incorporating these fixes.

## Proposed Solution

User-approved scope (2026-10-23): rebuild macOS 14+ arm64 from main and publish a distinct unsigned `v0.0.2-beta.4` prerelease, preserving beta.1, Windows beta.2 and Intel beta.3 assets. Keep application/extension version 0.0.2 and record immutable source/run/checksums. Retain the existing PaddleOCR dependency profile; this is not the Intel core-only package.

## Technical Constraints

- Use a native arm64 runner, frozen dependencies, existing installer and data-preserving update mechanism.
- Verify runtime/installer architecture, deployment target, sealed payload, matching extension and executable/symlink preservation.
- Importing OCR dependencies is not OCR recognition or offline-model acceptance. Do not silently remove OCR or claim model availability.
- Tests use temporary data and isolated Native registration, never the maintainer's Chrome profile or secrets.

## Non-goals

Stable release, code signing/notarization, store submission, replacing other platform assets, alternative OCR, feature redesign and claiming clean-machine or real Chrome acceptance from CI.

## Success Criteria

- Adversarial review before tests; source checks and native arm64 packaging pass.
- Bundled core analysis, actual OCR dependency availability, Native startup and isolated install/update/repair/uninstall pass.
- Upgrade from the checksum-verified published beta.1 preserves synthetic project, capture, analysis and evidence; test same-schema rollback separately, not downgrade of migrated data to beta.1.
- Published installer ZIP contains matching extension, guide, provenance and checksums; re-download and verify before making the draft public.
- Refresh platform download documentation after publication. Windows 11 retesting, Intel acceptance and Apple Silicon clean-machine/minimum-OS/real Chrome/idle/sleep/offline OCR checks remain explicitly pending unless actually performed.
