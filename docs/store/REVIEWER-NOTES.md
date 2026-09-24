# Reviewer instructions — private beta draft

Publisher name: LukiDesign. Extension name: Vigour UI Review. Project copyright attribution: LukiDesign.

Do not submit until the following are populated and tested:

- Store item / extension ID: `dmkfgmpbomjjhalgnfhcpalobdnklchh` (created 2026-09-16; draft ID, not proof of approval).
- Beta version: **PENDING — must match across packages**.
- Companion download URL and SHA-256: **PENDING — local developer build is not a published download**.
- Clean-machine macOS/Chrome versions: **PENDING**.
- Signing: **currently not Developer ID signed or notarized**.
- Proposed support: `https://github.com/lukidesign/Vigour-UI-Review/issues`.

## Purpose and prerequisites

UI design review with a local companion, not a standalone cloud app. The first beta targets Apple Silicon Macs and has a primarily Chinese UI. No product account or subscription is needed for local comparison. Figma and AI are optional.

The paired host `com.vigour_ui_review.local` starts or reuses an authenticated same-device service. Native messages carry control/session information, not executable instructions. Image/DOM data uses authenticated loopback HTTP.

## Review steps

1. Install the private-store extension and its matching companion; pair to the real store ID.
2. Open the extension from the actual Chrome toolbar on a non-sensitive test webpage. Confirm connection, then click “打开工作台” (Open workbench).
3. Confirm no manually copied token is needed and no ticket remains in the URL.
4. Create a project with the left plus button and upload a design PNG/JPG matching the intended screenshot viewport/aspect ratio.
5. Return to the target page, open the toolbar popup, choose “采集当前视口” (Capture viewport). In the workbench select it from “最近采集” (Recent captures).
6. Click “重新走查”, choose pixel/structure analysis, inspect results and switch annotation/side-by-side/overlay views.
7. Export PNG/Markdown/JSON. The public `examples/demo` image pair can separately test analysis without customer data.
8. Test full-page capture on a modest test page. Check restored scroll/styles, cancellation, navigation and tab changes.
9. Close all workbench tabs with no active task. After roughly 15 idle minutes (recovery grace may extend this), verify service exit and reopen it from the extension.

## Privacy and removal

Capture data handling is disclosed beside the buttons. AI is not invoked automatically; missing OCR assets may download once. This should not be described as an upload of review screenshots. Data remains local unless the user invokes an integration or shares an export.

The installer preserves project/Keychain data, removes only its own Native registration and moves managed executable files to Trash. It refuses unrelated registrations and processes on port 4179.

Current screenshots show real workbench analysis on public demo data, not evidence that the real toolbar or store review passed. Download links, package versions, actual pairing to the above ID and clean-machine results must be completed before submission. Current delivery gates are tracked in [DELIVERY-STATUS.md](../DELIVERY-STATUS.md).
