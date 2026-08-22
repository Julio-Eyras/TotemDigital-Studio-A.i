import SwiftUI

struct TotemListView: View {
    @StateObject private var model = TotemListViewModel()

    var body: some View {
        List {
            if let error = model.errorMessage {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
            }

            Section {
                if model.totems.isEmpty && !model.isLoading {
                    VStack(spacing: 8) {
                        Image(systemName: "tv.slash")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text("Sem totens")
                            .font(.headline)
                        Text("Não há totens activos visíveis para a sua conta, ou a lista ainda não foi carregada.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                } else {
                    ForEach(model.totems) { totem in
                        NavigationLink(value: totem) {
                            TotemRowView(totem: totem)
                        }
                    }
                }
            } header: {
                if let last = model.lastRefresh {
                    Text("Actualizado \(last.formatted(date: .omitted, time: .shortened))")
                }
            }
        }
        .navigationTitle("Totens")
        .navigationDestination(for: Totem.self) { totem in
            MonitorView(totemId: totem.id, seed: totem)
        }
        .searchable(text: $model.searchText, prompt: "Pesquisar totem")
        .refreshable { await model.refresh() }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await model.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(model.isLoading)
            }
        }
        .overlay {
            if model.isLoading && model.totems.isEmpty {
                ProgressView("A carregar totens…")
            }
        }
        .task {
            await model.refresh()
        }
        .onChange(of: model.searchText) { _ in
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await model.refresh()
            }
        }
    }
}

struct TotemRowView: View {
    let totem: Totem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(totem.isOnline ? Color.green : Color.gray)
                .frame(width: 10, height: 10)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 4) {
                Text(totem.name)
                    .font(.headline)
                Text(totem.statusLabel)
                    .font(.subheadline)
                    .foregroundStyle(totem.isOnline ? .green : .secondary)
                if let local = totem.localName, !local.isEmpty {
                    Text(local)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let hb = totem.lastHeartbeat {
                    Text("Último heartbeat: \(Self.formatHeartbeat(hb))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if let count = totem.mediaCount {
                    Text("Mídias activas: \(count)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private static func formatHeartbeat(_ raw: String) -> String {
        if let date = ISO8601Helper.date(from: raw) {
            return date.formatted(date: .abbreviated, time: .shortened)
        }
        return raw
    }
}
