# Privacy

## Default behavior

Vigour UI Review performs capture processing, image alignment, difference detection, OCR, scoring, storage, and export locally. The application contains no analytics or telemetry.

## Local data

Runtime data is stored in `~/Library/Application Support/Vigour UI Review/` with private directory and file permissions. It can include projects, screenshots, Figma renders, DOM/style snapshots, analysis results, evidence images, and the local session token.

On the first `v0.0.1` launch, an existing `~/Library/Application Support/Design Acceptance 2.0/` directory is copied atomically to the new location. Symbolic links and unsupported filesystem entries stop migration. The old directory remains unchanged for recovery.

## Credentials

Figma and AI credentials are stored in the macOS Keychain under `com.vigour-ui-review.local`. When a legacy `com.design-acceptance.local` entry is read, it is copied to the new Keychain service. Secret values are not stored in SQLite, browser storage, URLs, exports, or application logs.

## Optional external transfers

- **Figma:** the selected file key and node ID are sent to Figma using the user's PAT; the selected node JSON and rendered image are downloaded locally.
- **AI providers:** only the explicitly selected structured issues and, when enabled and supported, the evidence image are sent to the chosen provider/model.

Each AI transfer requires a one-time receipt bound to provider, model, task, selected issue data, image choice, and a SHA-256 payload hash. Receipts expire after ten minutes and cannot be replayed.

## Deletion

Stopping the service and deleting the application package removes executable files but intentionally preserves runtime data and Keychain entries. Follow `docs/INSTALL.md` for an explicit full uninstall.
