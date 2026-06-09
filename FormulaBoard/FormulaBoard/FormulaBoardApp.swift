import SwiftUI

@main
struct FormulaBoardApp: App {
    @StateObject private var settings = AppSettings()

    var body: some Scene {
        WindowGroup {
            ContentView(settings: settings)
                .environmentObject(settings)
        }
    }
}
