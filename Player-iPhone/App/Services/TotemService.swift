import Foundation

enum TotemService {
    static func fetchTotems(page: Int = 1, limit: Int = 200, search: String? = nil) async throws -> [Totem] {
        var path = "/api/totems?page=\(page)&limit=\(limit)&onlyActive=1"
        if let search, !search.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let encoded = search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? search
            path += "&search=\(encoded)"
        }

        let raw = try await APIClient.shared.requestJSON(
            method: "GET",
            path: path,
            authorized: true
        )

        let data = try JSONSerialization.data(withJSONObject: raw)
        if let list = try? JSONDecoder().decode(TotemListResponse.self, from: data) {
            return list.items.filter { $0.id > 0 }
        }
        if let array = raw as? [[String: Any]] {
            let nested = try JSONSerialization.data(withJSONObject: array)
            return try JSONDecoder().decode([Totem].self, from: nested).filter { $0.id > 0 }
        }
        if let dict = raw as? [String: Any], let nested = dict["data"] ?? dict["totems"] {
            let nestedData = try JSONSerialization.data(withJSONObject: nested)
            return try JSONDecoder().decode([Totem].self, from: nestedData).filter { $0.id > 0 }
        }
        return []
    }

    static func fetchTotem(id: Int) async throws -> Totem {
        let raw = try await APIClient.shared.requestJSON(
            method: "GET",
            path: "/api/totems/\(id)",
            authorized: true
        )
        let payload: Any
        if let dict = raw as? [String: Any], let totem = dict["totem"] ?? dict["data"] {
            payload = totem
        } else {
            payload = raw
        }
        let data = try JSONSerialization.data(withJSONObject: payload)
        return try JSONDecoder().decode(Totem.self, from: data)
    }

    static func fetchPlaybackState(totemId: Int) async throws -> TotemPlaybackState? {
        let raw = try await APIClient.shared.requestJSON(
            method: "GET",
            path: "/api/totems/\(totemId)/playback-state",
            authorized: true
        )
        return PlaybackNormalize.normalize(raw, fallbackTotemId: totemId)
    }

    /// Lease de observação quente (MVP+). TTL 60–120 s conforme backend.
    static func startTelemetryObservation(totemId: Int, ttlSeconds: Int = 90) async throws {
        struct Body: Encodable { let ttlSeconds: Int }
        _ = try await APIClient.shared.requestJSON(
            method: "POST",
            path: "/api/totems/\(totemId)/telemetry-observation/start",
            body: Body(ttlSeconds: ttlSeconds),
            authorized: true
        )
    }

    static func renewTelemetryObservation(totemId: Int, ttlSeconds: Int = 90) async throws {
        struct Body: Encodable { let ttlSeconds: Int }
        _ = try await APIClient.shared.requestJSON(
            method: "PUT",
            path: "/api/totems/\(totemId)/telemetry-observation/renew",
            body: Body(ttlSeconds: ttlSeconds),
            authorized: true
        )
    }

    static func stopTelemetryObservation(totemId: Int) async {
        _ = try? await APIClient.shared.requestJSON(
            method: "DELETE",
            path: "/api/totems/\(totemId)/telemetry-observation/stop",
            authorized: true,
            retryOnUnauthorized: false
        )
    }
}
