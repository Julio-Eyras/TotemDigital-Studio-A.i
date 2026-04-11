package br.com.smartchannel.playerad.util

import android.content.Context
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import java.io.File

/**
 * Diretório base para cache do app (propagandas / vinhetas / plano persistido).
 * Resolvido via [PlayerConfigLoader] + [StorageRootResolver] (USB/SD quando o SO expõe como externo removível).
 */
object AppDirs {
    fun root(context: Context): File {
        val cfg = PlayerConfigLoader(context.applicationContext).load()
        return StorageRootResolver.resolve(context.applicationContext, cfg)
    }

    fun propagandas(context: Context): File =
        File(root(context), "propagandas").apply { if (!exists()) mkdirs() }

    fun vinhetas(context: Context): File =
        File(root(context), "vinhetas").apply { if (!exists()) mkdirs() }
}
