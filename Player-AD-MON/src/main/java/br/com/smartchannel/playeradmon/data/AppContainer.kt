package br.com.smartchannel.playeradmon.data

import android.content.Context
import br.com.smartchannel.playeradmon.data.auth.AuthRepository
import br.com.smartchannel.playeradmon.data.auth.SecureTokenStore
import br.com.smartchannel.playeradmon.data.network.ApiClient
import br.com.smartchannel.playeradmon.data.settings.AppSettings
import br.com.smartchannel.playeradmon.data.telemetry.PlaybackTelemetryService
import br.com.smartchannel.playeradmon.data.totem.TotemRepository

class AppContainer(context: Context) {
    val settings = AppSettings(context.applicationContext)
    val tokenStore = SecureTokenStore(context.applicationContext)
    val apiClient = ApiClient(settings, tokenStore)
    val authRepository = AuthRepository(apiClient, tokenStore)
    val totemRepository = TotemRepository(apiClient)

    fun createTelemetryService(): PlaybackTelemetryService =
        PlaybackTelemetryService(apiClient, totemRepository, settings, tokenStore)
}
