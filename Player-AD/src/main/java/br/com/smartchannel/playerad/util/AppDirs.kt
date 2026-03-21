package br.com.smartchannel.playerad.util

import android.content.Context
import java.io.File

/**
 * Diretório base para cache do app (propagandas / vinhetas).
 * Em STBs/TV, [Context.getExternalFilesDir] pode ser null (sem mídia montada) — usa [Context.filesDir].
 */
object AppDirs {
    fun root(context: Context): File =
        context.getExternalFilesDir(null) ?: context.filesDir

    fun propagandas(context: Context): File =
        File(root(context), "propagandas").apply { if (!exists()) mkdirs() }

    fun vinhetas(context: Context): File =
        File(root(context), "vinhetas").apply { if (!exists()) mkdirs() }
}
