import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthService

    var body: some View {
        Group {
            if auth.isAuthenticated {
                MainTabView()
            } else {
                NavigationStack {
                    LoginView()
                }
            }
        }
        .animation(.easeInOut(duration: 0.2), value: auth.isAuthenticated)
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            NavigationStack {
                TotemListView()
            }
            .tabItem {
                Label("Totens", systemImage: "tv")
            }

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Definições", systemImage: "gearshape")
            }
        }
    }
}
