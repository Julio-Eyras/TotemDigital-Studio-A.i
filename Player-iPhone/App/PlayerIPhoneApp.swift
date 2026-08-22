import SwiftUI

@main
struct PlayerIPhoneApp: App {
    @StateObject private var auth = AuthService.shared
    @StateObject private var settings = AppSettings.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(settings)
        }
    }
}
