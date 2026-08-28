# Vigour UI Review

[简体中文](README.zh-CN.md) · [Product specification](docs/spec/PRODUCT_SPEC.md) · [Architecture](docs/architecture/TECHNICAL_ARCHITECTURE.md) · [Security](docs/SECURITY.md)

Vigour UI Review is a local-first visual acceptance workbench for comparing a Web implementation with its design source. It detects and quantifies position, size, color, missing, extra, and optional OCR text differences, then turns them into reviewable issues and exportable evidence.

> Status: `v0.0.1` is an unsigned developer preview for macOS 14+ on Apple Silicon. The published accuracy baseline uses deterministic synthetic images and must not be interpreted as production accuracy on real websites.

![Vigour UI Review workbench](docs/assets/workbench-overview.jpg)

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

## Install the preview

1. Download `Vigour-UI-Review-v0.0.1-macos-arm64.zip` and its `.sha256` file from [GitHub Releases](../../releases/latest).
2. Verify the checksum:

   ```bash
   shasum -a 256 -c Vigour-UI-Review-v0.0.1-macos-arm64.zip.sha256
   ```

3. Extract the ZIP. Because `v0.0.1` is unsigned, Control-click `start.command` and choose **Open** on first launch.
4. Wait for the browser to open `http://127.0.0.1:4179/`. A first OCR cold start can take about 30 seconds.

To install the Chrome capture extension, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the package's `chrome-extension/` directory. See the [installation guide](docs/INSTALL.md) for token pairing and troubleshooting.

## Build from source

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

Create the complete offline package:

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

- Apple Silicon only; [current PaddlePaddle macOS packages support arm64 and not x86_64](https://www.paddlepaddle.org.cn/documentation/docs/en/install/pip/macos-pip_en.html).
- The developer package is not signed or notarized.
- The Chrome extension is not yet published in the Chrome Web Store.
- The current benchmark is synthetic; a human-labeled real-page benchmark remains required.
- Canvas, WebGL, video internals, cross-origin iframes, and interaction replay are outside `v0.0.1` scope.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first. Report security vulnerabilities privately as described in [SECURITY.md](docs/SECURITY.md).

## License

Copyright © 2026 Vigour UI. Released under the [MIT License](LICENSE).
