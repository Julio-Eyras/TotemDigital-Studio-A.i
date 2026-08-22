import SwiftUI

struct LoginView: View {
    @StateObject private var model = LoginViewModel()
    @EnvironmentObject private var auth: AuthService

    private var needsTwoFactor: Bool {
        auth.pendingTwoFactorUser != nil
    }

    var body: some View {
        Form {
            Section {
                Label("Player-iPhone", systemImage: "iphone")
                    .font(.largeTitle.bold())
                    .frame(maxWidth: .infinity)
                    .labelStyle(.titleAndIcon)
                    .listRowBackground(Color.clear)
                Text(AppVersion.roleDescription)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
            }

            if needsTwoFactor {
                twoFactorSection
            } else {
                credentialsSection
            }

            if let error = model.errorMessage {
                Section {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
            }

            Section {
                Text(AppVersion.versionLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Entrar")
        .disabled(model.isLoading)
        .overlay {
            if model.isLoading {
                ProgressView("A autenticar…")
                    .padding()
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private var credentialsSection: some View {
        Group {
            Section("Servidor") {
                TextField("URL (https://host:porta)", text: $model.serverURL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                Text("URL editável para multi-instalação. Não use barra final.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Credenciais") {
                TextField("Utilizador", text: $model.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Palavra-passe", text: $model.password)
                Button("Entrar") {
                    Task { await model.login() }
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    private var twoFactorSection: some View {
        Section("Autenticação de dois factores") {
            Text("Introduza o código da app autenticadora ou um código de backup.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            TextField("Código 2FA", text: $model.twoFactorCode)
                .keyboardType(.numberPad)
                .textInputAutocapitalization(.never)
            Button("Verificar") {
                Task { await model.verifyTwoFactor() }
            }
            .buttonStyle(.borderedProminent)
            Button("Voltar", role: .cancel) {
                model.cancelTwoFactor()
            }
        }
    }
}
