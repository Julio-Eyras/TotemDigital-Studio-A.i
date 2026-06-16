package br.com.smartchannel.playerad.config

data class PlayerConfig(
    val serverUrl: String,
    val uin: String,
    val deviceId: String,
    /** Se false, itens tratados como imagem na playlist são ignorados (não exibidos). */
    val acceptImagesInPlaylist: Boolean = true,
    /**
     * Se false, o ExoPlayer fica sempre em volume 0 (mute) para vídeo/áudio.
     * Imagens já não têm som; o interruptor só afeta mídia tocada pelo player.
     */
    val allowPlaybackAudio: Boolean = true,
    /** Quantas propagandas tocar antes de inserir 1 vinheta no fallback local. */
    val fallbackPropagandasPerVinheta: Int = 3,
    /**
     * Tempo máximo (em segundos) sem tentar heartbeat+dispatch.
     * Mantém o modo híbrido: por ciclo + janela de segurança temporal.
     */
    val maxSecondsWithoutServerCheck: Int = 600,
    /**
     * Onde gravar propagandas, vinhetas e JSON do último dispatch.
     * Ver [PlayerStorageMode] e campo `storage` em `player-config.json`.
     */
    val storageMode: PlayerStorageMode = PlayerStorageMode.AUTO,
    /**
     * Obrigatório quando [storageMode] é [PlayerStorageMode.PATH_OVERRIDE]: diretório absoluto com escrita.
     */
    val storagePathOverride: String? = null,
    /**
     * Kiosk na tela principal: [KioskMode.IMMERSIVE] (só fullscreen) ou [KioskMode.STRONG] (lock task + teclas).
     * Na tela de debug (8 toques) o kiosk é sempre relaxado.
     */
    val kioskMode: KioskMode = KioskMode.STRONG,
    /**
     * Rotação da exibição do app em passos de 90° (0–3).
     * 0=0° portrait, 1=90° landscape, 2=180° reverse portrait, 3=270° reverse landscape.
     */
    val displayRotation: Int = 0,
    /** Orientação da tela principal e do debug (derivada de [displayRotation]). */
    val screenOrientation: ScreenOrientationMode = ScreenOrientationMode.PORTRAIT
)

