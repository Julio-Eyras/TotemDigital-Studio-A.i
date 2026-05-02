package com.smartotem.player

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import android.view.WindowManager
import android.widget.Toast
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.Player
import com.google.android.exoplayer2.ui.StyledPlayerView
import com.smartotem.player.api.ApiService
import com.smartotem.player.api.WebSocketClient
import com.smartotem.player.models.Media
import com.smartotem.player.models.PlaylistMedia
import com.smartotem.player.models.StatusUpdate
import com.smartotem.player.models.WebSocketCommand
import kotlinx.coroutines.launch
import okhttp3.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

class MainActivity : FragmentActivity(), WebSocketClient.WebSocketListenerCallback {

    private val TAG = "MainActivity"

    // Configurações
    private val BACKEND_URL = "http://localhost:3000/" // Substituir pela URL real do backend
    private val WEBSOCKET_URL = "ws://localhost:3000/ws" // Substituir pela URL real do WebSocket
    private val TOTEM_ID = "TOTEM_ANDROID_001" // ID único do totem (seria obtido após registro)
    private val AUTH_TOKEN = "Bearer YOUR_AUTH_TOKEN" // Token de autenticação (seria obtido após registro)

    private lateinit var playerView: StyledPlayerView
    private var exoPlayer: ExoPlayer? = null
    private lateinit var apiService: ApiService
    private lateinit var webSocketClient: WebSocketClient

    private var currentPlaylist: List<PlaylistMedia> = emptyList()
    private var currentMediaIndex = 0
    private val handler = Handler(Looper.getMainLooper())
    private var playbackRunnable: Runnable? = null

    private lateinit var devicePolicyManager: DevicePolicyManager
    private lateinit var adminComponentName: ComponentName

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        playerView = findViewById(R.id.player_view)

        // Manter a tela ligada
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setupKioskMode()
        setupApiService()
        setupWebSocketClient()

