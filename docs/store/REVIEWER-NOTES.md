# Reviewer instructions — preparation draft

Publisher and project copyright holder: **LukiDesign**. Product: **Vigour UI Review**. Updated: **2026-10-20**.

**Do not submit these notes until [readiness gates](READINESS.md) are closed.** This is a public preparation document, not a record of a completed review or an instruction to bypass operating-system security.

## Candidate and downloads

- Application/extension version: **0.0.2**. Public companion channel: **v0.0.2-beta.1**, unsigned prerelease.
- Historical store draft ID: `dmkfgmpbomjjhalgnfhcpalobdnklchh`. Today's dashboard version/distribution/approval has **not** been rechecked.
- [Release assets](https://github.com/lukidesign/Vigour-UI-Review/releases/tag/v0.0.2-beta.1) are publicly downloadable, unlike expiring Actions artifacts.
- Windows x64 archive: `Vigour-UI-Review-v0.0.2-beta.1-windows-x64-unsigned.zip`; SHA-256 `579f88d2ceaaaefed5ec0c5acb536fd5a4ea18584c752fb70d695022afb43e11`.
- macOS Apple Silicon archive: `Vigour-UI-Review-Setup-v0.0.2-beta.1-macos-arm64-unsigned.zip`; SHA-256 `35af45dc6327c136327f064d320facdd66a999f59aa2c6ddb874fac22200162b`.
- Checksums and exact build sources: Release `SHA256SUMS.txt` and `BUILD-PROVENANCE.json`. Do not identify the current documentation commit as the installer build source.
- Windows 11 real-machine acceptance is pending; Windows CI ran on Windows Server 2022. macOS clean-machine/minimum-OS and sleep/idle acceptance remain pending. Packages are unsigned; macOS is not notarized.

If implementation changes require a new coordinated build before submission, replace these download references and hashes with that tested build. Do not reuse current hashes for rebuilt files.

## Purpose and prerequisites

The extension captures the user-selected webpage for local design review. It is not merely a launcher. The companion provides local analysis and history. Target test environments: macOS 14+ Apple Silicon, or Windows 11 Intel/AMD x64, with Chrome 116+ as declared in the manifest. Interface labels are primarily Chinese.

There is no Vigour product account/subscription for local capture, comparison or export. Optional Figma and AI features require user-owned credentials, network access and potentially provider charges. No credentials are included in this public document.

Native host `com.vigour_ui_review.local` receives a constrained connect command and returns session information. Capture evidence uses authenticated same-device HTTP on `127.0.0.1:4179`. Opening the popup can start the companion; screenshot/DOM capture starts only after the user clicks capture.

## Installation for a store review

1. Use the **extension actually submitted for review**, not the unpacked extension from GitHub. Copy its actual 32-character Chrome extension ID.
2. Download the matching platform companion. Windows: extract and run `Vigour-UI-Review-0.0.2-windows-x64-dev-setup.exe`. macOS: extract and open the Setup application.
3. Choose install/update and pair to the submitted extension ID. Do not substitute an unpacked/local ID or assume the historical draft ID is current.
4. Installation is per user, without a Node/Python prerequisite or normal terminal/token-copy step.
5. If Gatekeeper, SmartScreen or organizational policy blocks execution, stop and record the message. Do not disable protections. The publisher must provide a safely reviewable companion before claiming readiness.

The [ordinary beta tester guide](../BETA-TESTING.md) deliberately uses unpacked extensions; that flow is **not** a substitute for reviewing the submitted item.

## Core review steps and expected results

1. On an authorized, non-sensitive HTTP/HTTPS page, open the real Chrome toolbar popup; read the capture disclosure. Without clicking capture, no page screenshot/DOM should be collected. Click “打开工作台” (Open workbench); no copied token is needed and the ticket should disappear from the address.
2. Expand the collapsed project sidebar; create a project, then import a PNG/JPG design image matching the intended screenshot dimensions.
3. Return to the page, choose “采集当前视口” (Capture viewport). In the workbench choose “最近采集” (Recent captures) to load the implementation. Check the intended page, URL and image. Viewport screenshots can be accompanied by off-screen DOM/text; this is a current limitation, not a redaction feature.
4. Click “走查” / “重新走查” (Review / Review again). Check issues, marker navigation and visibility in annotated, side-by-side and opacity-overlay modes. The [public synthetic demo pair](https://github.com/lukidesign/Vigour-UI-Review/tree/main/examples/demo) can separately exercise analysis without customer data.
5. Export PNG, Markdown and JSON; open each and compare with the review. Never use synthetic success as a real-site accuracy claim.
6. Capture a modest full page, check completeness and restored scrolling/styles. During a separate capture try cancellation, navigation and tab changes; the job should stop safely, never submit a different page. Cancellation is disabled once submission to the local service begins.
7. Close workbench tabs with no active task, wait roughly 15 idle minutes (recovery grace can extend this), then reopen through the extension. Separately test Chrome restart, sleep/resume and continuous capture. Record timings and failures rather than asserting success from source code.

## Optional integrations

Use synthetic evidence and authorized test credentials only. Before submission the publisher must arrange review access/instructions for these features through the **private dashboard testing fields** if needed, never a public document.

- **Figma:** configure a permitted test PAT and import an accessible Frame. Confirm the selected design and metadata are retrieved; invalid/removed credentials should produce a safe error.
- **AI:** choose “问题解释” or “组件业务逻辑” in the shared dialog, provider/model and issue scope. Saving a key must not send evidence. No request should succeed without per-request confirmation. Images are off by default; enabling them for OpenAI/Gemini sends the full annotated evidence image. Kimi/DeepSeek adapters are text-only. Changing scope, retrying or waiting past ten minutes requires renewed consent.
- Record real optional-feature results separately; this documentation update made **no external AI/Figma test request**. Optional does not mean exempt from review.

## Privacy and uninstall

Policies: [English](../PRIVACY.md), [中文](PRIVACY.zh-CN.md). Data normally stays local; integrations and user-shared exports are disclosed exceptions. Missing OCR models can trigger downloads. Core offline image comparison and offline OCR must be tested separately.

On macOS the installer removes its own Native registration and moves managed program files to Trash. On Windows the registered uninstaller removes its own registration/program files; locked files may leave a retired directory. **Both preserve projects, screenshots/history and OS credentials.** Remove the Chrome extension separately; complete data/credential removal follows the privacy notice.

Support: https://github.com/lukidesign/Vigour-UI-Review/issues — submit only redacted evidence; request a private route for sensitive security details.
