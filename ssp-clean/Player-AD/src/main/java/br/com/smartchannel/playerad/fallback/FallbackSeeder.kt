package br.com.smartchannel.playerad.fallback

import android.content.Context
import android.util.Log
import br.com.smartchannel.playerad.util.AppDirs
import java.io.File
import java.io.FileOutputStream

// FallbackSeeder – cópia do fallback embutido (APK assets) para o cache externo do app.
//
// Objetivo:
// - Copiar:
//   - assets/propagandas/*
//   - assets/vinhetas/*
// - Para:
//   - <externalFilesDir>/propagandas/
//   - <externalFilesDir>/vinhetas/
//
// Observação:
// - Você precisa colocar os dois vídeos reais no:
//   - Player-AD/src/main/assets/propagandas/
//   - Player-AD/src/main/assets/vinhetas/
class FallbackSeeder(
    private val context: Context,
    private val loggerTag: String = "Player-AD"
) {

    fun seedFromAssetsIfNeeded() {
        val propsDir = externalPropDir()
        val vinsDir = externalVinDir()

        // Se já existe algo nas pastas externas, não sobrescrevemos.
        val hasProps = propsDir.listFiles()?.any { it.isFile && it.length() > 0 } == true
        val hasVins = vinsDir.listFiles()?.any { it.isFile && it.length() > 0 } == true
        if (hasProps && hasVins) return

        copyAssetFolderToExternal("propagandas", propsDir)
        copyAssetFolderToExternal("vinhetas", vinsDir)
    }

    private fun copyAssetFolderToExternal(assetFolder: String, targetDir: File) {
        if (!targetDir.exists()) targetDir.mkdirs()

        val assetManager = context.assets
        val names = try {
            assetManager.list(assetFolder) ?: emptyArray()
        } catch (e: Exception) {
            Log.w(loggerTag, "Não foi possível listar assets/$assetFolder: ${e.message}")
            emptyArray()
        }

        for (name in names) {
            val lower = name.lowercase()
            val isSupported =
                lower.endsWith(".mp4") ||
                    lower.endsWith(".webm") ||
                    lower.endsWith(".mov") ||
                    lower.endsWith(".jpg") ||
                    lower.endsWith(".jpeg") ||
                    lower.endsWith(".png")

            if (!isSupported) continue

            val outFile = File(targetDir, name)
            if (outFile.exists() && outFile.length() > 0) continue

            try {
                context.assets.open("$assetFolder/$name").use { input ->
                    FileOutputStream(outFile).use { out ->
                        input.copyTo(out)
                    }
                }
                Log.i(loggerTag, "FallbackSeeder: copiado $assetFolder/$name -> ${outFile.absolutePath}")
            } catch (e: Exception) {
                Log.w(loggerTag, "Falha ao copiar $assetFolder/$name: ${e.message}")
            }
        }
    }

    private fun externalPropDir(): File = AppDirs.propagandas(context)

    private fun externalVinDir(): File = AppDirs.vinhetas(context)
}
