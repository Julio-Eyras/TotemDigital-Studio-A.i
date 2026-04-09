package com.smartsignage.player.hls

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.*

/**
 * MainActivity - Aplicação principal do SmartSignage Android TV HLS Player
 */
class MainActivity : AppCompatActivity() {
    private var playerView: PlayerView? = null
    private lateinit var hlsPlayer: HLSPlayer
    private lateinit var deviceInfo: DeviceInfoService
    private lateinit var commandFetcher: CommandFetcher
    private lateinit var heartbeatService: HeartbeatService
    private lateinit var fallbackManager: FallbackManager
    
    private var config: Config? = null
    private var uin: String? = null
    private var token: String? = null
    
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    companion object {
        private const val TAG = "MainActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Layout minimalista - criar PlayerView programaticamente
        playerView = PlayerView(this).apply {
            useController = false // Modo kiosk
            layoutParams = android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        setContentView(playerView)
        
        // Inicializar em background
        scope.launch {
            try {
                initialize()
            } catch (error: Exception) {
                Log.e(TAG, "Erro na inicialização", error)
                initializeFallbackMode()
            }
        }
    }

    /**
     * Inicializa a aplicação
     */
    private suspend fun initialize() = withContext(Dispatchers.Main) {
        Log.d(TAG, "Inicializando SmartSignage Android TV Player HLS...")

        // 1. Carregar configuração
        loadConfig()

        // 2. Inicializar DeviceInfo
        deviceInfo = DeviceInfoService(this@MainActivity)
        uin = deviceInfo.getUIN() ?: run {
            val hardwareInfo = deviceInfo.collectHardwareInfo()
            deviceInfo.generateUIN(hardwareInfo).also {
                deviceInfo.saveUIN(it)
            }
        }

        // 3. Obter token
        token = getToken()

        // 4. Validar totem
        val validation = validateTotem()

        // 5. Inicializar componentes
        initializeComponents(validation)

        // 6. Iniciar serviços
        startServices()

        // 7. Reproduzir stream inicial
        startPlayback(validation)

        Log.d(TAG, "Aplicação inicializada com sucesso!")
    }

    /**
     * Carrega configuração
     */
    private fun loadConfig() {
        // Por enquanto, configuração hardcoded
        // Em produção, carregar de SharedPreferences ou arquivo
        config = Config(
            apiBaseUrl = "http://192.168.1.100:3000/api",
            streamUrl = "http://192.168.1.100:3000/hls/canal01/playlist.m3u8",
            heartbeatInterval = 30000,
            commandPollInterval = 15000,
            watchdogInterval = 20000,
            fallbackUrls = listOf(
                "/media/usb/fallback.mp4",
                "/media/internal/fallback.mp4"
            )
        )
    }

    /**
     * Obtém token de autenticação
     */
    private suspend fun getToken(): String? = withContext(Dispatchers.IO) {
        try {
            val response = okhttp3.OkHttpClient().newCall(
                okhttp3.Request.Builder()
                    .url("${config!!.apiBaseUrl}/player/token?uin=$uin")
                    .build()
            ).execute()

            if (response.isSuccessful) {
                val result = response.body?.string()
                // Parse JSON (simplificado)
                Log.d(TAG, "Token obtido")
                return@withContext result
            }
        } catch (error: Exception) {
            Log.w(TAG, "Erro ao obter token", error)
        }
        null
    }

    /**
     * Valida totem no backend
     */
    private suspend fun validateTotem(): ValidationResult? = withContext(Dispatchers.IO) {
        try {
            val response = okhttp3.OkHttpClient().newCall(
                okhttp3.Request.Builder()
                    .url("${config!!.apiBaseUrl}/player/validate?uin=$uin&token=$token")
                    .build()
            ).execute()

            if (response.isSuccessful) {
                val result = response.body?.string()
                // Parse JSON (simplificado)
                Log.d(TAG, "Totem validado")
                return@withContext ValidationResult(streamUrl = config!!.streamUrl)
            }
        } catch (error: Exception) {
            Log.w(TAG, "Erro ao validar totem", error)
        }
        null
    }

    /**
     * Inicializa componentes principais
     */
    private suspend fun initializeComponents(validation: ValidationResult?) = withContext(Dispatchers.Main) {
        // 1. Player HLS
        hlsPlayer = HLSPlayer(this@MainActivity)
        hlsPlayer.initialize()
        
        // Conectar ao PlayerView
        playerView?.player = hlsPlayer.getExoPlayer()
        
        // Configurar callback de erro
        hlsPlayer.onError = { error ->
            Log.e(TAG, "Erro no player", error)
            scope.launch {
                fallbackManager.handleError()
            }
        }

        // 2. Fallback Manager
        val primaryStream = validation?.streamUrl ?: config!!.streamUrl
        fallbackManager = FallbackManager(primaryStream, config!!.fallbackUrls)
        fallbackManager.setPlayer(hlsPlayer)

        // 3. Command Fetcher
        commandFetcher = CommandFetcher(
            config!!.apiBaseUrl,
            uin!!,
            config!!.commandPollInterval
        )
        commandFetcher.setToken(token)
        commandFetcher.onCommand = { command ->
            scope.launch {
                processCommand(command)
            }
        }

        // 4. Heartbeat Service (corpo e URL alinhados ao Dispatcher)
        val hwForHb = deviceInfo.collectHardwareInfo()
        heartbeatService = HeartbeatService(
            config!!.apiBaseUrl,
            uin!!,
            config!!.heartbeatInterval,
            hwForHb.deviceId
        )
        heartbeatService.setToken(token)
        heartbeatService.setCallbacks(
            { hlsPlayer.getStatus() },
            { hlsPlayer.getCurrentStream() }
        )
    }

    /**
     * Inicia serviços
     */
    private fun startServices() {
        hlsPlayer.startWatchdog(config!!.watchdogInterval)
        commandFetcher.start()
        heartbeatService.start()
    }

    /**
     * Inicia reprodução do stream inicial
     */
    private suspend fun startPlayback(validation: ValidationResult?) {
        val streamUrl = validation?.streamUrl ?: config!!.streamUrl
        if (streamUrl != null) {
            Log.d(TAG, "Iniciando reprodução: $streamUrl")
            try {
                hlsPlayer.play(streamUrl)
            } catch (error: Exception) {
                Log.e(TAG, "Erro ao iniciar reprodução", error)
            }
        }
    }

    /**
     * Processa comandos recebidos
     */
    private suspend fun processCommand(command: Command) {
        Log.d(TAG, "Processando comando: ${command.action}")
        
        when (command.action) {
            "PLAY" -> command.stream?.let { hlsPlayer.play(it) }
            "STOP" -> hlsPlayer.stop()
            "PAUSE" -> hlsPlayer.pause()
            "RESUME" -> hlsPlayer.resume()
            "RESTART" -> recreate()
            "SET_VOLUME" -> command.volume?.let { hlsPlayer.setVolume(it) }
            else -> Log.w(TAG, "Comando desconhecido: ${command.action}")
        }
    }

    /**
     * Inicializa modo fallback
     */
    private suspend fun initializeFallbackMode() {
        Log.d(TAG, "Inicializando modo fallback...")
        
        hlsPlayer = HLSPlayer(this)
        hlsPlayer.initialize()
        playerView?.player = hlsPlayer.getExoPlayer()
        
        val fallbackUrls = config?.fallbackUrls ?: listOf("/media/usb/fallback.mp4")
        for (url in fallbackUrls) {
            try {
                hlsPlayer.play(url)
                Log.d(TAG, "Fallback ativado: $url")
                return
            } catch (error: Exception) {
                Log.w(TAG, "Fallback falhou: $url", error)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        hlsPlayer.release()
        commandFetcher.stop()
        heartbeatService.stop()
        scope.cancel()
    }
}


