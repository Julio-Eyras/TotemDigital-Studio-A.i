package br.com.smartchannel.playerad.config

/**
 * Onde o Player-AD grava cache (propagandas), vinhetas e ficheiros de plano persistido.
 *
 * Valores em `player-config.json` no campo `storage` (case-insensitive).
 */
enum class PlayerStorageMode {
    /**
     * Preferir volume removível reportado por [android.content.Context.getExternalFilesDirs],
     * senão armazenamento externo primário, senão interno.
     * Nota: default de instalação/campo é [EXTERNAL_PRIMARY], não [AUTO].
     */
    AUTO,

    /** Sempre [android.content.Context.getFilesDir]. */
    INTERNAL,

    /** [android.content.Context.getExternalFilesDir] (null → interno). */
    EXTERNAL_PRIMARY,

    /**
     * USB / volume removível: prioriza [android.os.Environment.isExternalStorageRemovable]
     * em [android.content.Context.getExternalFilesDirs]; em API 30+ tenta também [android.os.storage.StorageManager].
     */
    REMOVABLE_PREFERRED,

    /**
     * Cartão SD / volume secundário típico: primeiro diretório de [android.content.Context.getExternalFilesDirs]
     * que **não** é o primário ([getExternalFilesDir]); depois removível; depois primário.
     * Em `player-config.json` use `"storage": "sdcard"`.
     */
    SD_CARD,

    /**
     * Caminho absoluto em [PlayerConfig.storagePathOverride] (deve existir ou ser criável com escrita).
     * Em Android recente, caminhos arbitrários podem falhar sem permissões especiais.
     */
    PATH_OVERRIDE
}
