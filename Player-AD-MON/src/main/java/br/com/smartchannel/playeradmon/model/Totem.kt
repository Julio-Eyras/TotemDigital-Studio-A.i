package br.com.smartchannel.playeradmon.model

data class Totem(
    val id: Int,
    val name: String,
    val status: String = "offline",
    val lastHeartbeat: String? = null,
    val localName: String? = null,
    val identifier: String? = null,
    val uin: String? = null,
    val currentPlaylistId: Int? = null,
    val mediaCount: Int? = null,
    val isActive: Boolean = true,
) {
    val isOnline: Boolean get() = status.equals("online", ignoreCase = true)

    val statusLabel: String
        get() = when (status.lowercase()) {
            "online" -> "Online"
            "offline" -> "Offline"
            "error" -> "Erro"
            "pending_approval" -> "Aguarda aprovação"
            else -> status.ifBlank { "Desconhecido" }
        }

    val subtitle: String
        get() {
            val loc = localName?.trim().orEmpty()
            if (loc.isNotEmpty()) return loc
            val idf = identifier?.trim().orEmpty()
            if (idf.isNotEmpty()) return idf
            return "ID $id"
        }
}
