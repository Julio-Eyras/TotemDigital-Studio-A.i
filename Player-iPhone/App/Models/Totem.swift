import Foundation

struct TotemListResponse: Decodable {
    let data: [Totem]?
    let totems: [Totem]?
    let total: Int?
    let page: Int?
    let limit: Int?

    var items: [Totem] {
        data ?? totems ?? []
    }
}

struct Totem: Identifiable, Equatable, Hashable {
    let id: Int
    var name: String
    var status: String
    var lastHeartbeat: String?
    var localName: String?
    var identifier: String?
    var uin: String?
    var currentPlaylistId: Int?
    var mediaCount: Int?
    var isActive: Bool
    var nowPlayingSeed: [String: Any]?

    var isOnline: Bool {
        status.lowercased() == "online"
    }

    var statusLabel: String {
        switch status.lowercased() {
        case "online": return "Online"
        case "offline": return "Offline"
        case "error": return "Erro"
        case "pending_approval": return "Aguarda aprovação"
        default: return status.isEmpty ? "Desconhecido" : status
        }
    }
}

extension Totem: Decodable {
    enum CodingKeys: String, CodingKey {
        case totem_id, id, name, identifier, uin, status
        case last_heartbeat, lastHeartbeat
        case local_name, localName, location
        case current_playlist_id, currentPlaylistId
        case media_count, mediaCount
        case is_active, isActive, active
        case nowPlaying, now_playing, runtime
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(Int.self, forKey: .totem_id)
            ?? c.decodeIfPresent(Int.self, forKey: .id)
            ?? 0
        name = try c.decodeIfPresent(String.self, forKey: .name)
            ?? c.decodeIfPresent(String.self, forKey: .identifier)
            ?? "Totem #\(id)"
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "offline"
        lastHeartbeat = try c.decodeIfPresent(String.self, forKey: .last_heartbeat)
            ?? c.decodeIfPresent(String.self, forKey: .lastHeartbeat)
        localName = try c.decodeIfPresent(String.self, forKey: .local_name)
            ?? c.decodeIfPresent(String.self, forKey: .localName)
            ?? c.decodeIfPresent(String.self, forKey: .location)
        identifier = try c.decodeIfPresent(String.self, forKey: .identifier)
        uin = try c.decodeIfPresent(String.self, forKey: .uin)
        currentPlaylistId = try c.decodeIfPresent(Int.self, forKey: .current_playlist_id)
            ?? c.decodeIfPresent(Int.self, forKey: .currentPlaylistId)
        mediaCount = try c.decodeIfPresent(Int.self, forKey: .media_count)
            ?? c.decodeIfPresent(Int.self, forKey: .mediaCount)
        let activeFlag = try c.decodeIfPresent(Bool.self, forKey: .is_active)
            ?? c.decodeIfPresent(Bool.self, forKey: .isActive)
            ?? c.decodeIfPresent(Bool.self, forKey: .active)
        isActive = activeFlag ?? true
        nowPlayingSeed = nil
    }

    static func == (lhs: Totem, rhs: Totem) -> Bool {
        lhs.id == rhs.id
            && lhs.name == rhs.name
            && lhs.status == rhs.status
            && lhs.lastHeartbeat == rhs.lastHeartbeat
            && lhs.mediaCount == rhs.mediaCount
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
