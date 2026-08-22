import Foundation

struct AuthUser: Codable, Equatable, Identifiable {
    let id: Int
    var username: String?
    var name: String?
    var email: String?
    var role: String?
    var subscriberId: Int?
    var publisherId: Int?

    enum CodingKeys: String, CodingKey {
        case id, username, name, email, role
        case subscriberId = "subscriberId"
        case publisherId = "publisherId"
        case subscriber_id
        case publisher_id
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        username = try c.decodeIfPresent(String.self, forKey: .username)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        email = try c.decodeIfPresent(String.self, forKey: .email)
        role = try c.decodeIfPresent(String.self, forKey: .role)
        subscriberId = try c.decodeIfPresent(Int.self, forKey: .subscriberId)
            ?? c.decodeIfPresent(Int.self, forKey: .subscriber_id)
        publisherId = try c.decodeIfPresent(Int.self, forKey: .publisherId)
            ?? c.decodeIfPresent(Int.self, forKey: .publisher_id)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encodeIfPresent(username, forKey: .username)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(email, forKey: .email)
        try c.encodeIfPresent(role, forKey: .role)
        try c.encodeIfPresent(subscriberId, forKey: .subscriberId)
        try c.encodeIfPresent(publisherId, forKey: .publisherId)
    }

    var displayName: String {
        let raw = name?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let raw, !raw.isEmpty { return raw }
        let user = username?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let user, !user.isEmpty { return user }
        return email ?? "Utilizador #\(id)"
    }
}

struct LoginRequestBody: Encodable {
    let username: String
    let password: String
}

struct LoginAPIResponse: Decodable {
    let message: String?
    let token: String?
    let refreshToken: String?
    let requiresTwoFactor: Bool?
    let user: AuthUser?
    let error: String?
}

struct TwoFactorVerifyBody: Encodable {
    let userId: Int
    let code: String
}

struct RefreshTokenBody: Encodable {
    let refreshToken: String
}

struct RefreshTokenAPIResponse: Decodable {
    let token: String
    let refreshToken: String
}

struct APIErrorBody: Decodable {
    let error: String?
    let message: String?
}
