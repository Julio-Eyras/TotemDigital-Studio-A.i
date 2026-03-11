package com.smartsignage.player.viewmodels

import android.app.Application
import android.provider.Settings
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.smartsignage.player.api.APIClient
import com.smartsignage.player.core.*
import com.smartsignage.player.models.*
import com.smartsignage.player.player.MediaPlayer
import com.smartsignage.player.discovery.TotemDiscoveryService
import com.smartsignage.player.storage.StorageHelper
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

/**
 * PlayerViewModel - Android
 * ViewModel para gerenciar estado do player
 */
class PlayerViewModel(application: Application) : AndroidViewModel(application) {

    private lateinit var apiClient: APIClient
    private lateinit var playlistManager: PlaylistManager
    private lateinit var scheduler: Scheduler
    private lateinit var heartbeatService: HeartbeatService
    private var mediaPlayer: MediaPlayer? = null
    private var playerContainer: android.view.ViewGroup? = null
    private var deviceToken: String? = null
    private var deviceId: String = ""
    private var discoveryService: TotemDiscoveryService? = null

    val playerState = MutableLiveData<PlayerState>()
    val errorMessage = MutableLiveData<String>()
    /** Info de storage para o painel Debug (interno + USB, ordem, ficheiros, espaço) */
    val debugStorageInfo = MutableLiveData<StorageHelper.DebugStorageInfo?>()

    companion object {
        private const val TAG = "PlayerViewModel"
        private const val API_BASE_URL = "http://localhost:3000" // Configurar via SharedPreferences
        private const val TOTEM_UIN = "" // TODO: Configurar (SharedPreferences / config remota)
        private const val TOTEM_SECRET = "" // TODO: Configurar (SharedPreferences / config remota)
        private const val PLATFORM = "android"
    }

