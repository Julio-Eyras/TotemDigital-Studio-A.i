package com.smartsignage.player.smartdisplayfx

import android.content.Context
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import org.eclipse.paho.android.service.MqttAndroidClient
import org.eclipse.paho.client.mqttv3.*

/**
 * SmartDisplayFxManager - Gerenciador de SmartDisplayFX para Android TV
 * 
 * Gerencia WebView e integração com MQTT para efeitos FX
 */
class SmartDisplayFxManager(
    private val context: Context,
    private val webView: WebView,
    private val config: SmartDisplayFxConfig
) {
    private var mqttClient: MqttAndroidClient? = null
    private val TAG = "SmartDisplayFxManager"

    init {
        setupWebView()
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
        }

        // Interface JavaScript para comunicação Android <-> WebView
        webView.addJavascriptInterface(AndroidInterface(), "Android")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "SmartDisplayFX page loaded")
                initializeSmartDisplayFX()
            }
        }

        // Carregar HTML do SmartDisplayFX
        webView.loadUrl("file:///android_asset/smartdisplayfx/index.html")
    }

    private fun initializeSmartDisplayFX() {
        // Injetar configuração e inicializar via JavaScript
        val js = """
            (function() {
                if (!window.SmartDisplayFX) {
                    console.error('SmartDisplayFX modules not loaded');
                    return;
                }
                
                const { SmartDisplayFlowClient, FxEngine, WebPlayerBridge } = window.SmartDisplayFX;
                
                // Configuração
                const mqttConfig = {
                    url: '${config.mqttUrl}',
                    prefix: '${config.mqttPrefix}',
                    username: ${if (config.mqttUsername != null) "'${config.mqttUsername}'" else "undefined"},
                    password: ${if (config.mqttPassword != null) "'${config.mqttPassword}'" else "undefined"},
                };
                
                const siteId = '${config.siteId}';
                const totemId = '${config.totemId}';
                
                // Inicializar PlayerBridge (placeholder - será conectado ao player real)
                const playerBridge = new WebPlayerBridge({
                    videoElement: null, // Será conectado ao ExoPlayer
                });
                
                // Inicializar FxEngine
                const fxCanvas = document.getElementById('fx-canvas');
                if (fxCanvas) {
                    fxCanvas.width = window.innerWidth;
                    fxCanvas.height = window.innerHeight;
                    
                    const fxEngine = new FxEngine({
                        canvas: fxCanvas,
                        playerBridge: playerBridge,
                        onLog: (msg, extra) => {
                            console.log('SmartDisplayFX:', msg, extra);
                        },
                    });
                    
                    // Inicializar SmartDisplayFlowClient
                    const fxClient = new SmartDisplayFlowClient({
                        siteId: siteId,
                        totemId: totemId,
                        transportType: 'mqtt',
                        mqttUrl: mqttConfig.url,
                        mqttPrefix: mqttConfig.prefix,
                        mqttOptions: {
                            username: mqttConfig.username,
                            password: mqttConfig.password,
                        },
                        backendBaseUrl: '${config.backendBaseUrl}',
                        getAuthToken: () => {
                            // Token será obtido via AndroidInterface
                            return window.Android?.getAuthToken?.() || null;
                        },
                        onLog: (msg, extra) => {
                            console.log('SmartDisplayFlowClient:', msg, extra);
                        },
                    });
                    
                    // Handler para efeitos
                    fxClient.onEffect((payload, context) => {
                        console.log('Effect received', payload, context);
                        if (fxEngine) {
                            fxEngine.playEffect(payload, {
                                isOrigin: context.isOrigin,
                                isTarget: context.isTarget,
                                currentTotemId: totemId,
                            });
                        }
                    });
                    
                    // Conectar
                    fxClient.connect(siteId, totemId);
                    
                    // Expor para acesso externo
                    window.smartDisplayFxClient = fxClient;
                    window.smartDisplayFxEngine = fxEngine;
                    
                    console.log('SmartDisplayFX initialized', { siteId, totemId });
                }
            })();
        """.trimIndent()

        webView.evaluateJavascript(js, null)
    }

    /**
     * Interface JavaScript para comunicação Android <-> WebView
     */
    inner class AndroidInterface {
        @JavascriptInterface
        fun onSmartDisplayFXReady() {
            Log.d(TAG, "SmartDisplayFX ready callback received")
            // Pode adicionar lógica adicional aqui
        }

        @JavascriptInterface
        fun getAuthToken(): String? {
            // Obter token de autenticação (implementar conforme necessário)
            return null
        }
    }

    fun connectMqtt() {
        try {
            val serverUri = config.mqttUrl.replace("ws://", "tcp://").replace("wss://", "ssl://")
            mqttClient = MqttAndroidClient(context, serverUri, config.totemId)

            val options = MqttConnectOptions().apply {
                isCleanSession = true
                if (config.mqttUsername != null) {
                    userName = config.mqttUsername
                }
                if (config.mqttPassword != null) {
                    password = config.mqttPassword.toCharArray()
                }
            }

            mqttClient?.connect(options, null, object : IMqttActionListener {
                override fun onSuccess(asyncActionToken: IMqttToken?) {
                    Log.d(TAG, "MQTT connected")
                    subscribeToTopics()
                }

                override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                    Log.e(TAG, "MQTT connection failed", exception)
                }
            })

            mqttClient?.setCallback(object : MqttCallback {
                override fun connectionLost(cause: Throwable?) {
                    Log.w(TAG, "MQTT connection lost", cause)
                }

                override fun messageArrived(topic: String?, message: MqttMessage?) {
                    message?.let {
                        val payload = String(it.payload)
                        Log.d(TAG, "MQTT message received: $topic")
                        // Enviar mensagem para WebView
                        webView.post {
                            val js = """
                                if (window.smartDisplayFxClient && window.smartDisplayFxClient._onMqttMessage) {
                                    window.smartDisplayFxClient._onMqttMessage('$topic', $payload);
                                }
                            """.trimIndent()
                            webView.evaluateJavascript(js, null)
                        }
                    }
                }

                override fun deliveryComplete(token: IMqttDeliveryToken?) {
                    // Não necessário para QoS 0
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Error connecting MQTT", e)
        }
    }

    private fun subscribeToTopics() {
        val base = "${config.mqttPrefix}/${config.siteId}"
        val topics = arrayOf(
            "$base/effect",
            "$base/timeline",
            "$base/sync/time"
        )

        topics.forEach { topic ->
            try {
                mqttClient?.subscribe(topic, 0, null, object : IMqttActionListener {
                    override fun onSuccess(asyncActionToken: IMqttToken?) {
                        Log.d(TAG, "Subscribed to: $topic")
                    }

                    override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                        Log.e(TAG, "Failed to subscribe to: $topic", exception)
                    }
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error subscribing to: $topic", e)
            }
        }
    }

    fun disconnect() {
        mqttClient?.disconnect()
        mqttClient = null
    }
}

/**
 * Configuração do SmartDisplayFX
 */
data class SmartDisplayFxConfig(
    val siteId: String,
    val totemId: String,
    val mqttUrl: String = "ws://localhost:9001",
    val mqttPrefix: String = "smartdisplay",
    val mqttUsername: String? = null,
    val mqttPassword: String? = null,
    val backendBaseUrl: String = "http://localhost:3000/api"
)

