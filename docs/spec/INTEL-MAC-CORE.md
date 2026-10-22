# Intel Mac core-only preview

## Problem Statement

The existing macOS installer only targets Apple Silicon. Intel Mac users cannot run its bundled runtimes, and the locked PaddlePaddle 3.3.1 dependency does not provide macOS x86_64 wheels.

## Proposed Solution

User-approved scope (2026-10-22): provide a separate macOS 14+ Intel x64 unsigned preview with matching Chrome extension, viewport/full-page capture, core image comparison and PNG/Markdown/JSON export. Do not bundle local OCR. Build on an Intel CI runner, verify actual binary architectures and capabilities, and publish a distinct prerelease without replacing existing assets.

## Technical Constraints

- Reuse the shared application and installer; keep architecture selection explicit and reject mismatched payloads.
- Bundle x64 Node, Python, native host and Swift installer. Resolve Python core dependencies from the committed lock with hashes; no developer runtimes required on the target machine.
- Preserve project data and credentials during update/uninstall. Keep loopback-only service and actual-extension-ID pairing.
- Do not claim signing, notarization, store approval, minimum-OS testing or Intel real-machine acceptance from CI.

## Non-goals

Local OCR, alternative OCR engines, universal binaries, macOS below 14, Apple Silicon/Windows repackaging, and changes to existing release assets are excluded.

## Success Criteria

- Adversarial review precedes tests; unit tests cover both architectures and wrong-architecture rejection.
- Intel CI verifies core offline analysis, unavailable OCR capability, Native protocol and isolated install/update/rollback/repair/uninstall with user-data preservation.
- Installer and runtime architecture checks pass; downloadable ZIP preserves executability/symlinks and contains the matching extension, guide, provenance and SHA-256 checksums.
- Release explicitly says unsigned/core-only/no local OCR; Intel real-machine and Windows 11 retesting remain pending.