    /**
     * Inicializa player
     */
    fun initialize() {
        viewModelScope.launch {
            try {
                playerState.value = PlayerState.Loading

                // Obter deviceId estável do Android
                deviceId = Settings.Secure.getString(
                    getApplication<Application>().contentResolver,
                    Settings.Secure.ANDROID_ID
                ) ?: "android-device-${System.currentTimeMillis()}"

                // Inicializar API client
                apiClient = APIClient(API_BASE_URL, TOTEM_UIN, TOTEM_SECRET)

                // NOVO FLUXO: Obter token de dispositivo via /api/player/token
                val deviceTokenResponse = apiClient.getDeviceToken(
                    uin = TOTEM_UIN,
                    deviceId = deviceId,
                    platform = PLATFORM,
                    appVersion = BuildConfig.VERSION_NAME
                )

                if (deviceTokenResponse == null || deviceTokenResponse.token.isEmpty()) {
                    playerState.value = PlayerState.Error("Falha ao obter token de dispositivo")
                    return@launch
                }

                deviceToken = deviceTokenResponse.token

                // Obter deviceId
                deviceId = android.provider.Settings.Secure.getString(
                    getApplication<Application>().contentResolver,
                    android.provider.Settings.Secure.ANDROID_ID
                ) ?: "android-${System.currentTimeMillis()}"
                
                // Obter token de dispositivo (novo fluxo)
                try {
                    val tokenResponse = apiClient.getDeviceToken(
                        TOTEM_UIN,
                        deviceId!!,
                        "android",
                        "2.1.0"
                    )
                    deviceToken = tokenResponse?.token
                    if (deviceToken != null) {
                        apiClient.token = deviceToken
                        Log.i(TAG, "Device token obtido com sucesso")
                    } else {
                        Log.w(TAG, "Falha ao obter device token, usando autenticação legada")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Erro ao obter device token, usando autenticação legada", e)
                }

                // Inicializar componentes (com contexto para cache)
                playlistManager = PlaylistManager(apiClient, getApplication())
                playlistManager.getStorageHelper()?.ensurePropagandasDirs()
                scheduler = Scheduler()
                heartbeatService = HeartbeatService(apiClient)
                mediaPlayer = MediaPlayer(getApplication())
                playerContainer?.let { mediaPlayer?.setContainer(it) }
                
                // Configurar callback para obter caminhos locais de mídias
                mediaPlayer?.setLocalPathProvider { mediaId ->
                    playlistManager.getLocalPath(mediaId)
                }

                // Inicializar serviço de descoberta mDNS (NSD)
                discoveryService = TotemDiscoveryService(getApplication())
                try {
                    discoveryService?.registerTotem(TOTEM_UIN, 8080)
                    Log.i(TAG, "Totem registrado via mDNS para descoberta automática")
                } catch (e: Exception) {
                    Log.w(TAG, "Falha ao registrar mDNS (totem ainda funcionará normalmente)", e)
                }

                // Iniciar heartbeat
                heartbeatService.start(viewModelScope)

                // Carregar e iniciar conteúdo via DispatchPlan (aplica config do backend antes)
                loadAndStartFromDispatchPlan()

            } catch (e: Exception) {
                Log.e(TAG, "Initialization error", e)
                playerState.value = PlayerState.Error(e.message ?: "Erro desconhecido")
            }
        }
    }

    /**
     * Carrega e inicia conteúdo via DispatchPlan.
     * Aplica config do backend (ex.: storage externo/interno) antes de carregar o plano.
     * Em caso de falha, tenta modo offline e depois fluxo legado de playlist.
     */
    private fun loadAndStartFromDispatchPlan() {
        viewModelScope.launch {
            try {
                // Aplicar config administrativa (storage externo/interno) antes de processar plano
                try {
                    val config = apiClient.getConfig()
                    config?.storageUseExternalFirst?.let { useExternal ->
                        playlistManager.getStorageHelper()?.useExternalFirst = useExternal
                        Log.i(TAG, "Config aplicada: storageUseExternalFirst=$useExternal")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Erro ao obter config do player (usando defaults)", e)
                }

                val token = deviceToken
                if (token == null || TOTEM_UIN.isEmpty()) {
                    playerState.value = PlayerState.Error("Configuração de UIN/token inválida")
                    return@launch
                }

                val timezone = java.util.TimeZone.getDefault().id
                val success = playlistManager.loadFromDispatchPlan(
                    uin = TOTEM_UIN,
                    deviceToken = token,
                    deviceId = deviceId ?: "",
                    timezone = timezone
                )

                if (success) {
                    playNext()
                } else {
                    // Fallback 1: tentar modo offline (último DispatchPlan em cache)
                    Log.w(TAG, "Falha ao carregar DispatchPlan, tentando modo offline...")
                    val lastPlan = playlistManager.loadLastDispatchPlanFromCache()
                    if (lastPlan != null) {
                        Log.i(TAG, "Usando último DispatchPlan em cache (modo offline)")
                        // Usar DispatchPlan diretamente (sem conversão)
                        playlistManager.currentDispatchPlan = lastPlan
                        playlistManager.currentIndex = 0
                        playNext()
                        return@launch
                    }
                    
                    // Fallback 2: tentar fluxo legado de playlist
                    Log.w(TAG, "Modo offline falhou, tentando playlist legada")
                    val legacySuccess = playlistManager.loadLegacyPlaylist()
                    if (legacySuccess) {
                        playNext()
                    } else {
                        playerState.value = PlayerState.Error("Falha ao carregar conteúdo (dispatcher, offline e playlist legada)")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Load dispatch plan error", e)
                
                // Último recurso: tentar modo offline
                try {
                    val lastPlan = playlistManager.loadLastDispatchPlanFromCache()
                    if (lastPlan != null) {
                        // Usar DispatchPlan diretamente (sem conversão)
                        playlistManager.currentDispatchPlan = lastPlan
                        playlistManager.currentIndex = 0
                        playNext()
                        return@launch
                    }
                } catch (offlineError: Exception) {
                    Log.e(TAG, "Erro no modo offline", offlineError)
                }
                
                playerState.value = PlayerState.Error("Erro ao carregar plano de exibição")
            }
        }
    }

    /**
     * Reproduz próximo item (agora usa DispatchPlanMediaItem diretamente)
     */
    private fun playNext() {
        viewModelScope.launch {
            val mediaItem = playlistManager.getNextItem() // Retorna DispatchPlanMediaItem
            if (mediaItem == null) {
                playerState.value = PlayerState.Idle
                return@launch
            }

            // Verificar agendamento (se necessário - DispatchPlan já aplicou regras)
            // Nota: DispatchPlan já considera agendamento, mas podemos validar localmente se necessário
            val dispatchPlan = playlistManager.getCurrentDispatchPlan()
            if (dispatchPlan != null) {
                // Validar validade temporal se disponível
                val now = System.currentTimeMillis()
                val validityStart = dispatchPlan.validityStart?.let { 
                    java.time.Instant.parse(it).toEpochMilli() 
                }
                val validityEnd = dispatchPlan.validityEnd?.let { 
                    java.time.Instant.parse(it).toEpochMilli() 
                }
                
                if (validityStart != null && now < validityStart) {
                    Log.d(TAG, "DispatchPlan ainda não válido, aguardando...")
                    // Aguardar até ser válido ou tentar próximo
                    playNext()
                    return@launch
                }
                
                if (validityEnd != null && now > validityEnd) {
                    Log.d(TAG, "DispatchPlan expirado, recarregando...")
                    // Recarregar DispatchPlan
                    loadAndStartFromDispatchPlan()
                    return@launch
                }
            }

            try {
                // Usar DispatchPlanMediaItem diretamente (sem conversão)
                playerState.value = PlayerState.Playing(mediaItem)
                mediaPlayer?.play(mediaItem) {
                    // Callback quando termina
                    playNext()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Play error", e)
                playNext() // Tentar próximo
            }
        }
    }

    /**
     * Configura container do player
     */
    fun setPlayerContainer(container: android.view.ViewGroup) {
        this.playerContainer = container
        mediaPlayer?.setContainer(container)
    }

    /**
     * Resume player
     */
    fun resume() {
        mediaPlayer?.resume()
    }

    /**
     * Pause player
     */
    fun pause() {
        mediaPlayer?.pause()
    }

    /**
     * Atualiza info de storage para o painel Debug (interno + USB, propagandas, espaço livre)
     */
    fun refreshDebugStorageInfo() {
        viewModelScope.launch {
            val info = withContext(Dispatchers.IO) { playlistManager.getDebugStorageInfo() }
            debugStorageInfo.postValue(info)
        }
    }

    /**
     * Cleanup
     */
    fun cleanup() {
        heartbeatService.stop()
        mediaPlayer?.release()
        mediaPlayer = null
        
        // Desregistrar totem via mDNS
        discoveryService?.unregisterTotem()
        discoveryService = null
    }
    
    override fun onCleared() {
        super.onCleared()
        cleanup()
    }
}

