import Foundation

enum APIClientError: LocalizedError {
    case missingServerURL
    case invalidURL
    case unauthorized
    case httpStatus(Int, String?)
    case decoding(Error)
    case network(Error)
    case emptyBody

    var errorDescription: String? {
        switch self {
        case .missingServerURL:
            return "Defina a URL do servidor nas Definições."
        case .invalidURL:
            return "URL do servidor inválida."
        case .unauthorized:
            return "Sessão expirada. Faça login novamente."
        case .httpStatus(let code, let message):
            if let message, !message.isEmpty { return message }
            return "Erro HTTP \(code)"
        case .decoding(let error):
            return "Resposta inválida: \(error.localizedDescription)"
        case .network(let error):
            return "Rede: \(error.localizedDescription)"
        case .emptyBody:
            return "Resposta vazia do servidor."
        }
    }
}

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private var isRefreshing = false

    init(session: URLSession = .shared) {
        self.session = session
    }

    func requestJSON(
        method: String,
        path: String,
        body: (any Encodable)? = nil,
        authorized: Bool = true,
        retryOnUnauthorized: Bool = true
    ) async throws -> Any {
        let data = try await requestData(
            method: method,
            path: path,
            body: body,
            authorized: authorized,
            retryOnUnauthorized: retryOnUnauthorized
        )
        guard !data.isEmpty else { throw APIClientError.emptyBody }
        return try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
    }

    func requestDecodable<T: Decodable>(
        _ type: T.Type,
        method: String,
        path: String,
        body: (any Encodable)? = nil,
        authorized: Bool = true
    ) async throws -> T {
        let data = try await requestData(
            method: method,
            path: path,
            body: body,
            authorized: authorized,
            retryOnUnauthorized: true
        )
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIClientError.decoding(error)
        }
    }

    func requestData(
        method: String,
        path: String,
        body: (any Encodable)?,
        authorized: Bool,
        retryOnUnauthorized: Bool
    ) async throws -> Data {
        let settings = await MainActor.run { AppSettings.shared }
        let url = try await MainActor.run { try settings.apiURL(path: path) }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 20

        if authorized, let token = KeychainStore.get(.accessToken) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIClientError.network(error)
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.network(URLError(.badServerResponse))
        }

        if http.statusCode == 401, authorized, retryOnUnauthorized {
            let refreshed = try await refreshTokensIfPossible()
            if refreshed {
                return try await requestData(
                    method: method,
                    path: path,
                    body: body,
                    authorized: true,
                    retryOnUnauthorized: false
                )
            }
            throw APIClientError.unauthorized
        }

        if !(200...299).contains(http.statusCode) {
            let message = Self.extractErrorMessage(from: data)
            throw APIClientError.httpStatus(http.statusCode, message)
        }
        return data
    }

    private func refreshTokensIfPossible() async throws -> Bool {
        guard let refresh = KeychainStore.get(.refreshToken), !refresh.isEmpty else {
            return false
        }
        if isRefreshing { return false }
        isRefreshing = true
        defer { isRefreshing = false }

        do {
            let response: RefreshTokenAPIResponse = try await requestDecodable(
                RefreshTokenAPIResponse.self,
                method: "POST",
                path: "/api/auth/refresh",
                body: RefreshTokenBody(refreshToken: refresh),
                authorized: false
            )
            try KeychainStore.set(response.token, for: .accessToken)
            try KeychainStore.set(response.refreshToken, for: .refreshToken)
            return true
        } catch {
            KeychainStore.clearSession()
            return false
        }
    }

    private static func extractErrorMessage(from data: Data) -> String? {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let error = obj["error"] as? String { return error }
        if let message = obj["message"] as? String { return message }
        return nil
    }
}

private struct AnyEncodable: Encodable {
    private let encodeFunc: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        encodeFunc = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeFunc(encoder)
    }
}
