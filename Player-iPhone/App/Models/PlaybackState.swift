import Foundation

/// Espelha `frontend/src/utils/playbackTelemetry.ts` (normalizePlaybackState).
struct TotemPlaybackState: Equatable {
    var totemId: Int?
    var mediaId: String?
    var mediaName: String
    var mediaType: String?
    var durationMs: Double
    var startedAt: String?
    var expectedEndAt: String?
    var endedAt: String?
    var playedDurationMs: Double?
    var status: String
    var stale: Bool
    var receivedAt: Date
    var nextMediaName: String?
    var nextMediaType: String?
    var nextMediaDurationMs: Double?

    static let empty = TotemPlaybackState(
        mediaName: "",
        durationMs: 0,
        status: "empty",
        stale: false,
        receivedAt: Date()
    )

    var isEmpty: Bool { mediaName.isEmpty && status == "empty" }

    func elapsedMs(now: Date = Date()) -> Double {
        guard let startedAt, let start = ISO8601Helper.date(from: startedAt) else { return 0 }
        let elapsed = now.timeIntervalSince(start) * 1000
        return min(max(0, elapsed), max(0, durationMs))
    }

    func progressFraction(now: Date = Date()) -> Double {
        guard durationMs > 0 else { return 0 }
        return min(1, max(0, elapsedMs(now: now) / durationMs))
    }
}

enum PlaybackNormalize {
    private static let staleGraceMs: Double = 15_000

    static func normalize(_ payload: Any?, fallbackTotemId: Int? = nil, now: Date = Date()) -> TotemPlaybackState? {
        let outer = asDict(payload)
        let wrapped = asDict(outer["playbackState"] ?? outer["playback_state"])
        let data: [String: Any]
        if !wrapped.isEmpty {
            data = wrapped
        } else {
            data = asDict(outer["data"])
        }
        let runtime = asDict(data["runtime"] ?? outer["runtime"])
        let media = asDict(data["media"] ?? outer["media"])
        let playback = asDict(data["playback"] ?? outer["playback"])
        let context = asDict(data["context"] ?? outer["context"])
        let nowPlaying = asDict(
            data["nowPlaying"] ?? data["now_playing"] ?? outer["nowPlaying"] ?? outer["now_playing"]
        )
        let source: [String: Any] = !nowPlaying.isEmpty ? nowPlaying : (!data.isEmpty ? data : outer)

        let displayIdle =
            bool(outer["displayIdle"]) || bool(outer["display_idle"])
            || bool(data["displayIdle"]) || bool(data["display_idle"])

        if displayIdle {
            return TotemPlaybackState(
                totemId: positiveInt(outer["totemId"], outer["totem_id"], data["totemId"], data["totem_id"], fallbackTotemId),
                mediaName: "Tela desligada por agenda",
                durationMs: 0,
                status: "display_off",
                stale: false,
                receivedAt: now
            )
        }

        let explicitDisplayIdleFalse =
            (outer["displayIdle"] as? Bool) == false
            || (outer["display_idle"] as? Bool) == false
            || (data["displayIdle"] as? Bool) == false
            || (data["display_idle"] as? Bool) == false

        let mediaName = string(
            source["mediaName"], source["media_name"], source["name"], media["name"]
        ).trimmingCharacters(in: .whitespacesAndNewlines)

        if mediaName.isEmpty && explicitDisplayIdleFalse {
            return TotemPlaybackState(
                totemId: positiveInt(outer["totemId"], outer["totem_id"], data["totemId"], data["totem_id"], fallbackTotemId),
                mediaName: "Tela ligada · aguardando mídia",
                durationMs: 0,
                status: "idle",
                stale: false,
                receivedAt: now
            )
        }
        if mediaName.isEmpty { return nil }

        let startedAt = iso(
            source["startedAt"], source["started_at"],
            playback["startedAt"], playback["started_at"],
            runtime["startedAt"], runtime["started_at"]
        )
        var durationMs = positiveDouble(
            source["durationMs"], source["duration_ms"],
            media["durationMs"], media["duration_ms"],
            runtime["durationMs"], runtime["duration_ms"]
        )
        if durationMs == nil {
            if let seconds = positiveDouble(source["durationSeconds"], source["duration_seconds"], source["duration"]) {
                durationMs = seconds * 1000
            } else {
                durationMs = 0
            }
        }
        let duration = durationMs ?? 0
        var expectedEndAt = iso(
            source["expectedEndAt"], source["expected_end_at"],
            playback["expectedEndAt"], playback["expected_end_at"],
            runtime["expectedEndAt"], runtime["expected_end_at"]
        )
        if expectedEndAt == nil, let startedAt, duration > 0, let start = ISO8601Helper.date(from: startedAt) {
            expectedEndAt = ISO8601Helper.string(from: start.addingTimeInterval(duration / 1000))
        }

        let nextSource = asDict(
            context["nextMedia"] ?? context["next_media"]
                ?? source["nextMedia"] ?? source["next_media"]
                ?? data["nextMedia"] ?? data["next_media"]
                ?? outer["nextMedia"] ?? outer["next_media"]
        )
        let nextName = string(nextSource["name"], nextSource["mediaName"], nextSource["media_name"])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        var nextDuration = positiveDouble(nextSource["durationMs"], nextSource["duration_ms"])
        if nextDuration == nil {
            if let seconds = positiveDouble(nextSource["durationSeconds"], nextSource["duration_seconds"], nextSource["duration"]) {
                nextDuration = seconds * 1000
            }
        }

        let flaggedStale =
            bool(source["stale"]) || bool(playback["stale"]) || bool(runtime["stale"])
            || bool(data["stale"]) || bool(outer["stale"])
        let pastEnd = isPastExpectedEnd(startedAt: startedAt, expectedEndAt: expectedEndAt, durationMs: duration, now: now)

        return TotemPlaybackState(
            totemId: positiveInt(
                data["totemId"], data["totem_id"],
                outer["totemId"], outer["totem_id"],
                source["totemId"], source["totem_id"],
                fallbackTotemId
            ),
            mediaId: mediaIdString(source["mediaId"], source["media_id"], source["id"], media["id"]),
            mediaName: mediaName,
            mediaType: nonEmpty(string(source["mediaType"], source["media_type"], source["type"], media["type"])),
            durationMs: duration,
            startedAt: startedAt,
            expectedEndAt: expectedEndAt,
            endedAt: iso(source["endedAt"], source["ended_at"], playback["endedAt"], playback["ended_at"]),
            playedDurationMs: positiveDouble(source["playedDurationMs"], source["played_duration_ms"], playback["playedDurationMs"], playback["played_duration_ms"]),
            status: nonEmpty(string(source["status"], playback["status"], runtime["status"], data["status"], outer["status"])) ?? "playing",
            stale: flaggedStale || pastEnd,
            receivedAt: now,
            nextMediaName: nextName.isEmpty ? nil : nextName,
            nextMediaType: nonEmpty(string(nextSource["type"], nextSource["mediaType"], nextSource["media_type"])),
            nextMediaDurationMs: nextDuration
        )
    }

