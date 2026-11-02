import SafariServices

// Each request owns its context until either inference or the deadline replies.
@MainActor private final class Reply {
    private let context: NSExtensionContext
    private var finished = false
    init(_ context: NSExtensionContext) { self.context = context }
    func send(_ payload: [String: Any]) {
        guard !finished else { return }
        finished = true
        let item = NSExtensionItem()
        item.userInfo = [SFExtensionMessageKey: payload]
        context.completeRequest(returningItems: [item], completionHandler: nil)
    }
}

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem
        let message = request?.userInfo?[SFExtensionMessageKey] as? [String: Any] ?? [:]
        Task { @MainActor in
            let reply = Reply(context)
            let inference = Task { await ModelBridge.handle(message) }
            let deadline = Task {
                try? await Task.sleep(for: .seconds(18))
                guard !Task.isCancelled else { return }
                inference.cancel()
                reply.send(["action": "none", "model": ModelBridge.availability(), "error": "timeout"])
            }
            reply.send(await inference.value)
            deadline.cancel()
        }
    }
}
