# Release process

Vigour UI Review uses tag-triggered GitHub Releases.

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