    private static func isPastExpectedEnd(startedAt: String?, expectedEndAt: String?, durationMs: Double, now: Date) -> Bool {
        let nowMs = now.timeIntervalSince1970 * 1000
        if let expectedEndAt, let end = ISO8601Helper.date(from: expectedEndAt) {
            if nowMs > end.timeIntervalSince1970 * 1000 + staleGraceMs { return true }
        }
        if let startedAt, let start = ISO8601Helper.date(from: startedAt), durationMs > 0 {
            if nowMs > start.timeIntervalSince1970 * 1000 + durationMs + staleGraceMs { return true }
        }
        return false
    }

    // MARK: - Helpers

    private static func asDict(_ value: Any?) -> [String: Any] {
        value as? [String: Any] ?? [:]
    }

    private static func bool(_ value: Any?) -> Bool {
        if let b = value as? Bool { return b }
        if let n = value as? NSNumber { return n.boolValue }
        if let s = value as? String {
            return ["1", "true", "yes"].contains(s.lowercased())
        }
        return false
    }

    private static func string(_ values: Any?...) -> String {
        for value in values {
            if let s = value as? String { return s }
            if let n = value as? NSNumber { return n.stringValue }
        }
        return ""
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value else { return nil }
        let t = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private static func positiveInt(_ values: Any?...) -> Int? {
        for value in values {
            if let i = value as? Int, i >= 0 { return i }
            if let d = value as? Double, d >= 0 { return Int(d) }
            if let n = value as? NSNumber, n.doubleValue >= 0 { return n.intValue }
            if let s = value as? String, let i = Int(s), i >= 0 { return i }
        }
        return nil
    }

    private static func positiveDouble(_ values: Any?...) -> Double? {
        for value in values {
            if let d = value as? Double, d >= 0, d.isFinite { return d }
            if let i = value as? Int, i >= 0 { return Double(i) }
            if let n = value as? NSNumber {
                let d = n.doubleValue
                if d >= 0, d.isFinite { return d }
            }
            if let s = value as? String, let d = Double(s), d >= 0, d.isFinite { return d }
        }
        return nil
    }

    private static func mediaIdString(_ values: Any?...) -> String? {
        for value in values {
            if let i = value as? Int { return String(i) }
            if let d = value as? Double, d.isFinite { return String(Int(d)) }
            if let n = value as? NSNumber { return n.stringValue }
            if let s = value as? String {
                let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
                if !t.isEmpty { return t }
            }
        }
        return nil
    }

    private static func iso(_ values: Any?...) -> String? {
        for value in values {
            guard let value else { continue }
            if let s = value as? String, ISO8601Helper.date(from: s) != nil {
                return ISO8601Helper.string(from: ISO8601Helper.date(from: s)!)
            }
        }
        return nil
    }
}

enum ISO8601Helper {
    private static let withFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func date(from string: String) -> Date? {
        withFractional.date(from: string) ?? plain.date(from: string)
    }

    static func string(from date: Date) -> String {
        withFractional.string(from: date)
    }
}

enum PlaybackFormatting {
    static func clock(_ milliseconds: Double) -> String {
        let total = max(0, Int(milliseconds / 1000))
        let m = total / 60
        let s = total % 60
        return String(format: "%02d:%02d", m, s)
    }

    static func timingLine(_ state: TotemPlaybackState, now: Date = Date()) -> String {
        switch state.status {
        case "display_off":
            return "Aguardando o próximo horário de funcionamento"
        case "idle":
            return "Aguardando o início da reprodução"
        case "empty":
            return "Sem estado de reprodução"
        case "ended", "stopped":
            let played = state.playedDurationMs ?? state.durationMs
            return "reproduzido \(clock(played))"
        case "error":
            return "erro de reprodução"
        default:
            return "\(clock(state.elapsedMs(now: now))) / \(clock(state.durationMs))"
        }
    }

    static func statusLabel(_ state: TotemPlaybackState) -> String {
        if state.stale { return "Stale (desatualizado)" }
        switch state.status.lowercased() {
        case "playing": return "A reproduzir"
        case "paused": return "Em pausa"
        case "buffering": return "A carregar"
        case "stopped", "ended": return "Parado"
        case "error": return "Erro"
        case "idle": return "Idle"
        case "display_off": return "Ecrã desligado"
        case "empty": return "Vazio"
        default: return state.status
        }
    }
}
