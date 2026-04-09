package br.com.smartchannel.smartsignagead.fallback

import android.content.Context
import br.com.smartchannel.smartsignagead.util.AppDirs
import br.com.smartchannel.smartsignagead.util.SmartSignageAdLogger
import java.io.File
import java.io.FileOutputStream

/**
 * Copia mídia demo embutida no APK para armazenamento interno do app.
 * Essa mídia é apenas contingência de demonstração (não mídia efetiva).
 */
class FallbackSeeder(private val context: Context) {

    fun seedDemoAssetsIfNeeded() {
        copyAssetFolder("propagandas", AppDirs.demoPropagandas(context))
        copyAssetFolder("vinhetas", AppDirs.demoVinhetas(context))
    }

    private fun copyAssetFolder(assetFolder: String, targetDir: File) {
        if (!targetDir.exists()) targetDir.mkdirs()
        val names = try {
            context.assets.list(assetFolder) ?: emptyArray()
        } catch (_: Exception) {
            emptyArray()
        }
        for (name in names) {
            val lower = name.lowercase()
            val supported = lower.endsWith(".mp4") ||
                lower.endsWith(".webm") ||
                lower.endsWith(".mov") ||
                lower.endsWith(".jpg") ||
                lower.endsWith(".jpeg") ||
                lower.endsWith(".png")
            if (!supported) continue

            val outFile = File(targetDir, name)
            if (outFile.exists() && outFile.length() > 0L) continue

            try {
                context.assets.open("$assetFolder/$name").use { input ->
                    FileOutputStream(outFile).use { output ->
                        input.copyTo(output)
                    }
                }
                SmartSignageAdLogger.i("SEED", "Demo asset copiado: $assetFolder/$name -> ${outFile.absolutePath}")
            } catch (e: Exception) {
                SmartSignageAdLogger.w("SEED", "Falha ao copiar demo asset $assetFolder/$name: ${e.message}")
            }
        }
    }
}
