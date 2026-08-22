import Foundation

enum AppVersion {
    static let marketing = "0.1.0"
    static let build = "1"
    static let displayName = "Player-iPhone"
    static let roleDescription = "Monitor de totens (apenas visualização)"

    static var versionLine: String {
        "\(displayName) Vs\(marketing) build \(build)"
    }
}
