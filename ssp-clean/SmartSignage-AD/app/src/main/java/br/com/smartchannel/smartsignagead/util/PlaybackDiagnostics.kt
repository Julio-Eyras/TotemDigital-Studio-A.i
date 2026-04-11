package br.com.smartchannel.smartsignagead.util

import android.content.Context
import br.com.smartchannel.smartsignagead.config.AppConfig
import java.io.File

/**
 * Relatorio unico para ecra de debug e log: cache, demo (assets -> files), volumes USB, pastas candidatas.
 */
object PlaybackDiagnostics {

    fun buildReport(context: Context, config: AppConfig): String {
        val root = AppDirs.root(context)
        val usage = AppDirs.rootUsagePercent(context)
        val limit = config.internalCacheLimitPercent.coerceIn(5, 95)
        val cacheIntDir = File(root, "cache").apply { mkdirs() }
        val extCacheDir = AppDirs.preferredExternalWritableDir(context, "cache")
        val policy = if (usage >= limit) {
            if (extCacheDir == null) {
                "ALERTA: uso ${"%.1f".format(usage)}% >= limite ${limit}% mas NAO ha pasta cache gravavel em USB/SD — dispatch NAO sera gravado."
            } else {
                "Cache dispatch gravado em EXTERNO: ${extCacheDir.absolutePath}"
            }
        } else {
            "Cache dispatch gravado em INTERNO: ${cacheIntDir.absolutePath}"
        }

        val planInt = File(cacheIntDir, "last-dispatch-plan.json")
        val planExt = extCacheDir?.let { File(it, "last-dispatch-plan.json") }
        val srcInt = File(cacheIntDir, "current-plan-source.txt")
        val srcExt = extCacheDir?.let { File(it, "current-plan-source.txt") }

        val logFile = File(context.filesDir, "smartsignage-ad.log")

        return buildString {
            appendLine("=== CACHE (dispatch / plano) ===")
            appendLine("AppDirs.root: ${root.absolutePath}")
            appendLine("Uso deste volume: ${"%.2f".format(usage)}% | limite configurado: $limit%")
            appendLine(policy)
            appendLine("last-dispatch-plan.json (interno): ${fileStatus(planInt)}")
            if (planExt != null) appendLine("last-dispatch-plan.json (externo): ${fileStatus(planExt)}")
            appendLine("current-plan-source.txt (interno): ${fileStatus(srcInt)}")
            if (srcExt != null) appendLine("current-plan-source.txt (externo): ${fileStatus(srcExt)}")
            appendLine()
            appendLine("=== DEMO (APK assets -> files internos) ===")
            appendLine("Origem: assets/propagandas e assets/vinhetas (so mp4/webm/mov/jpg/png).")
            appendLine(assetsSummary(context, "propagandas"))
            appendLine(assetsSummary(context, "vinhetas"))
            appendLine("Destino propagandas: ${AppDirs.demoPropagandas(context).absolutePath}")
            appendLine("  -> ${folderDetail(AppDirs.demoPropagandas(context))}")
            appendLine("Destino vinhetas: ${AppDirs.demoVinhetas(context).absolutePath}")
            appendLine("  -> ${folderDetail(AppDirs.demoVinhetas(context))}")
            appendLine()
            appendLine("=== MIDIA USB/SD ===")
            appendLine("Raizes de volume (${AppDirs.mediaVolumeRoots(context).size}):")
            AppDirs.mediaVolumeRoots(context).forEach { appendLine("  $it") }
            appendLine()
            appendLine("Propagandas: ate 25 pastas candidatas (existe? listFiles ok? n ficheiros, nomes exemplo):")
            appendLine(folderCandidatesDetail(context, "propagandas", 25))
            appendLine("Vinhetas: ate 25 pastas candidatas (mesmo detalhe):")
            appendLine(folderCandidatesDetail(context, "vinhetas", 25))
            appendLine()
            appendLine("=== LOG / CONFIG ===")
            appendLine("Log ficheiro: ${logFile.absolutePath} | ${fileStatus(logFile)}")
            appendLine("Config interna: ${File(context.filesDir, "app-config.json").absolutePath} | exists=${File(context.filesDir, "app-config.json").exists()}")
            getExternalFilesDirSafe(context)?.let { base ->
                val scoped = File(File(base, "smartsignage-ad"), "app-config.json")
                appendLine("Config app-scoped: ${scoped.absolutePath} | exists=${scoped.exists()}")
            }
        }
    }

    private fun getExternalFilesDirSafe(context: Context): File? =
        try {
            context.getExternalFilesDir(null)
        } catch (_: Exception) {
            null
        }

    private fun fileStatus(f: File): String {
        if (!f.exists()) return "nao existe"
        return if (f.isFile) "ok ${f.length()} bytes" else "dir"
    }

    private fun assetsSummary(context: Context, folder: String): String {
        val names = try {
            context.assets.list(folder)?.filter { n ->
                val l = n.lowercase()
                l.endsWith(".mp4") || l.endsWith(".webm") || l.endsWith(".mov") ||
                    l.endsWith(".jpg") || l.endsWith(".jpeg") || l.endsWith(".png")
            }.orEmpty()
        } catch (_: Exception) {
            emptyList()
        }
        val sample = names.take(6).joinToString(", ").ifEmpty { "(nenhum)" }
        return "assets/$folder: ${names.size} ficheiro(s) midia no APK | ex.: $sample"
    }

    private fun folderDetail(dir: File): String {
        if (!dir.exists()) return "existe=nao"
        if (!dir.isDirectory) return "existe=sim mas nao e pasta"
        val arr = dir.listFiles()
        if (arr == null) return "existe=sim | listFiles=null (provavel bloqueio permissao)"
        val files = arr.count { it.isFile }
        val sample = arr.filter { it.isFile }.take(5).joinToString(", ") { it.name }.ifEmpty { "-" }
        return "existe=sim | listFiles=ok | ficheiros=$files | ex.: $sample"
    }

    private fun folderCandidatesDetail(context: Context, name: String, maxLines: Int): String {
        val dirs = AppDirs.externalMediaDirs(context, name)
        if (dirs.isEmpty()) return "  (nenhuma pasta candidata)"
        return buildString {
            dirs.take(maxLines).forEach { d ->
                appendLine("  ${d.absolutePath}")
                appendLine("    ${folderDetail(d)}")
            }
            if (dirs.size > maxLines) appendLine("  ... +${dirs.size - maxLines} pastas")
        }.trimEnd()
    }
}
