import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var auth: AuthService
    @EnvironmentObject private var settings: AppSettings
    @State private var draftURL: String = ""
    @State private var showLogoutConfirm = false
    @State private var saveMessage: String?

    var body: some View {
        Form {
            Section("Servidor") {
                TextField("URL base", text: $draftURL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                Text("Ex.: https://studio.exemplo.com ou http://192.168.1.10:3000")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button("Guardar URL") {
                    settings.serverURL = draftURL.trimmingCharacters(in: .whitespacesAndNewlines)
                    saveMessage = settings.normalizedServerURL != nil
                        ? "URL guardada."
                        : "URL inválida — verifique o formato."
                }
                if let saveMessage {
                    Text(saveMessage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Actualização") {
                Stepper(
                    value: $settings.pollIntervalSeconds,
                    in: 10...20,
                    step: 1
                ) {
                    Text("Poll REST: \(Int(settings.pollIntervalSeconds)) s")
                }
                Text("Com WebSocket ligado usa ~15 s de reconciliação; sem WS usa o intervalo acima (mín. 10 s).")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Sessão") {
                if let user = auth.currentUser {
                    LabeledContent("Utilizador", value: user.displayName)
                    if let role = user.role {
                        LabeledContent("Perfil", value: role)
                    }
                }
                Button("Terminar sessão", role: .destructive) {
                    showLogoutConfirm = true
                }
            }

            Section("Sobre") {
                LabeledContent("Aplicação", value: AppVersion.displayName)
                LabeledContent("Versão", value: AppVersion.marketing)
                LabeledContent("Build", value: AppVersion.build)
                Text(AppVersion.roleDescription)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Não é player/kiosk. Não envia heartbeat platform:ios. Sem comandos remotos no MVP.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Definições")
        .onAppear {
            draftURL = settings.serverURL
        }
        .confirmationDialog(
            "Terminar sessão?",
            isPresented: $showLogoutConfirm,
            titleVisibility: .visible
        ) {
            Button("Terminar sessão", role: .destructive) {
                Task { await auth.logout() }
            }
            Button("Cancelar", role: .cancel) {}
        }
    }
}
