package br.com.smartchannel.playeradmon.data.telemetry

import br.com.smartchannel.playeradmon.data.auth.SecureTokenStore
import br.com.smartchannel.playeradmon.data.network.ApiClient
import br.com.smartchannel.playeradmon.data.settings.AppSettings
import br.com.smartchannel.playeradmon.data.totem.TotemRepository
import br.com.smartchannel.playeradmon.model.PlaybackNormalize
import br.com.smartchannel.playeradmon.model.TotemPlaybackState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import kotlin.math.min
import kotlin.math.pow

enum class PlaybackConnectionStatus {
    Connecting,
    Connected,
    Disconnected,
}

/**
 * Espelha `useTotemPlaybackTelemetry` / Player-iPhone:
 * WS + poll REST (10 s offline / 15 s com WS) enquanto o ecrã Monitor está aberto.
 */
class PlaybackTelemetryService(
    private val api: ApiClient,
    private val totems: TotemRepository,
    private val settings: AppSettings,
    private val tokenStore: SecureTokenStore,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val _state = MutableStateFlow<TotemPlaybackState?>(null)
    val state: StateFlow<TotemPlaybackState?> = _state.asStateFlow()

    private val _connectionStatus = MutableStateFlow(PlaybackConnectionStatus.Disconnected)
    val connectionStatus: StateFlow<PlaybackConnectionStatus> = _connectionStatus.asStateFlow()

    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError.asStateFlow()

    private var totemId: Int? = null
    private var webSocket: WebSocket? = null
    private var pollJob: Job? = null
    private var leaseJob: Job? = null
    private var reconnectJob: Job? = null
    private var disposed = true
    private var reconnectAttempt = 0

    private val restFallbackMs = 10_000L
    private val restReconcileMs = 15_000L
    private val leaseTtlSeconds = 90
    private val leaseRenewMs = 60_000L

    fun start(totemId: Int) {
        stop()
        disposed = false
        this.totemId = totemId
        _connectionStatus.value = PlaybackConnectionStatus.Connecting
        _lastError.value = null
        connectWebSocket()
        startPolling()
        startLeaseLoop(totemId)
        scope.launch { fetchRest() }
    }

    fun stop() {
        disposed = true
        pollJob?.cancel()
        pollJob = null
        leaseJob?.cancel()
        leaseJob = null
        reconnectJob?.cancel()
        reconnectJob = null
        val id = totemId
        if (id != null) {
            scope.launch { totems.stopTelemetryObservation(id) }
            sendUnsubscribe(id)
        }
        webSocket?.close(1000, "stop")
        webSocket = null
        _connectionStatus.value = PlaybackConnectionStatus.Disconnected
        totemId = null
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = scope.launch {
            while (isActive && !disposed) {
                val wait = if (_connectionStatus.value == PlaybackConnectionStatus.Connected) {
                    restReconcileMs
                } else {
                    restFallbackMs
                }
                delay(wait)
                if (!isActive || disposed) break
                fetchRest()
            }
        }
    }

    private suspend fun fetchRest() {
        val id = totemId ?: return
        try {
            val normalized = totems.fetchPlaybackState(id)
            if (normalized != null) {
                _state.value = normalized
                _lastError.value = null
            } else if (_state.value == null) {
                _state.value = TotemPlaybackState(
                    totemId = id,
                    mediaName = "Sem reprodução",
                    status = "empty",
                )
            }
        } catch (e: Exception) {
            _lastError.value = e.message
        }
    }

    private fun startLeaseLoop(totemId: Int) {
        leaseJob?.cancel()
        leaseJob = scope.launch {
            try {
                totems.startTelemetryObservation(totemId, leaseTtlSeconds)
            } catch (_: Exception) {
                // Lease opcional.
            }
            while (isActive && !disposed) {
                delay(leaseRenewMs)
                if (!isActive || disposed) break
                try {
                    totems.renewTelemetryObservation(totemId, leaseTtlSeconds)
                } catch (_: Exception) {
                }
            }
        }
    }

    private fun connectWebSocket() {
        if (disposed) return
        val token = tokenStore.accessToken
        if (token.isNullOrBlank()) {
            _connectionStatus.value = PlaybackConnectionStatus.Disconnected
            _lastError.value = "Sem token de sessão"
            return
        }
        val url = try {
            settings.webSocketUrl(token)
        } catch (e: Exception) {
            _connectionStatus.value = PlaybackConnectionStatus.Disconnected
            _lastError.value = e.message
            scheduleReconnect()
            return
        }
        _connectionStatus.value = PlaybackConnectionStatus.Connecting
        val request = Request.Builder().url(url).build()
        webSocket = api.http.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                scope.launch {
                    if (disposed) return@launch
                    _connectionStatus.value = PlaybackConnectionStatus.Connected
                    reconnectAttempt = 0
                    totemId?.let { sendSubscribe(it) }
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                scope.launch { handleMessage(text) }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                scope.launch {
                    if (!disposed) {
                        _connectionStatus.value = PlaybackConnectionStatus.Disconnected
                        scheduleReconnect()
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                scope.launch {
                    if (!disposed) {
                        _connectionStatus.value = PlaybackConnectionStatus.Disconnected
                        _lastError.value = t.message
                        scheduleReconnect()
                    }
                }
            }
        })
    }

    private fun handleMessage(text: String) {
        try {
            val obj = JSONObject(text)
            val type = obj.optString("type")
            if (type == "totem_playback_state") {
                val normalized = PlaybackNormalize.normalize(obj, fallbackTotemId = totemId)
                if (normalized != null) {
                    _state.value = normalized
                    _lastError.value = null
                }
            }
        } catch (_: Exception) {
        }
    }

    private fun sendSubscribe(totemId: Int) = send("subscribe_playback_state", totemId)
    private fun sendUnsubscribe(totemId: Int) = send("unsubscribe_playback_state", totemId)

    private fun send(type: String, totemId: Int) {
        val ws = webSocket ?: return
        val payload = JSONObject()
            .put("type", type)
            .put("data", JSONObject().put("totemId", totemId))
        ws.send(payload.toString())
    }

    private fun scheduleReconnect() {
        if (disposed) return
        reconnectJob?.cancel()
        reconnectAttempt += 1
        val delaySec = min(2.0 * 2.0.pow((reconnectAttempt - 1).toDouble()), 30.0)
        reconnectJob = scope.launch {
            delay((delaySec * 1000).toLong())
            if (disposed) return@launch
            webSocket?.cancel()
            webSocket = null
            connectWebSocket()
        }
    }
}
