package com.smartotem.player.api

import android.util.Log
import com.google.gson.Gson
import com.smartotem.player.models.WebSocketCommand
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

class WebSocketClient(private val totemId: String, private val authToken: String, private val listener: WebSocketListenerCallback) {

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    private var webSocket: WebSocket? = null
    private val gson = Gson()

    interface WebSocketListenerCallback {
        fun onMessage(command: WebSocketCommand)
        fun onConnected()
        fun onDisconnected()
        fun onError(t: Throwable, response: Response?)
    }

    fun connect(websocketUrl: String) {
        val request = Request.Builder()
            .url("${websocketUrl}?token=${authToken}&totem_id=${totemId}")
            .build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("WebSocketClient", "Conectado ao WebSocket.")
                listener.onConnected()
                // Enviar player_ready
                val command = WebSocketCommand(command = "player_ready", totem_id = totemId)
                webSocket.send(gson.toJson(command))
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d("WebSocketClient", "Mensagem recebida: $text")
                try {
                    val command = gson.fromJson(text, WebSocketCommand::class.java)
                    listener.onMessage(command)
                } catch (e: Exception) {
                    Log.e("WebSocketClient", "Erro ao parsear comando WebSocket: ${e.message}")
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("WebSocketClient", "Fechando WebSocket: $code / $reason")
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d("WebSocketClient", "WebSocket fechado: $code / $reason")
                listener.onDisconnected()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e("WebSocketClient", "Falha no WebSocket: ${t.message}", t)
                listener.onError(t, response)
                // Tentar reconectar
                listener.onDisconnected() // Sinaliza desconexão para tentar reconectar
            }
        })
    }

    fun sendMessage(command: WebSocketCommand) {
        webSocket?.send(gson.toJson(command))
    }

    fun disconnect() {
        webSocket?.close(1000, "Desconexão manual")
    }
}
