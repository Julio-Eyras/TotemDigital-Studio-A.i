package br.com.smartchannel.playerad.util

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiConfiguration
import android.net.wifi.WifiManager
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

data class WifiScanEntry(
    val ssid: String,
    val bssid: String?,
    val level: Int,
    val secured: Boolean,
)

/**
 * Scan/conexão Wi‑Fi para setup e config do Player-AD.
 * Em API 29+ a ligação via [WifiNetworkSpecifier] é temporária (processo);
 * em API &lt; 29 usa [WifiConfiguration] clássica (rede gravada no SO).
 * Sempre oferecer abrir Settings do sistema como fallback OEM.
 */
object WifiNetworkHelper {

    fun wifiManager(context: Context): WifiManager? =
        context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager

    fun hasScanPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.NEARBY_WIFI_DEVICES) ==
                PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
        }
    }

    fun requiredRuntimePermissions(): Array<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(
                Manifest.permission.NEARBY_WIFI_DEVICES,
                Manifest.permission.ACCESS_FINE_LOCATION,
            )
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    fun openSystemWifiSettings(context: Context): Boolean {
        return try {
            context.startActivity(
                Intent(Settings.ACTION_WIFI_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            true
        } catch (_: Exception) {
            try {
                context.startActivity(
                    Intent(Settings.ACTION_WIRELESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
                true
            } catch (_: Exception) {
                false
            }
        }
    }

    fun openSystemSettings(context: Context): Boolean {
        return try {
            context.startActivity(
                Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            true
        } catch (_: Exception) {
            false
        }
    }

    fun currentSsid(context: Context): String? {
        val wm = wifiManager(context) ?: return null
        @Suppress("DEPRECATION")
        val info = wm.connectionInfo ?: return null
        val raw = info.ssid?.trim().orEmpty()
        if (raw.isEmpty() || raw == "<unknown ssid>" || raw == "0x") return null
        return raw.trim('"')
    }

    suspend fun scanNetworks(context: Context): List<WifiScanEntry> {
        val wm = wifiManager(context)
            ?: throw IllegalStateException("WifiManager indisponível neste aparelho")
        if (!hasScanPermission(context)) {
            throw SecurityException("Permissão de localização/Wi‑Fi necessária para listar redes")
        }
        @Suppress("DEPRECATION")
        if (!wm.isWifiEnabled) {
            @Suppress("DEPRECATION")
            wm.isWifiEnabled = true
        }

        return suspendCancellableCoroutine { cont ->
            val receiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context?, intent: Intent?) {
                    if (intent?.action != WifiManager.SCAN_RESULTS_AVAILABLE_ACTION) return
                    try {
                        context.unregisterReceiver(this)
                    } catch (_: Exception) {
                    }
                    @Suppress("DEPRECATION")
                    val results = wm.scanResults.orEmpty()
                    val mapped = results
                        .mapNotNull { r ->
                            val ssid = r.SSID?.trim().orEmpty()
                            if (ssid.isEmpty()) return@mapNotNull null
                            val caps = r.capabilities.orEmpty()
                            WifiScanEntry(
                                ssid = ssid,
                                bssid = r.BSSID,
                                level = r.level,
                                secured = caps.contains("WEP") ||
                                    caps.contains("WPA") ||
                                    caps.contains("PSK") ||
                                    caps.contains("EAP"),
                            )
                        }
                        .distinctBy { it.ssid }
                        .sortedByDescending { it.level }
                    if (cont.isActive) cont.resume(mapped)
                }
            }
            val filter = IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION)
            ContextCompat.registerReceiver(
                context,
                receiver,
                filter,
                ContextCompat.RECEIVER_NOT_EXPORTED,
            )
            cont.invokeOnCancellation {
                try {
                    context.unregisterReceiver(receiver)
                } catch (_: Exception) {
                }
            }
            @Suppress("DEPRECATION")
            val started = wm.startScan()
            if (!started) {
                try {
                    context.unregisterReceiver(receiver)
                } catch (_: Exception) {
                }
                @Suppress("DEPRECATION")
                val cached = wm.scanResults.orEmpty()
                    .mapNotNull { r ->
                        val ssid = r.SSID?.trim().orEmpty()
                        if (ssid.isEmpty()) return@mapNotNull null
                        val caps = r.capabilities.orEmpty()
                        WifiScanEntry(
                            ssid = ssid,
                            bssid = r.BSSID,
                            level = r.level,
                            secured = caps.contains("WEP") ||
                                caps.contains("WPA") ||
                                caps.contains("PSK") ||
                                caps.contains("EAP"),
                        )
                    }
                    .distinctBy { it.ssid }
                    .sortedByDescending { it.level }
                if (cont.isActive) cont.resume(cached)
            }
        }
    }

    /**
     * Liga à rede. [password] pode ser vazio em redes abertas.
     * @return mensagem de resultado para UI/log (sem ecoar a senha).
     */
    fun connect(context: Context, ssid: String, password: String, secured: Boolean): String {
        val cleanSsid = ssid.trim().trim('"')
        if (cleanSsid.isEmpty()) throw IllegalArgumentException("SSID vazio")
        val wm = wifiManager(context)
            ?: throw IllegalStateException("WifiManager indisponível")

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            connectApi29Plus(context, cleanSsid, password, secured)
        } else {
            connectLegacy(wm, cleanSsid, password, secured)
        }
    }

    @Suppress("DEPRECATION")
    private fun connectLegacy(
        wm: WifiManager,
        ssid: String,
        password: String,
        secured: Boolean,
    ): String {
        if (!wm.isWifiEnabled) {
            wm.isWifiEnabled = true
        }
        val conf = WifiConfiguration().apply {
            SSID = "\"$ssid\""
            if (!secured || password.isEmpty()) {
                allowedKeyManagement.set(WifiConfiguration.KeyMgmt.NONE)
            } else {
                preSharedKey = "\"$password\""
                allowedKeyManagement.set(WifiConfiguration.KeyMgmt.WPA_PSK)
            }
        }
        var netId = wm.addNetwork(conf)
        if (netId == -1) {
            // Rede já conhecida — procurar e reactivar
            netId = wm.configuredNetworks
                ?.firstOrNull { it.SSID?.trim('"') == ssid }
                ?.networkId
                ?: -1
        }
        if (netId == -1) {
            throw IllegalStateException("Não foi possível adicionar a rede «$ssid» (OEM pode bloquear)")
        }
        wm.disconnect()
        val enabled = wm.enableNetwork(netId, true)
        wm.reconnect()
        if (!enabled) {
            throw IllegalStateException("enableNetwork falhou para «$ssid»")
        }
        return "Pedido de ligação enviado para «$ssid» (legado)"
    }

    private fun connectApi29Plus(
        context: Context,
        ssid: String,
        password: String,
        secured: Boolean,
    ): String {
        val specifierBuilder = WifiNetworkSpecifier.Builder().setSsid(ssid)
        if (secured && password.isNotEmpty()) {
            specifierBuilder.setWpa2Passphrase(password)
        }
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .setNetworkSpecifier(specifierBuilder.build())
            .build()
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                cm.bindProcessToNetwork(network)
                PlayerAdLogger.i("WIFI", "Ligação temporária OK a «$ssid» (API29+)")
            }

            override fun onUnavailable() {
                PlayerAdLogger.w("WIFI", "Ligação a «$ssid» indisponível (API29+)")
            }
        }
        cm.requestNetwork(request, callback)
        return "Pedido de ligação enviado para «$ssid» (API 29+; temporário ao processo). " +
            "Se falhar no OEM, use «Abrir Wi‑Fi do sistema»."
    }
}
