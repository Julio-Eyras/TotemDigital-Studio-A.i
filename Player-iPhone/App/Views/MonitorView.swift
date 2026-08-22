import SwiftUI

struct MonitorView: View {
    @StateObject private var model: MonitorViewModel
    @State private var now = Date()

    init(totemId: Int, seed: Totem? = nil) {
        _model = StateObject(wrappedValue: MonitorViewModel(totemId: totemId, seed: seed))
    }

    var body: some View {
        List {
            totemHeaderSection
            playbackSection
            connectionSection
            if let err = model.telemetry.lastError {
                Section("Avisos") {
                    Text(err)
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            }
        }
        .navigationTitle(model.totem?.name ?? "Monitor")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { model.onAppear() }
        .onDisappear { model.onDisappear() }
        .task {
            while !Task.isCancelled {
                now = Date()
                try? await Task.sleep(nanoseconds: 500_000_000)
            }
        }
    }

    @ViewBuilder
    private var totemHeaderSection: some View {
        Section("Totem") {
            if let totem = model.totem {
                LabeledContent("Nome", value: totem.name)
                LabeledContent("Estado", value: totem.statusLabel)
                if let local = totem.localName {
                    LabeledContent("Local", value: local)
                }
                if let playlist = totem.currentPlaylistId {
                    LabeledContent("Playlist", value: "#\(playlist)")
                } else {
                    LabeledContent("Playlist", value: "—")
                }
                if let count = totem.mediaCount {
                    LabeledContent("Mídias", value: "\(count)")
                }
                if let hb = totem.lastHeartbeat {
                    LabeledContent("Heartbeat", value: formatDate(hb))
                }
            } else if model.isLoadingTotem {
                ProgressView()
            } else if let err = model.totemError {
                Text(err).foregroundStyle(.red)
            }
        }
    }

    @ViewBuilder
    private var playbackSection: some View {
        Section("A reproduzir (metadados)") {
            if let state = model.telemetry.state {
                if state.stale {
                    Label("Dados stale — o progresso pode estar desactualizado", systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                        .font(.footnote)
                }

                LabeledContent("Estado", value: PlaybackFormatting.statusLabel(state))
                LabeledContent("Mídia", value: state.mediaName)
                if let type = state.mediaType {
                    LabeledContent("Tipo", value: type)
                }
                if let mediaId = state.mediaId {
                    LabeledContent("ID mídia", value: mediaId)
                }

                if state.status != "empty" && state.status != "idle" && state.status != "display_off" {
                    ProgressView(value: state.progressFraction(now: now)) {
                        Text("Progresso estimado")
                    } currentValueLabel: {
                        Text(PlaybackFormatting.timingLine(state, now: now))
                            .font(.caption.monospacedDigit())
                    }
                } else {
                    Text(PlaybackFormatting.timingLine(state, now: now))
                        .foregroundStyle(.secondary)
                }

                if let next = state.nextMediaName {
                    LabeledContent("Próxima", value: next)
                    if let nextType = state.nextMediaType {
                        LabeledContent("Tipo próxima", value: nextType)
                    }
                    if let nextDur = state.nextMediaDurationMs {
                        LabeledContent("Duração próxima", value: PlaybackFormatting.clock(nextDur))
                    }
                }
            } else {
                Text("A aguardar telemetria…")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var connectionSection: some View {
        Section("Ligação") {
            HStack {
                Circle()
                    .fill(connectionColor)
                    .frame(width: 8, height: 8)
                Text(connectionLabel)
            }
            Text("Actualização: WebSocket + poll REST (~10–15 s). Sem comando remoto neste MVP.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var connectionColor: Color {
        switch model.telemetry.connectionStatus {
        case .connected: return .green
        case .connecting: return .orange
        case .disconnected: return .red
        }
    }

    private var connectionLabel: String {
        switch model.telemetry.connectionStatus {
        case .connected: return "WebSocket ligado"
        case .connecting: return "A ligar WebSocket…"
        case .disconnected: return "WebSocket desligado (a usar REST)"
        }
    }

    private func formatDate(_ raw: String) -> String {
        if let date = ISO8601Helper.date(from: raw) {
            return date.formatted(date: .abbreviated, time: .standard)
        }
        return raw
    }
}
