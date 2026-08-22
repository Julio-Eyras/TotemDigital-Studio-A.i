package br.com.smartchannel.playeradmon.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import br.com.smartchannel.playeradmon.ui.viewmodel.AuthViewModel

@Composable
fun LoginScreen(viewModel: AuthViewModel) {
    val serverUrl by viewModel.serverUrl.collectAsState()
    val username by viewModel.username.collectAsState()
    val password by viewModel.password.collectAsState()
    val twoFactorCode by viewModel.twoFactorCode.collectAsState()
    val pending2fa by viewModel.pendingTwoFactorUser.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.errorMessage.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Player-AD-MON", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Monitorização de totens — só metadados de reprodução (sem comando remoto).",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
        )

        Spacer(Modifier.height(8.dp))

        if (pending2fa != null) {
            Text("Autenticação de dois factores", style = MaterialTheme.typography.titleMedium)
            Text(
                "Introduza o código da app autenticadora ou um código de backup.",
                style = MaterialTheme.typography.bodySmall,
            )
            OutlinedTextField(
                value = twoFactorCode,
                onValueChange = viewModel::updateTwoFactorCode,
                label = { Text("Código 2FA") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
            Button(
                onClick = viewModel::verifyTwoFactor,
                enabled = !isLoading,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Verificar") }
            OutlinedButton(
                onClick = viewModel::cancelTwoFactor,
                enabled = !isLoading,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Voltar") }
        } else {
            Text("Servidor", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = serverUrl,
                onValueChange = viewModel::updateServerUrl,
                label = { Text("URL (https://host:porta)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            )
            Text(
                "URL editável para multi-instalação. Não use barra final.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
            )

            Text("Credenciais", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = username,
                onValueChange = viewModel::updateUsername,
                label = { Text("Utilizador") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = password,
                onValueChange = viewModel::updatePassword,
                label = { Text("Palavra-passe") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
            )
            Button(
                onClick = viewModel::login,
                enabled = !isLoading,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Entrar") }
        }

        if (error != null) {
            Text(error!!, color = MaterialTheme.colorScheme.error)
        }

        if (isLoading) {
            CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
            Text("A autenticar…", modifier = Modifier.align(Alignment.CenterHorizontally))
        }

        Spacer(Modifier.height(16.dp))
        Text(
            viewModel.versionLine,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
        )
    }
}
