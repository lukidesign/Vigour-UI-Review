# Vigour UI Review Privacy Notice

Publisher name and project copyright attribution: **LukiDesign**. Updated: 2026-09-16.

This notice describes the Native-enabled beta extension (Chrome Web Store item ID: `dmkfgmpbomjjhalgnfhcpalobdnklchh`) and its matching local companion. Publishing this notice does not mean that the beta has passed store review or that a compatible companion has been publicly released. Older GitHub release packages use a manual connection flow and may retain a connection token in extension local storage; the session-only behavior below applies to the Native-enabled beta.

## Data and purpose

When you explicitly start capture, the extension processes the selected webpage's screenshot, full URL, title, text, element geometry, computed styles, viewport, device scale and capture/scroll metadata. Full-page capture temporarily scrolls and adjusts animation-related styles, then attempts to restore the page. These actions support UI design review, not advertising or continuous browsing surveillance.

The workbench also stores uploaded design images, projects, comparison runs, issue descriptions, scores and export evidence. Screenshots, text and URLs can contain personal or confidential information, including URL query parameters. Capture does not automatically redact sensitive content: hide anything you do not want included. The extension does not request the Chrome history database, cookies or password manager, and does not record keystroke histories.

## Local processing

Capture data is sent to the companion on the same computer at `127.0.0.1:4179`, using session authentication. This is not an internet upload. Pixel processing, storage and report generation run locally. Directory restrictions are not a claim that the entire review database is encrypted.

macOS runtime data lives in `~/Library/Application Support/Vigour UI Review/`. The Native extension stores its connection credential in `chrome.storage.session`; the workbench uses tab `sessionStorage`. Opening tickets are short-lived, single-use and removed from the URL before exchange. Credentials rotate after a successful service start. Legacy extension local-storage credentials are removed on successful new-version reconnection.

Only matching local workbench tab state is checked for idle shutdown, not other tab content. The code has no product analytics, advertising integration or developer-operated data collection endpoint. Diagnostic files can contain technical errors or local paths; inspect them before sharing.

## Credentials and optional connections

Figma PATs and AI keys are handled by the companion and stored in macOS Keychain rather than the review database. The application does not intentionally include them in reports or diagnostic logs.

- **Figma:** an import you initiate sends the selected file/node identifiers and authentication to Figma and downloads the selected design data.
- **AI:** after configuration, explicitly invoking OpenAI, Gemini, Kimi or DeepSeek sends selected issue context and optionally supported evidence images to that provider over HTTPS. Saving configuration alone does not authorize sending review content. Each review request needs a one-time confirmation bound to provider, model, task and payload, expiring after ten minutes. Provider retention depends on its policies and your account settings.
- **OCR models:** missing assets may require an initial download from model providers. OCR inference is intended to run locally once models are available. Not every feature is guaranteed fully offline on first use.
- **Support/download links:** opening GitHub or provider websites connects to those sites under their policies.

Review data is not sent to the developer by default. You choose whether to export/share reports, which can contain captured page content.

## Retention and removal

Local data remains until you remove it; no automatic expiry is promised. Closing a tab or uninstalling the extension does not delete the project database. Companion updates and removal preserve projects, screenshots and Keychain entries. Legacy migration can retain an old directory as a recovery copy.

To remove all local data, stop the companion, back up anything needed, then remove your application data directories and related Keychain entries using macOS tools. See [INSTALL.md](INSTALL.md). Uninstalling does not delete exported files or data already sent to a provider; use that provider's controls where applicable.

## Limited Use and contact

User data is used only for the described user-facing review features. LukiDesign does not sell it, use it for advertising or use it for creditworthiness or lending decisions. Developer access to local content is not part of normal operation. Support evidence is shared only if you choose to submit it.

Support: [GitHub Issues](https://github.com/lukidesign/Vigour-UI-Review/issues). Do not post credentials, private screenshots, secret URLs or customer data publicly. For security matters use the repository's private reporting channel when available; otherwise request private contact without disclosing sensitive evidence in public.

The policy, store declarations and distributed code should describe the same behavior; this notice will be revised when handling changes.
