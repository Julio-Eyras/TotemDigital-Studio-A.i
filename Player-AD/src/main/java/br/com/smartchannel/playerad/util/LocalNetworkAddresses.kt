package br.com.smartchannel.playerad.util

import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections

/**
 * Coleta endereços IPv4 locais agrupados por tipo de interface (Ethernet vs Wi‑Fi).
 * Nomes variam por fabricante: eth0, wlan0, etc.
 */
object LocalNetworkAddresses {

    data class Summary(
        val ethernetLines: List<String>,
        val wifiLines: List<String>,
        val otherLines: List<String>
    )

    fun collect(): Summary {
        val ethernet = mutableListOf<String>()
        val wifi = mutableListOf<String>()
        val other = mutableListOf<String>()

        try {
            val list = Collections.list(NetworkInterface.getNetworkInterfaces())
            for (ni in list) {
                if (!ni.isUp || ni.isLoopback) continue
                val name = ni.name
                val nameLower = name.lowercase()

                val ipv4 = ni.inetAddresses.toList()
                    .filter { !it.isLoopbackAddress && it is Inet4Address }
                    .mapNotNull { it.hostAddress }

                if (ipv4.isEmpty()) continue

                val lines = ipv4.map { ip -> "$name → $ip" }

                when {
                    nameLower.startsWith("eth") ||
                        nameLower.startsWith("en") && nameLower != "lo" -> {
                        // en* costuma ser Ethernet em alguns STBs; evita confundir com loopback
                        ethernet.addAll(lines)
                    }
                    nameLower.startsWith("wlan") ||
                        nameLower.startsWith("wifi") ||
                        nameLower == "p2p0" -> {
                        wifi.addAll(lines)
                    }
                    else -> other.addAll(lines)
                }
            }
        } catch (_: Exception) {
            // Ignorar; a UI mostrará "—"
        }

        return Summary(
            ethernetLines = ethernet.distinct(),
            wifiLines = wifi.distinct(),
            otherLines = other.distinct()
        )
    }

    fun formatForUi(summary: Summary): Pair<String, String> {
        val eth = summary.ethernetLines.joinToString("\n").ifBlank { "— (sem interface eth*/en* com IPv4)" }
        val wf = summary.wifiLines.joinToString("\n").ifBlank { "— (sem interface wlan*/wifi* com IPv4)" }
        return eth to wf
    }
}
