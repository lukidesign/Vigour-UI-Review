# Vigour UI Review

[简体中文](README.zh-CN.md) · [Product specification](docs/spec/PRODUCT_SPEC.md) · [Architecture](docs/architecture/TECHNICAL_ARCHITECTURE.md) · [Security](docs/SECURITY.md)

Vigour UI Review is a local-first visual acceptance workbench for comparing a Web implementation with its design source. It detects and quantifies position, size, color, missing, extra, and optional OCR text differences, then turns them into reviewable issues and exportable evidence.

> **v0.0.2-beta.1 — unsigned public prerelease for macOS Apple Silicon and Windows x64.** The application and extension display **0.0.2**. **Windows 11 real-machine acceptance is pending.** This is not a stable or signed release; v0.0.1 is preserved. Download only the assets listed on the [beta release page](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1); source integration alone does not publish an installer.

## v0.0.2 development update

The v0.0.2 source includes:

- A collapsed-by-default project sidebar, updated product mark and version display, centered zoom controls, and clearer first-run/review states.
- Issue annotations in all three comparison modes, a shared visibility switch, and marker-to-issue navigation.
- Export and AI actions beside the issue list. Problem explanations and component business-logic inference share a dialog with task-specific context, results, and per-request consent.
- Guided connection recovery, Native Messaging on-demand startup, and one-time workbench pairing.
- Rebuilt macOS Apple Silicon companion/graphical installer and a Windows 11 x64 unsigned tester candidate.

These changes are **not included in the v0.0.1 download**. Use the matching extension and companion from the same build.

### Downloads and build status

| Version / platform | Status | Access |
| --- | --- | --- |
| v0.0.2-beta.1 Windows x64 | Unsigned test installer + matching extension; Windows 11 real-machine acceptance pending | [Beta downloads](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1) |
| v0.0.2-beta.1 macOS Apple Silicon | Unsigned graphical installer + matching extension; local Chrome workflow verified | [Beta downloads](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1) |
| v0.0.1 macOS Apple Silicon | Previous unsigned developer preview | [Published release](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.1) |

Use the Release assets for persistent downloads; Actions artifacts are temporary build evidence (seven-day retention). Read the [installation guide](docs/INSTALL.md), [Windows tester guide](docs/WINDOWS-TESTER-GUIDE.md), and [beta notes and limitations](docs/releases/v0.0.2-beta.1.md) before installation. Do not disable operating-system security protections to install an unsigned package.

### Additional verification — October 19, 2026

- The integrated application passed 135 JS/TS tests, 11 Python tests, builds and the synthetic baseline; production dependency audit reported no known vulnerabilities.
- The rebuilt macOS application passed integrity, offline analysis, isolated Native and installer lifecycle checks. Real Chrome pairing, viewport/full-page capture, analysis, all three annotation modes and PNG/Markdown/JSON export passed on the maintainer's Mac.
- Windows CI uses Windows Server 2022, not a Windows 11 user PC. Windows 11 installation, real Chrome capture, lifecycle and offline OCR acceptance remain pending.

### Verification — October 12, 2026

