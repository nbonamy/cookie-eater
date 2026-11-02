import Cocoa
import SafariServices
import SwiftUI

let extensionBundleIdentifier = "com.nbonamy.CookieEater.Extension"

struct WelcomeView: View {
    @State private var enabled: Bool?
    @State private var error: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 14) {
                Image(nsImage: NSImage(named: "AppIcon") ?? NSImage()).resizable().frame(width: 58, height: 58)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Cookie Eater").font(.title.bold())
                    Text("Fewer banners. More browsing.").foregroundStyle(.secondary)
                }
            }
            Divider()
            Label(enabled == true ? "Enabled in Safari" : "Ready for Safari", systemImage: enabled == true ? "checkmark.circle.fill" : "safari")
                .font(.headline)
            Text("Reject optional cookies when possible. Accept when needed to continue. Your browsing stays on your Mac.")
            Text("Enable Cookie Eater in Safari, then allow access to the websites you choose.").foregroundStyle(.secondary)
            Button("Open Safari Settings") {
                SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { failure in
                    if failure != nil { DispatchQueue.main.async { error = "Open Safari → Settings → Extensions, then enable Cookie Eater." } }
                }
            }.buttonStyle(.borderedProminent).controlSize(.large)
            HStack(spacing: 16) {
                Link("Privacy Policy", destination: URL(string: "https://github.com/nbonamy/cookie-eater/blob/main/PRIVACY.md")!)
                Link("Support", destination: URL(string: "https://github.com/nbonamy/cookie-eater/issues")!)
            }.font(.callout)
            if let error { Text(error).font(.caption).foregroundStyle(.secondary) }
        }
        .padding(28).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { refresh() }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in refresh() }
    }
    private func refresh() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, _ in
            DispatchQueue.main.async { enabled = state?.isEnabled }
        }
    }
}
