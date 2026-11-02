import SwiftUI

@main
struct CookieEaterApp: App {
    var body: some Scene {
        WindowGroup("Cookie Eater") {
            WelcomeView().frame(width: 460, height: 380)
        }
        .windowResizability(.contentSize)
    }
}
