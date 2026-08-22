import Foundation
import Combine

enum PlaybackConnectionStatus: String {
    case connecting
    case connected
    case disconnected
}

/// Espelha `useTotemPlaybackTelemetry`: WS + poll REST (10 s offline / 15 s com WS).
@MainActor
final class PlaybackTelemetryService: ObservableObject {
    @Published private(set) var state: TotemPlaybackState?
    @Published private(set) var connectionStatus: PlaybackConnectionStatus = .disconnected
    @Published private(set) var lastError: String?

    private var totemId: Int?
    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession?
    private var pollTask: Task<Void, Never>?
    private var receiveTask: Task<Void, Never>?
    private var leaseTask: Task<Void, Never>?
    private var reconnectAttempt = 0
    private var disposed = false

    private let restFallbackSeconds: UInt64 = 10
    private let restReconcileSeconds: UInt64 = 15
    private let leaseTTLSeconds = 90
    private let leaseRenewSeconds: UInt64 = 60

    func start(totemId: Int) {
        stop()
        disposed = false
        self.totemId = totemId
        connectionStatus = .connecting
        lastError = nil
        connectWebSocket()
        startPolling()
        startLeaseLoop(totemId: totemId)
        Task { await fetchREST() }
    }

    func stop() {
        disposed = true
        pollTask?.cancel()
        pollTask = nil
        receiveTask?.cancel()
        receiveTask = nil
        leaseTask?.cancel()
        leaseTask = nil
        if let id = totemId {
            Task { await TotemService.stopTelemetryObservation(totemId: id) }
            sendUnsubscribe(totemId: id)
        }
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        session?.invalidateAndCancel()
        session = nil
        connectionStatus = .disconnected
        totemId = nil
    }

    func seed(from totem: Totem) {
        // Lista pode trazer nowPlaying residual; só usamos após fetch dedicado.
        _ = totem
    }

    // MARK: - REST

    private func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            while let self, !Task.isCancelled, !self.disposed {
                let seconds = self.connectionStatus == .connected
                    ? self.restReconcileSeconds
                    : self.restFallbackSeconds
                try? await Task.sleep(nanoseconds: seconds * 1_000_000_000)
                guard !Task.isCancelled, !self.disposed else { break }
                await self.fetchREST()
            }
        }
    }

    private func fetchREST() async {
        guard let totemId else { return }
        do {
            if let normalized = try await TotemService.fetchPlaybackState(totemId: totemId) {
                state = normalized
                lastError = nil
            } else if state == nil {
                state = TotemPlaybackState(
                    totemId: totemId,
                    mediaName: "Sem reprodução",
                    durationMs: 0,
                    status: "empty",
                    stale: false,
                    receivedAt: Date()
                )
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    // MARK: - Observation lease (MVP+)

    private func startLeaseLoop(totemId: Int) {
        leaseTask?.cancel()
        leaseTask = Task { [weak self] in
            do {
                try await TotemService.startTelemetryObservation(totemId: totemId, ttlSeconds: self?.leaseTTLSeconds ?? 90)
            } catch {
                // Lease é opcional; monitor continua com WS/REST.
            }
            while let self, !Task.isCancelled, !self.disposed {
                try? await Task.sleep(nanoseconds: self.leaseRenewSeconds * 1_000_000_000)
                guard !Task.isCancelled, !self.disposed else { break }
                do {
                    try await TotemService.renewTelemetryObservation(
                        totemId: totemId,
                        ttlSeconds: self.leaseTTLSeconds
                    )
                } catch {
                    // Ignorar falhas transitórias de renew.
                }
            }
        }
    }

    // MARK: - WebSocket

    private func connectWebSocket() {
        guard !disposed else { return }
        guard let token = KeychainStore.get(.accessToken), !token.isEmpty else {
            connectionStatus = .disconnected
            lastError = "Sem token de sessão"
            return
        }
        do {
            let url = try AppSettings.shared.webSocketURL(token: token)
            let config = URLSessionConfiguration.default
            let session = URLSession(configuration: config)
            self.session = session
            let task = session.webSocketTask(with: url)
            webSocketTask = task
            connectionStatus = .connecting
            task.resume()
            receiveTask?.cancel()
            receiveTask = Task { [weak self] in
                await self?.receiveLoop()
            }
            // Pequeno atraso para o handshake; depois subscreve.
            Task { [weak self] in
                try? await Task.sleep(nanoseconds: 300_000_000)
                guard let self, !self.disposed else { return }
                self.connectionStatus = .connected
                self.reconnectAttempt = 0
                if let id = self.totemId {
                    self.sendSubscribe(totemId: id)
                }
            }
        } catch {
            connectionStatus = .disconnected
            lastError = error.localizedDescription
            scheduleReconnect()
        }
    }

    private func receiveLoop() async {
        while !disposed, let task = webSocketTask {
            do {
                let message = try await task.receive()
                switch message {
                case .string(let text):
                    handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        handleMessage(text)
                    }
                @unknown default:
                    break
                }
            } catch {
                if !disposed {
                    connectionStatus = .disconnected
                    scheduleReconnect()
                }
                break
            }
        }
    }

    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = obj["type"] as? String else { return }

        if type == "totem_playback_state" {
            if let normalized = PlaybackNormalize.normalize(obj, fallbackTotemId: totemId) {
                state = normalized
                lastError = nil
            }
        }
        // totem_observation_sample: métricas extra — fora do MVP de metadados.
    }

    private func sendSubscribe(totemId: Int) {
        send(type: "subscribe_playback_state", totemId: totemId)
    }

    private func sendUnsubscribe(totemId: Int) {
        send(type: "unsubscribe_playback_state", totemId: totemId)
    }

    private func send(type: String, totemId: Int) {
        guard let task = webSocketTask else { return }
        let payload: [String: Any] = [
            "type": type,
            "data": ["totemId": totemId],
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let text = String(data: data, encoding: .utf8) else { return }
        task.send(.string(text)) { _ in }
    }

    private func scheduleReconnect() {
        guard !disposed else { return }
        reconnectAttempt += 1
        let delay = min(2.0 * pow(2.0, Double(reconnectAttempt - 1)), 30.0)
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            guard let self, !self.disposed else { return }
            self.webSocketTask?.cancel(with: .goingAway, reason: nil)
            self.webSocketTask = nil
            self.connectWebSocket()
        }
    }
}
