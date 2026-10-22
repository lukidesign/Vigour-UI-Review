# Release process

Vigour UI Review uses tag-triggered GitHub Releases.

## Windows prerelease refresh (beta.2)

For this unsigned Windows-only refresh, keep the internal application/extension version 0.0.2 and use a new immutable prerelease tag `v0.0.2-beta.2`. The stable macOS tag workflow intentionally skips prerelease tags.

1. Submit a scoped PR; do not include unrelated local website work. Run adversarial review and `pnpm release:check` before publishing.
2. Wait for source verification and the Windows Server 2022 CI job (payload checks, smoke tests, installer compilation, candidate staging).
3. Merge only when checks pass. Prefer the completed main-branch build so `CANDIDATE.json.sourceCommit` is exactly the release tag commit.
4. Download the candidate artifact, verify every entry of its internal `SHA256SUMS.txt`, and confirm the installer hash, extension version, source commit, candidate tag and `windows11Acceptance: pending`.
5. Package the complete candidate plus a separate ZIP of the exact same extension directory. Generate external SHA-256 and provenance records. Create a draft prerelease, upload and re-download/verify the files, then publish as prerelease with Latest disabled.
6. Keep all beta.1/macOS and v0.0.1 assets unchanged. Windows 11 real-machine retesting stays pending; CI is not GUI acceptance, signing or store approval.

## Prerequisites

- The repository is public and GitHub Actions is enabled.
- GitHub Private Vulnerability Reporting is enabled in repository settings.
- `main` is protected and required checks pass.
- The version in all manifests matches the intended tag without the `v` prefix.

## Publish a release

1. Update `CHANGELOG.md` and all manifest versions.
2. Run `pnpm release:check` on macOS Apple Silicon.
3. Commit the release change and merge it to `main`.
4. Create and push an annotated tag:

   ```bash
   git tag -a v0.0.1 -m "Vigour UI Review v0.0.1"
   git push origin v0.0.1
   ```

5. The release workflow verifies the tag/version match, runs tests, builds the complete offline package, rejects absolute links and build-machine path leaks, performs an end-to-end smoke test, creates a ZIP and SHA-256 file, and uploads both to a GitHub Release.
6. Download the published assets, verify the checksum on a separate Apple Silicon Mac, and follow the installation guide once before announcing the release.

The package is unsigned in `v0.0.1`. Do not describe it as notarized or suitable for managed enterprise deployment.