        // Iniciar o fluxo de comunicação e reprodução
        lifecycleScope.launch {
            registerTotem()
            getTotemConfig()
            getScheduleAndPlaylist()
            startHeartbeat()
        }
    }

    private fun setupKioskMode() {
        devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        adminComponentName = ComponentName(this, AdminReceiver::class.java)

        if (devicePolicyManager.isDeviceOwnerApp(packageName)) {
            Log.d(TAG, "App é o Device Owner.")
            startLockTask()
            devicePolicyManager.setLockTaskPackages(adminComponentName, arrayOf(packageName))
        } else if (devicePolicyManager.isDeviceAdmin(adminComponentName)) {
            Log.d(TAG, "App é Device Admin. Solicitando ativação do modo Kiosk.")
            // Se não for Device Owner, mas for Device Admin, podemos tentar iniciar o lock task
            // mas as funcionalidades serão limitadas.
            // Para um Kiosk Mode completo, o app precisa ser Device Owner.
            startLockTask()
        } else {
            Log.w(TAG, "App não é Device Owner nem Device Admin. Kiosk Mode limitado.")
            // Solicitar ao usuário para ativar o Device Admin
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponentName)
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Este aplicativo precisa ser o administrador do dispositivo para operar em modo Kiosk e exibir publicidade ininterruptamente.")
            startActivityForResult(intent, REQUEST_CODE_ENABLE_ADMIN)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CODE_ENABLE_ADMIN) {
            if (resultCode == RESULT_OK) {
                Toast.makeText(this, "Administrador do dispositivo ativado.", Toast.LENGTH_SHORT).show()
                setupKioskMode() // Tenta configurar o Kiosk Mode novamente
            } else {
                Toast.makeText(this, "Administrador do dispositivo não ativado. Kiosk Mode será limitado.", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Garante que o lock task esteja ativo ao retornar ao app
        if (devicePolicyManager.isLockTaskPermitted(packageName)) {
            startLockTask()
        }
        initializePlayer()
    }

    override fun onPause() {
        super.onPause()
        releasePlayer()
    }

    override fun onDestroy() {
        super.onDestroy()
        releasePlayer()
        webSocketClient.disconnect()
        handler.removeCallbacksAndMessages(null)
    }

    // Intercepta botões de navegação para manter o Kiosk Mode
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_HOME, KeyEvent.KEYCODE_MENU -> {
                // Bloqueia botões de navegação para manter o Kiosk Mode
                Toast.makeText(this, "Acesso restrito em modo Kiosk.", Toast.LENGTH_SHORT).show()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun setupApiService() {
        val retrofit = Retrofit.Builder()
            .baseUrl(BACKEND_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .client(OkHttpClient.Builder().callTimeout(30, TimeUnit.SECONDS).build())
            .build()
        apiService = retrofit.create(ApiService::class.java)
    }

    private fun setupWebSocketClient() {
        webSocketClient = WebSocketClient(TOTEM_ID, AUTH_TOKEN, this)
        webSocketClient.connect(WEBSOCKET_URL)
    }

    private suspend fun registerTotem() {
        // Em um cenário real, o código de ativação seria inserido manualmente ou via QR code
        // e o backend retornaria o TOTEM_ID e AUTH_TOKEN.
        // Para o protótipo, estamos usando valores fixos.
        Log.d(TAG, "Registrando totem com ID: $TOTEM_ID (simulado).")
        // val response = apiService.registerTotem(RegistrationRequest("XYZ123"))
        // if (response.isSuccessful) {
        //     val registrationData = response.body()
        //     TOTEM_ID = registrationData.id
        //     AUTH_TOKEN = "Bearer ${registrationData.token}"
        //     Log.d(TAG, "Totem registrado com sucesso.")
        // } else {
        //     Log.e(TAG, "Erro ao registrar totem: ${response.errorBody()?.string()}")
        // }
    }

    private suspend fun getTotemConfig() {
        try {
            val response = apiService.getTotemConfig(TOTEM_ID, AUTH_TOKEN)
            if (response.isSuccessful) {
                val config = response.body()
                Log.d(TAG, "Configuração do Totem: $config")
                // Atualizar configurações locais se necessário
            } else {
                Log.e(TAG, "Erro ao obter configuração do totem: ${response.errorBody()?.string()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exceção ao obter configuração do totem: ${e.message}")
        }
    }

    private suspend fun getScheduleAndPlaylist() {
        try {
            val response = apiService.getSchedule(TOTEM_ID, AUTH_TOKEN)
            if (response.isSuccessful) {
                val schedule = response.body()
                Log.d(TAG, "Agendamento recebido: $schedule")
                schedule?.playlist?.midias?.let { midias ->
                    currentPlaylist = midias
                    currentMediaIndex = 0
                    Log.d(TAG, "Playlist atualizada: $currentPlaylist")
                    startPlayback()
                } ?: run {
                    Log.d(TAG, "Nenhuma playlist agendada ou playlist vazia.")
                    // Exibir tela de "Nenhuma mídia"
                }
            } else {
                Log.e(TAG, "Erro ao obter agendamento e playlist: ${response.errorBody()?.string()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exceção ao obter agendamento e playlist: ${e.message}")
        }
    }

    private fun sendStatusUpdate(type: String, message: String, mediaId: Int? = null, error: String? = null) {
        lifecycleScope.launch {
            try {
                val status = StatusUpdate(
                    type = type,
                    message = message,
                    media_id = mediaId,
                    error = error,
                    timestamp = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                )
                val response = apiService.sendStatusUpdate(TOTEM_ID, AUTH_TOKEN, status)
                if (response.isSuccessful) {
                    Log.d(TAG, "Status enviado: $status")
                } else {
                    Log.e(TAG, "Erro ao enviar status: ${response.errorBody()?.string()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exceção ao enviar status: ${e.message}")
            }
        }
    }

    private fun startHeartbeat() {
        handler.postDelayed(object : Runnable {
            override fun run() {
                sendStatusUpdate("heartbeat", "Player online.")
                handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
            }
        }, HEARTBEAT_INTERVAL_MS)
    }

    // --- WebSocketClient.WebSocketListenerCallback implementações ---
    override fun onMessage(command: WebSocketCommand) {
        Log.d(TAG, "Comando WebSocket recebido: ${command.command}")
        when (command.command) {
            "update_schedule" -> lifecycleScope.launch { getScheduleAndPlaylist() }
            "play_now" -> {
                // Lógica para carregar e reproduzir uma playlist específica imediatamente
                Toast.makeText(this, "Comando play_now recebido.", Toast.LENGTH_SHORT).show()
            }
            "reboot_device" -> {
                Log.d(TAG, "Comando: Reiniciar dispositivo.")
                // Em um Android TV real, você precisaria de permissões de sistema ou ser Device Owner
                // para reiniciar o dispositivo programaticamente.
                // Ex: devicePolicyManager.reboot(adminComponentName);
                Toast.makeText(this, "Comando de reinício recebido (simulado).", Toast.LENGTH_SHORT).show()
            }
            "restart_player" -> {
                Log.d(TAG, "Comando: Reiniciar player.")
                val intent = baseContext.packageManager.getLaunchIntentForPackage(baseContext.packageName)
                intent?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                startActivity(intent)
                finish()
            }
            "emergency_alert" -> {
                command.message?.let { msg ->
                    Toast.makeText(this, "ALERTA DE EMERGÊNCIA: $msg", Toast.LENGTH_LONG).show()
                    // Lógica para exibir mídia de emergência
                }
            }
            else -> Log.w(TAG, "Comando WebSocket desconhecido: ${command.command}")
        }
    }

    override fun onConnected() {
        sendStatusUpdate("online", "Player online e conectado via WebSocket.")
    }

    override fun onDisconnected() {
        sendStatusUpdate("offline", "Player offline ou WebSocket desconectado.")
        // A lógica de reconexão já está no WebSocketClient
    }

    override fun onError(t: Throwable, response: Response?) {
        sendStatusUpdate("error", "Erro no WebSocket: ${t.message}", error = t.message)
    }

    // --- Funções de Reprodução de Mídia ---

    private fun initializePlayer() {
        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(this).build().apply {
                addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        if (playbackState == Player.STATE_ENDED) {
                            handleMediaEnded()
                        }
                    }

                    override fun onPlayerError(error: com.google.android.exoplayer2.PlaybackException) {
                        Log.e(TAG, "Erro no ExoPlayer: ${error.message}", error)
                        sendStatusUpdate("media_error", "Erro na reprodução de mídia.", currentPlaylist.getOrNull(currentMediaIndex)?.media?.id_midia, error.message)
                        handleMediaEnded() // Tenta a próxima mídia em caso de erro
                    }
                })
                playerView.player = this
            }
        }
    }

    private fun releasePlayer() {
        exoPlayer?.release()
        exoPlayer = null
    }

    private fun startPlayback() {
        playbackRunnable?.let { handler.removeCallbacks(it) }

        if (currentPlaylist.isEmpty()) {
            Log.d(TAG, "Nenhuma mídia para reproduzir.")
            // Exibir tela de "Nenhuma mídia"
            return
        }

        playNextMedia()
    }

    private fun playNextMedia() {
        if (currentPlaylist.isEmpty()) return

        val mediaItem = currentPlaylist[currentMediaIndex]
        val media = mediaItem.media

        Log.d(TAG, "Reproduzindo: ${media.nome} (${media.url_arquivo})")
        sendStatusUpdate("media_started", "Iniciando reprodução.", media.id_midia)

        val uri = Uri.parse(media.url_arquivo)
        val mediaExoItem = MediaItem.fromUri(uri)

        exoPlayer?.setMediaItem(mediaExoItem)
        exoPlayer?.prepare()
        exoPlayer?.play()

        // Se for imagem, agendar a próxima mídia após a duração definida
        if (media.tipo_midia_id == 2) { // Supondo 2 para imagem
            val duration = (mediaItem.duracao_exibicao_override ?: media.duracao_segundos ?: 10) * 1000L
            playbackRunnable = Runnable { handleMediaEnded() }
            handler.postDelayed(playbackRunnable!!, duration)
        }
    }

    private fun handleMediaEnded() {
        sendStatusUpdate("media_ended", "Mídia concluída.", currentPlaylist.getOrNull(currentMediaIndex)?.media?.id_midia)
        currentMediaIndex = (currentMediaIndex + 1) % currentPlaylist.size
        playNextMedia()
    }

    companion object {
        private const val REQUEST_CODE_ENABLE_ADMIN = 1
        private const val HEARTBEAT_INTERVAL_MS = 30000L // 30 segundos
    }
}
