package com.smartsignage.player.viewmodels

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import com.smartsignage.player.api.APIClient
import com.smartsignage.player.core.*
import com.smartsignage.player.models.*
import com.smartsignage.player.player.MediaPlayer
import kotlinx.coroutines.launch

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

    val playerState = MutableLiveData<PlayerState>()
    val errorMessage = MutableLiveData<String>()

    companion object {
        private const val TAG = "PlayerViewModel"
        private const val API_BASE_URL = "http://localhost:3000" // Configurar via SharedPreferences
        private const val TOTEM_UIN = "" // Configurar
        private const val TOTEM_SECRET = "" // Configurar
    }

    /**
     * Inicializa player
     */
    fun initialize() {
        viewModelScope.launch {
            try {
                playerState.value = PlayerState.Loading

                // Inicializar API client
                apiClient = APIClient(API_BASE_URL, TOTEM_UIN, TOTEM_SECRET)

                // Autenticar totem
                val authenticated = apiClient.authenticateTotem()
                if (!authenticated) {
                    playerState.value = PlayerState.Error("Falha na autenticação")
                    return@launch
                }

                // Inicializar componentes
                playlistManager = PlaylistManager(apiClient)
                scheduler = Scheduler()
                heartbeatService = HeartbeatService(apiClient)
                mediaPlayer = MediaPlayer(getApplication())
                playerContainer?.let { mediaPlayer?.setContainer(it) }

                // Iniciar heartbeat
                heartbeatService.start(viewModelScope)

                // Carregar e iniciar playlist
                loadAndStartPlaylist()

            } catch (e: Exception) {
                Log.e(TAG, "Initialization error", e)
                playerState.value = PlayerState.Error(e.message ?: "Erro desconhecido")
            }
        }
    }

    /**
     * Carrega e inicia playlist
     */
    private fun loadAndStartPlaylist() {
        viewModelScope.launch {
            try {
                val success = playlistManager.loadPlaylist()
                if (success) {
                    playNext()
                } else {
                    playerState.value = PlayerState.Error("Falha ao carregar playlist")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Load playlist error", e)
                playerState.value = PlayerState.Error("Erro ao carregar playlist")
            }
        }
    }

    /**
     * Reproduz próximo item
     */
    private fun playNext() {
        viewModelScope.launch {
            val item = playlistManager.getNextItem()
            if (item == null) {
                playerState.value = PlayerState.Idle
                return@launch
            }

            // Verificar agendamento
            if (!scheduler.shouldDisplay(item)) {
                playNext() // Pular para próximo
                return@launch
            }

            try {
                playerState.value = PlayerState.Playing(item)
                mediaPlayer?.play(item) {
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
     * Cleanup
     */
    fun cleanup() {
        heartbeatService.stop()
        mediaPlayer?.release()
        mediaPlayer = null
    }
}

