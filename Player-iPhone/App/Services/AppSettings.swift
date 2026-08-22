import Foundation
import Combine

/// Preferências não-secretas. Tokens ficam no Keychain.
@MainActor
final class AppSettings: ObservableObject {
    static let shared = AppSettings()

    private enum Keys {
        static let serverURL = "player_iphone.server_url"
        static let pollIntervalSeconds = "player_iphone.poll_interval_seconds"
    }

    @Published var serverURL: String {
        didSet { UserDefaults.standard.set(serverURL, forKey: Keys.serverURL) }
    }

    /// Intervalo de poll REST (10–15 s recomendado).
    @Published var pollIntervalSeconds: Double {
        didSet { UserDefaults.standard.set(pollIntervalSeconds, forKey: Keys.pollIntervalSeconds) }
    }

    private init() {
        serverURL = UserDefaults.standard.string(forKey: Keys.serverURL) ?? ""
        let stored = UserDefaults.standard.double(forKey: Keys.pollIntervalSeconds)
        pollIntervalSeconds = stored >= 10 && stored <= 30 ? stored : 12
    }

    /// Normaliza URL base sem barra final (ex.: `https://host:3000`).
    var normalizedServerURL: URL? {
        var raw = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }
        if !raw.contains("://") {
            raw = "https://\(raw)"
        }
        while raw.hasSuffix("/") {
            raw.removeLast()
        }
        return URL(string: raw)
    }

    func apiURL(path: String) throws -> URL {
        guard let base = normalizedServerURL else {
            throw APIClientError.missingServerURL
        }
        let cleaned = path.hasPrefix("/") ? path : "/\(path)"
        guard let url = URL(string: cleaned, relativeTo: base)?.absoluteURL else {
            throw APIClientError.invalidURL
        }
        return url
    }

    func webSocketURL(token: String) throws -> URL {
        guard let base = normalizedServerURL else {
            throw APIClientError.missingServerURL
        }
        var components = URLComponents(url: base, resolvingAgainstBaseURL: false)
        let isSecure = (components?.scheme ?? "").lowercased() == "https"
        components?.scheme = isSecure ? "wss" : "ws"
        components?.path = "/ws"
        components?.queryItems = [URLQueryItem(name: "token", value: token)]
        guard let url = components?.url else {
            throw APIClientError.invalidURL
        }
        return url
    }
}