- 127 JavaScript/TypeScript tests, 11 Python tests, type checks, and production builds passed.
- The synthetic visual baseline matched all 500 annotated differences across 50 pairs; this is not a real-page production accuracy claim.
- macOS package integrity/private-path checks, offline analysis, Native integration, and isolated install/update/rollback/repair/uninstall tests passed.
- [GitHub CI](https://github.com/lukidesign/Vigour-UI-Review/actions/runs/38237762236) passed source verification, production dependency audit, Windows offline analysis and Native/credential smoke tests, and GUI installer packaging.

See the [delivery record](docs/DELIVERY-STATUS.md) and [changelog](CHANGELOG.md). Installers remain unsigned; notarization, clean-machine/minimum-macOS installation and sleep/idle acceptance remain pending. Store draft ID `dmkfgmpbomjjhalgnfhcpalobdnklchh` does not indicate store approval or availability; unpacked extensions must be paired using their actual Chrome ID.

![Vigour UI Review workbench](docs/assets/workbench-overview.jpg)

*Earlier workbench screenshot using synthetic demo data; it does not show the v0.0.2 UI refinements above.*

## Highlights

- Local OpenCV/PaddleOCR analysis; AI is not required for detection or scoring.
- Chrome Manifest V3 capture for the current viewport or full page.
- Three comparison modes: annotated implementation, side by side, and opacity overlay.
- Fixed project/canvas/issue three-column workbench.
- Plain-language, pixel-level issue descriptions and severity grouping.
- PNG, Markdown, and JSON export.
- Figma Frame import using a minimal-scope Personal Access Token.
- Optional OpenAI, Gemini, Kimi, and DeepSeek explanations with one-time consent receipts.
- Nine built-in themes plus custom theme import, editing, copying, and export.
- Credentials stored in the macOS Keychain; the local API binds to `127.0.0.1` only.

## Install the previous v0.0.1 preview

1. Download `Vigour-UI-Review-v0.0.1-macos-arm64.zip` and its `.sha256` file from [GitHub Releases](../../releases/latest).
2. Verify the checksum:

   ```bash
   shasum -a 256 -c Vigour-UI-Review-v0.0.1-macos-arm64.zip.sha256
   ```

3. Extract the ZIP. Because `v0.0.1` is unsigned, Control-click `start.command` and choose **Open** on first launch.
4. Wait for the browser to open `http://127.0.0.1:4179/`. A first OCR cold start can take about 30 seconds.

To install the Chrome capture extension, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the package's `chrome-extension/` directory. See the [installation guide](docs/INSTALL.md) for token pairing and troubleshooting.

## Build from source

Use this v0.0.2 source tree for the commands below. Windows builders should follow the [Windows build guide](docs/WINDOWS-BETA-STATUS.md).

Requirements:

- macOS 14+ on Apple Silicon
- Node.js 24+
- pnpm 11+
- [uv](https://docs.astral.sh/uv/)

```bash
pnpm install --frozen-lockfile
uv sync --project apps/vision-engine --python 3.12 --extra dev --extra ocr --frozen
pnpm release:check
pnpm start:local
```

Create the macOS offline package (also requires a Rust compiler for the v0.0.2 Native Host):

```bash
pnpm package:dev
pnpm package:check
pnpm package:smoke
pnpm package:archive
```

Generated dependencies, virtual environments, benchmark output, and release packages are intentionally excluded from Git.

## Demo data

The synthetic pair in [`examples/demo`](examples/demo) contains no user or third-party product data. Upload `design.png` as the design source and `implementation.png` as the implementation image to exercise the local workflow.

## Privacy model

Core comparison is offline. The application has no telemetry. Figma and AI integrations are optional and require user-supplied credentials. Before an AI request, the UI identifies the provider, model, task, selected issues, and whether an image will be included; the resulting consent receipt expires after ten minutes and can be consumed only once.

Runtime data is stored in:

```text
~/Library/Application Support/Vigour UI Review/
```

On first launch, legacy `Design Acceptance 2.0` data is copied atomically to the new directory while the legacy directory is preserved for recovery. See [Privacy](docs/PRIVACY.md) and [Security](docs/SECURITY.md).

## Known limitations

- The v0.0.1 release supports macOS Apple Silicon only. v0.0.2 adds a Windows 11 x64 test candidate; ordinary Windows 11 user installation has not yet been accepted. macOS Intel builds are unavailable.
- The developer package is not signed or notarized.
- The Chrome extension is not yet published in the Chrome Web Store.
- Current UI is primarily Chinese; English listing copy is not an English UI. Desktop checks cover 1920 and 1440 pixel widths; 900/720 widths still overflow.
- The current benchmark is synthetic; a human-labeled real-page benchmark remains required.
- Canvas, WebGL, video internals, cross-origin iframes, and interaction replay are outside `v0.0.1` scope.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first. Report security vulnerabilities privately as described in [SECURITY.md](docs/SECURITY.md).

## License

Copyright © 2026 LukiDesign. Released under the [MIT License](LICENSE).
