# Vigour UI Review Privacy Notice

Publisher and project copyright holder: **LukiDesign**. Updated: **2026-10-20**.

[简体中文](store/PRIVACY.zh-CN.md) · [Installation](INSTALL.md) · [Support](https://github.com/lukidesign/Vigour-UI-Review/issues)

This notice describes the **0.0.2** extension and matching companion in the **v0.0.2-beta.1 unsigned prerelease**. Windows 11 real-machine acceptance is pending. A GitHub release or store draft ID is not Chrome Web Store approval. Older 0.0.1 packages use manual connection and may retain a token in extension local storage; do not mix versions.

## Data and purpose

The product supports user-initiated webpage capture and comparison with design images.

- **Opening the popup** starts or reconnects the paired local companion and exchanges connection/session information, but does not start webpage capture. While connected, periodic checks send matching local workbench tab IDs to the companion for idle management, not unrelated tab contents.
- **Clicking capture** processes the selected page's screenshot, full URL (including query/fragment if present), title, text, element geometry, computed styles, viewport, device scale, page dimensions, scroll position and capture time.
- **Scope:** viewport mode limits the screenshot, not all DOM collection. Both modes inspect up to the first 20,000 body descendants, retaining eligible elements and leaf text capped at 2,000 characters per node. Elements outside the visible viewport can be included. This is not selected-element-only capture.
- Capture temporarily changes animation-related styles; full-page mode scrolls the page. Cleanup attempts to restore styles and scroll position after completion or interruption.
- The workbench stores imported images, imported Figma metadata, projects, runs, issues, scores, evidence and consent receipts for analysis, history and export.

Screenshots, text and URLs can contain personal information, communications, financial/health data, visible credentials or confidential material. **There is no automatic sensitive-data redaction.** Use synthetic or authorized content; visually hiding an item does not guarantee related DOM text or URL data is excluded. The extension does not request the Chrome history database, cookie store or password manager, or record keystroke histories.

## Local storage and security

Capture data travels to `http://127.0.0.1:4179` on the same computer using session authentication and origin checks, not to a developer server. This loopback transfer is not TLS-encrypted. Native Messaging handles startup/session control; screenshot and DOM payloads use the loopback API.

| Platform | Default runtime data | Optional Figma/AI credentials |
| --- | --- | --- |
| macOS Apple Silicon | `~/Library/Application Support/Vigour UI Review/` | macOS Keychain |
| Windows x64 | `%LOCALAPPDATA%\Vigour UI Review\` | Windows Credential Manager |

Project databases, screenshots, exports and diagnostics do **not** have application-layer encryption at rest. File permissions and OS protection do not mean encrypted project storage; Windows user-access controls still require real-machine verification.

The extension keeps the current connection credential in `chrome.storage.session`; the workbench uses tab `sessionStorage`. The companion also writes a local `session-token` file in its data directory. Do not share it. Opening tickets are short-lived, single-use and removed from the address before exchange. Service startup rotates the token; successful new-version connection removes the legacy extension local-storage token.

Figma PATs and AI keys use OS credential storage and are not intentionally included in project databases, reports or logs. Diagnostics may contain technical errors and paths. The code has no product analytics, advertising SDK or developer-operated review-data collection endpoint.

## Optional connections and recipients

Local pixel comparison does not require Figma or AI. Saving an API key alone does not authorize sending review evidence.

| User action | Recipient and data |
| --- | --- |
| Import a Figma frame | Figma's HTTPS API receives the PAT and selected file/node identifiers; the companion downloads design metadata and the image from Figma's supplied HTTPS image location. |
| Request AI explanation or component business-logic inference | The selected provider receives structured issue context: run identifiers/result, descriptions, geometry, expected/actual values and suggested CSS where present. If explicitly enabled and supported, it also receives the **complete annotated evidence image**, not just the selected component. |
| Initialize OCR with missing models | Model download services receive download requests and ordinary network metadata. Inference is intended to run locally; first-use or offline OCR success is not guaranteed. |
| Open download/support/provider links | GitHub or the chosen website receives the visit under its own policies. |

AI destinations are OpenAI (`api.openai.com`), Google Gemini (`generativelanguage.googleapis.com`), Kimi/Moonshot (`api.moonshot.cn`) or DeepSeek (`api.deepseek.com`), over HTTPS with the corresponding credential. Current adapters support images for OpenAI/Gemini, not Kimi/DeepSeek. Each request requires confirmation for its provider, model, task and context/image option. Receipts expire after ten minutes and are single-use; changed scope or retry requires renewed consent.

AI output is inference for human review, not verified business facts or automatically executed code. Provider retention, human access, training, processing regions and charges depend on the provider's terms and account settings; this application does not promise zero retention or no training. Review those terms before consenting. The developer does not receive review data by default. Exports may contain page content and are shared through actions you take.

## Retention and removal

Projects, images, captures and receipts have no promised automatic expiry. Closing the workbench, removing the extension or uninstalling the companion does not erase them. Updates and uninstall preserve project data and OS credentials. macOS legacy migration may leave a recovery copy under `~/Library/Application Support/Design Acceptance 2.0/`.

For complete removal, stop/uninstall the companion, back up what you need, then remove **only this application's** data directory using your OS file manager. Remove its credentials separately:

- macOS Keychain service: `com.vigour-ui-review.local`; legacy installations may also have `com.design-acceptance.local`.
- Windows Credential Manager: this application's generic credentials beginning `com.vigour-ui-review.local/`.
- Accounts: `figma-pat`, `ai-openai`, `ai-gemini`, `ai-kimi`, `ai-deepseek`. Do not remove unrelated entries.

Remove the extension separately in Chrome. macOS moves managed companion files to Trash; Windows removes its managed executable directory, possibly leaving a retired directory if files are locked. Neither removes exports, backups, OCR caches outside the data directory or copies sent to providers/support. Handle those separately; ask for help identifying paths rather than deleting broad directories. See [installation and removal](INSTALL.md).

## Limited Use commitment and contact

LukiDesign commits to using and transferring user data in accordance with the **Chrome Web Store User Data Policy, including its Limited Use requirements**. This is a data-use commitment, not Google approval or a claim that all submission gates are closed.

Data is used only for the disclosed user-facing design-review features. We do not sell it, use or transfer it for advertising, or use it to determine creditworthiness or lending eligibility. Optional transfers are limited to the user-requested integration. Normal operation provides no developer access to local content; for support, submit only specific redacted evidence you authorize us to inspect, not your whole data directory.

Contact: [GitHub Issues](https://github.com/lukidesign/Vigour-UI-Review/issues). Do not post credentials, customer pages, private screenshots or secret URLs publicly. For security matters use private vulnerability reporting when available; otherwise request a private contact route without posting sensitive evidence. Data-handling changes will be reflected here and must also be disclosed in the product and store declarations before distribution.
