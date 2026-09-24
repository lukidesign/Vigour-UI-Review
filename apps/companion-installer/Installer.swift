import AppKit

final class InstallerDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var window: NSWindow!
    let idField = NSTextField(string: "")
    let status = NSTextField(wrappingLabelWithString: "准备就绪。安装时会校验并复制本地运行环境，可能需要数分钟。")
    let progress = NSProgressIndicator()
    var buttons: [NSButton] = []
    var busy = false

    func label(_ text: String, size: CGFloat = 13, bold: Bool = false) -> NSTextField {
        let view = NSTextField(wrappingLabelWithString: text)
        view.font = bold ? .boldSystemFont(ofSize: size) : .systemFont(ofSize: size)
        view.textColor = .labelColor
        return view
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 660, height: 510), styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "Vigour UI Review · 本地配套程序"
        window.delegate = self
        window.isReleasedWhenClosed = false
        let stack = NSStackView()
        stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        window.contentView!.addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo: window.contentView!.leadingAnchor, constant: 28), stack.trailingAnchor.constraint(equalTo: window.contentView!.trailingAnchor, constant: -28), stack.topAnchor.constraint(equalTo: window.contentView!.topAnchor, constant: 28)])
        stack.addArrangedSubview(label("VR   Vigour UI Review", size: 25, bold: true))
        stack.addArrangedSubview(label("安装一次，之后从 Chrome 扩展按需打开工作台。", size: 15))
        stack.addArrangedSubview(label("Apple Silicon 内测 · 未经 Developer ID 签名/公证。\n仅安装到当前用户目录，不需要管理员密码；升级和卸载保留项目、截图与钥匙串。"))
        stack.addArrangedSubview(label("Chrome 扩展 ID", bold: true))
        idField.placeholderString = "在 chrome://extensions 复制 32 位 ID"
        idField.stringValue = Bundle.main.object(forInfoDictionaryKey: "VigourExtensionId") as? String ?? ""
        idField.font = .monospacedSystemFont(ofSize: 14, weight: .regular)
        idField.setAccessibilityLabel("Chrome 扩展 ID")
        idField.widthAnchor.constraint(equalToConstant: 604).isActive = true
        stack.addArrangedSubview(idField)
        let actions = NSStackView(); actions.spacing = 12
        let items = [("安装 / 更新并配对", "install"), ("修复配对", "repair"), ("回退上一安装", "rollback")]
        for (title, action) in items {
            let button = NSButton(title: title, target: self, action: #selector(performAction(_:)))
            button.identifier = NSUserInterfaceItemIdentifier(action); button.bezelStyle = .rounded
            if action == "install" { button.keyEquivalent = "\r" }
            buttons.append(button); actions.addArrangedSubview(button)
        }
        stack.addArrangedSubview(actions)
        let uninstall = NSButton(title: "卸载配套程序（保留数据）", target: self, action: #selector(performAction(_:)))
        uninstall.identifier = NSUserInterfaceItemIdentifier("uninstall"); uninstall.bezelStyle = .rounded
        buttons.append(uninstall); stack.addArrangedSubview(uninstall)
        progress.style = .bar; progress.isIndeterminate = true; progress.isDisplayedWhenStopped = false
        progress.widthAnchor.constraint(equalToConstant: 604).isActive = true; stack.addArrangedSubview(progress)
        status.textColor = .secondaryLabelColor; status.font = .systemFont(ofSize: 13)
        status.widthAnchor.constraint(equalToConstant: 604).isActive = true; stack.addArrangedSubview(status)
        window.center(); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        run("status")
    }
    @objc func performAction(_ sender: NSButton) {
        guard !busy, let action = sender.identifier?.rawValue else { return }
        if action == "install" && idField.stringValue.range(of: "^[a-p]{32}$", options: .regularExpression) == nil {
            status.stringValue = "请粘贴完整扩展 ID：32 个 a–p 的小写字母。"; window.makeFirstResponder(idField); return
        }
        let alert = NSAlert(); alert.messageText = sender.title
        alert.informativeText = action == "uninstall"
            ? "将解除 Chrome 配对，并把此助手管理的程序移到废纸篓。项目数据和钥匙串不会删除。请先关闭工作台；活动任务会阻止操作。"
            : "请先关闭工作台和扩展弹窗。助手会停止已验证归属的本地服务，再校验/切换程序；不会终止其他程序。项目和钥匙串不会覆盖。"
        alert.addButton(withTitle: "继续"); alert.addButton(withTitle: "取消")
        if alert.runModal() == .alertFirstButtonReturn { run(action) }
    }
    func run(_ action: String) {
        busy = true; buttons.forEach { $0.isEnabled = false }; idField.isEnabled = false
        if action != "status" { status.stringValue = "正在校验并处理，请勿关闭窗口…"; progress.startAnimation(nil) }
        let extensionId = idField.stringValue
        let resources = Bundle.main.resourceURL!
        DispatchQueue.global(qos: .userInitiated).async {
            var result: [String: Any] = [:]
            do {
                let process = Process(); let pipe = Pipe()
                process.executableURL = resources.appendingPathComponent("companion/runtime/node")
                process.arguments = [resources.appendingPathComponent("installer/installer-cli.mjs").path, action, extensionId]
                var environment = ProcessInfo.processInfo.environment
                environment.removeValue(forKey: "NODE_OPTIONS"); environment.removeValue(forKey: "NODE_PATH")
                process.environment = environment; process.standardOutput = pipe; process.standardError = FileHandle.nullDevice
                try process.run()
                let data = pipe.fileHandleForReading.readDataToEndOfFile(); process.waitUntilExit()
                result = (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            } catch { result = ["ok": false, "message": "无法运行安装助手。请检查安装包及系统安全提示。"] }
            let output = result
            DispatchQueue.main.async {
                self.busy = false; self.progress.stopAnimation(nil); self.buttons.forEach { $0.isEnabled = true }; self.idField.isEnabled = true
                if output["ok"] as? Bool == true {
                    if action == "status" {
                        if let id = output["extensionId"] as? String { self.idField.stringValue = id; self.status.stringValue = "已检测到本助手管理的配套程序，可更新、修复、回退或卸载。" }
                    } else { self.status.stringValue = action == "uninstall" ? "已解除配对，程序已移到废纸篓。项目、截图和钥匙串已保留。" : "操作完成。请从 Chrome 工具栏打开 Vigour UI Review，再点击“打开工作台”。" }
                } else { self.status.stringValue = output["message"] as? String ?? "操作未完成，请重试。" }
                NSAccessibility.post(element: self.status, notification: .valueChanged)
            }
        }
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { return !busy }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply { return busy ? .terminateCancel : .terminateNow }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { return true }
}
let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = InstallerDelegate(); app.delegate = delegate
app.run()
