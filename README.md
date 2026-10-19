# Vigour UI Review

[简体中文](README.zh-CN.md) · [Downloads](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1) · [Installation](docs/INSTALL.md) · [Documentation](docs/README.md) · [Changelog](CHANGELOG.md)

A local-first visual acceptance workbench: compare a Web implementation with its design, review measurable differences, and export evidence.

![Vigour UI Review 0.0.2 — annotated implementation and issue list](docs/assets/workbench-overview.jpg)

*Current 0.0.2 workbench, captured with the real local analysis engine and public synthetic demo images. No customer data. [Screenshot provenance](docs/assets/workbench-overview.json).*

## Download and start

> **v0.0.2-beta.1 is an unsigned public prerelease**, not a stable release. The application and extension display **0.0.2**. **Windows 11 real-machine acceptance is pending.** macOS signing/notarization, clean-machine/minimum-version installation and sleep/idle acceptance also remain pending.

| Platform | Download | Verification boundary |
| --- | --- | --- |
| macOS 14+ · Apple Silicon | [Graphical installer](https://github.com/lukidesign/Vigour-UI-Review/releases/download/v0.0.2-beta.1/Vigour-UI-Review-Setup-v0.0.2-beta.1-macos-arm64-unsigned.zip) + [Chrome extension](https://github.com/lukidesign/Vigour-UI-Review/releases/download/v0.0.2-beta.1/Vigour-UI-Review-extension-v0.0.2.zip) | Core Chrome workflow checked on the maintainer’s Mac; not clean-machine acceptance |
| Windows · x64 | [Tester package](https://github.com/lukidesign/Vigour-UI-Review/releases/download/v0.0.2-beta.1/Vigour-UI-Review-v0.0.2-beta.1-windows-x64-unsigned.zip) | Windows Server CI checked; Windows 11 user-PC testing pending |

1. Download matching assets from the [beta release](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1), verify their checksums, and extract them.
2. In Chrome, load the unpacked extension folder and note its actual extension ID. Disable the old extension to avoid mixing versions.
3. Follow the platform installer/pairing steps, open the workbench, and import a design and implementation image to start a review.

Read the [installation guide](docs/INSTALL.md), [Windows tester guide](docs/WINDOWS-TESTER-GUIDE.md) and [beta limitations](docs/releases/v0.0.2-beta.1.md). Do not disable operating-system security protections. The extension is not published in the Chrome Web Store. The previous [v0.0.1 preview](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.1) is preserved; do not mix its companion with the new extension.

## Features

- Local OpenCV analysis and optional PaddleOCR; AI is not required for detection or scoring.
- Annotated implementation, side-by-side and opacity-overlay modes, with shared annotation visibility and marker-to-issue navigation.
- PNG/JPG input, Chrome viewport/full-page capture and optional Figma Frame import.
- PNG, Markdown and JSON exports; optional AI issue explanations and business-logic inference share a task-aware dialog with per-request consent.
- Project/history management, nine built-in themes and custom themes, plus Native Messaging companion startup and guided pairing.

## Develop

For macOS: Apple Silicon, macOS 14+, Node.js 24+, pnpm 11+ and [uv](https://docs.astral.sh/uv/). Windows builders should use the [Windows build guide](docs/WINDOWS-BETA-STATUS.md).

```bash
pnpm install --frozen-lockfile
uv sync --project apps/vision-engine --python 3.12 --extra dev --extra ocr --frozen
pnpm release:check
pnpm start:local
```

Use the public [demo images](examples/demo) to try a review. See the [contribution guide](.github/CONTRIBUTING.md), [script index](scripts/README.md) and [repository layout](docs/architecture/REPOSITORY.md) for tests, packaging and directory responsibilities.

```text
apps/       Workbench, extension, local service, vision engine and native installers
packages/   Shared contracts and scoring
scripts/    Development, verification and packaging entry points
docs/       User guides, architecture, specifications, releases and historical records
examples/   Public synthetic demo input
licenses/   Third-party license texts
.github/    Workflows, security and community contribution files
```

## Privacy and readiness

Core comparison is local and has no telemetry. Optional Figma/AI integrations require your credentials; AI requests require explicit consent. Credentials use macOS Keychain or Windows Credential Manager, and the local API binds to loopback. See [Privacy](docs/PRIVACY.md) and [Security](docs/SECURITY.md).

Synthetic benchmarks are not real-website accuracy claims. Windows 11 real-machine testing remains pending; macOS Intel is unsupported. The UI is primarily Chinese, and narrow-screen layouts remain limited. Detailed evidence and remaining gates live in the [delivery record](docs/DELIVERY-STATUS.md) and [benchmark notes](docs/BENCHMARK.md).

## Contribute and license

Issues and pull requests are welcome. Read the [contribution guide](.github/CONTRIBUTING.md) and [Code of Conduct](.github/CODE_OF_CONDUCT.md); report vulnerabilities privately via the [security policy](docs/SECURITY.md).

Copyright © 2026 LukiDesign. [MIT License](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md).
