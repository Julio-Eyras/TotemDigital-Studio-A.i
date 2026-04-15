package br.com.smartchannel.playerad.config

data class PlayerConfig(
    val serverUrl: String,
    val uin: String,
    val deviceId: String,
    /** Se false, itens tratados como imagem na playlist são ignorados (não exibidos). */
    val acceptImagesInPlaylist: Boolean = true,
    /** Quantas propagandas tocar antes de inserir 1 vinheta no fallback local. */
    val fallbackPropagandasPerVinheta: Int = 3,
    /**
     * Tempo máximo (em segundos) sem tentar heartbeat+dispatch.
     * Mantém o modo híbrido: por ciclo + janela de segurança temporal.
     */
    val maxSecondsWithoutServerCheck: Int = 60,
    /**
     * Onde gravar propagandas, vinhetas e JSON do último dispatch.
     * Ver [PlayerStorageMode] e campo `storage` em `player-config.json`.
     */
    val storageMode: PlayerStorageMode = PlayerStorageMode.AUTO,
    /**
     * Obrigatório quando [storageMode] é [PlayerStorageMode.PATH_OVERRIDE]: diretório absoluto com escrita.
     */
    val storagePathOverride: String? = null
)

