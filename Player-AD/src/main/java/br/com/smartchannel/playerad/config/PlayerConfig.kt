package br.com.smartchannel.playerad.config

data class PlayerConfig(
    val serverUrl: String,
    val uin: String,
    val deviceId: String,
    /** Se false, itens tratados como imagem na playlist são ignorados (não exibidos). */
    val acceptImagesInPlaylist: Boolean = true,
    /** Quantas propagandas tocar antes de inserir 1 vinheta no fallback local. */
    val fallbackPropagandasPerVinheta: Int = 3
)

