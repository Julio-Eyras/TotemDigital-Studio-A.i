import Foundation
import Combine

@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published private(set) var isAuthenticated: Bool
    @Published private(set) var currentUser: AuthUser?
    @Published var pendingTwoFactorUser: AuthUser?

    private let client = APIClient.shared

    private init() {
        if let token = KeychainStore.get(.accessToken), !token.isEmpty {
            isAuthenticated = true
            currentUser = Self.loadUserFromKeychain()
        } else {
            isAuthenticated = false
            currentUser = nil
        }
    }

    func login(username: String, password: String) async throws {
        let response: LoginAPIResponse = try await client.requestDecodable(
            LoginAPIResponse.self,
            method: "POST",
            path: "/api/auth/login",
            body: LoginRequestBody(username: username, password: password),
            authorized: false
        )

        if response.requiresTwoFactor == true {
            pendingTwoFactorUser = response.user
            return
        }

        guard let token = response.token, let refresh = response.refreshToken else {
            throw APIClientError.httpStatus(401, response.error ?? "Resposta de login inválida")
        }
        try persistSession(token: token, refreshToken: refresh, user: response.user)
        pendingTwoFactorUser = nil
    }

    func verifyTwoFactor(code: String) async throws {
        guard let user = pendingTwoFactorUser else {
            throw APIClientError.httpStatus(400, "Sessão 2FA inválida. Faça login novamente.")
        }
        let response: LoginAPIResponse = try await client.requestDecodable(
            LoginAPIResponse.self,
            method: "POST",
            path: "/api/auth/2fa/verify",
            body: TwoFactorVerifyBody(userId: user.id, code: code),
            authorized: false
        )
        guard let token = response.token, let refresh = response.refreshToken else {
            throw APIClientError.httpStatus(401, response.error ?? "Código 2FA inválido")
        }
        try persistSession(token: token, refreshToken: refresh, user: response.user ?? user)
        pendingTwoFactorUser = nil
    }

    func cancelTwoFactor() {
        pendingTwoFactorUser = nil
    }

    func logout() async {
        if KeychainStore.get(.accessToken) != nil {
            _ = try? await client.requestData(
                method: "POST",
                path: "/api/auth/logout",
                body: nil,
                authorized: true,
                retryOnUnauthorized: false
            )
        }
        KeychainStore.clearSession()
        isAuthenticated = false
        currentUser = nil
        pendingTwoFactorUser = nil
    }

    private func persistSession(token: String, refreshToken: String, user: AuthUser?) throws {
        try KeychainStore.set(token, for: .accessToken)
        try KeychainStore.set(refreshToken, for: .refreshToken)
        if let user, let data = try? JSONEncoder().encode(user), let json = String(data: data, encoding: .utf8) {
            try KeychainStore.set(json, for: .userJSON)
            currentUser = user
        } else {
            currentUser = user
        }
        isAuthenticated = true
    }

    private static func loadUserFromKeychain() -> AuthUser? {
        guard let json = KeychainStore.get(.userJSON),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(AuthUser.self, from: data)
    }
}
