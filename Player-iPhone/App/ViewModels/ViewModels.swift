import Foundation
import Combine

@MainActor
final class TotemListViewModel: ObservableObject {
    @Published var totems: [Totem] = []
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var lastRefresh: Date?

    func refresh() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let search = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            totems = try await TotemService.fetchTotems(
                search: search.isEmpty ? nil : search
            )
            lastRefresh = Date()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

@MainActor
final class MonitorViewModel: ObservableObject {
    @Published var totem: Totem?
    @Published var isLoadingTotem = false
    @Published var totemError: String?

    let telemetry = PlaybackTelemetryService()
    let totemId: Int

    init(totemId: Int, seed: Totem? = nil) {
        self.totemId = totemId
        self.totem = seed
    }

    func onAppear() {
        telemetry.start(totemId: totemId)
        Task { await loadTotem() }
    }

    func onDisappear() {
        telemetry.stop()
    }

    func loadTotem() async {
        isLoadingTotem = true
        defer { isLoadingTotem = false }
        do {
            totem = try await TotemService.fetchTotem(id: totemId)
            totemError = nil
        } catch {
            totemError = error.localizedDescription
        }
    }
}

@MainActor
final class LoginViewModel: ObservableObject {
    @Published var serverURL: String = AppSettings.shared.serverURL
    @Published var username = ""
    @Published var password = ""
    @Published var twoFactorCode = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    var needsTwoFactor: Bool {
        AuthService.shared.pendingTwoFactorUser != nil
    }

    func saveServerURL() {
        AppSettings.shared.serverURL = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func login() async {
        saveServerURL()
        guard AppSettings.shared.normalizedServerURL != nil else {
            errorMessage = "Indique a URL do servidor (ex.: https://meuservidor:3000)."
            return
        }
        guard !username.isEmpty, !password.isEmpty else {
            errorMessage = "Preencha utilizador e palavra-passe."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await AuthService.shared.login(username: username, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func verifyTwoFactor() async {
        let code = twoFactorCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard code.count >= 6 else {
            errorMessage = "Introduza o código 2FA (6 dígitos ou código de backup)."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await AuthService.shared.verifyTwoFactor(code: code)
            twoFactorCode = ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func cancelTwoFactor() {
        AuthService.shared.cancelTwoFactor()
        twoFactorCode = ""
        errorMessage = nil
    }
}
