package br.com.smartchannel.playerad.util

import java.io.File

/**
 * Copia dados do player quando o root de armazenamento muda
 * (ex.: USB ejetado, troca `storage` na config).
 *
 * Copia apenas ficheiros que ainda não existem no destino (não sobrescreve).
 */
object StorageRootMigrator {

    private val ROOT_FILES = listOf(
        "last-dispatch-plan.json",
        "current-plan-source.txt",
    )

    private val ROOT_DIRS = listOf(
        "propagandas",
        "vinhetas",
    )

    data class Result(
        val migrated: Boolean,
        val filesCopied: Int,
        val fromPath: String?,
        val toPath: String,
        val message: String,
    )

    fun migrateIfNeeded(fromRoot: File?, toRoot: File): Result {
        val toPath = try {
            toRoot.canonicalFile.absolutePath
        } catch (_: Exception) {
            toRoot.absolutePath
        }
        if (fromRoot == null) {
            return Result(false, 0, null, toPath, "sem root anterior")
        }
        val fromPath = try {
            fromRoot.canonicalFile.absolutePath
        } catch (_: Exception) {
            fromRoot.absolutePath
        }
        if (fromPath == toPath) {
            return Result(false, 0, fromPath, toPath, "mesmo root")
        }
        if (!fromRoot.exists() || !fromRoot.isDirectory) {
            return Result(false, 0, fromPath, toPath, "origem inexistente")
        }
        try {
            if (!toRoot.exists()) toRoot.mkdirs()
        } catch (e: Exception) {
            return Result(false, 0, fromPath, toPath, "destino sem escrita: ${e.message}")
        }
        if (!StorageRootResolver.probeWritableDirectory(toRoot)) {
            return Result(false, 0, fromPath, toPath, "destino não gravável")
        }

        var copied = 0
        try {
            for (name in ROOT_DIRS) {
                copied += copyDirMissingOnly(File(fromRoot, name), File(toRoot, name))
            }
            for (name in ROOT_FILES) {
                val src = File(fromRoot, name)
                val dst = File(toRoot, name)
                if (src.isFile && !dst.exists()) {
                    src.copyTo(dst, overwrite = false)
                    copied++
                }
            }
            PlayerAdLogger.i(
                "STORAGE",
                "Migração root $fromPath → $toPath (ficheiros=$copied)"
            )
            return Result(true, copied, fromPath, toPath, "ok")
        } catch (e: Exception) {
            PlayerAdLogger.e("STORAGE", "Falha na migração $fromPath → $toPath", e)
            return Result(false, copied, fromPath, toPath, e.message ?: "erro")
        }
    }

    private fun copyDirMissingOnly(src: File, dst: File): Int {
        if (!src.exists() || !src.isDirectory) return 0
        if (!dst.exists()) dst.mkdirs()
        var n = 0
        src.listFiles()?.forEach { child ->
            val target = File(dst, child.name)
            when {
                child.isDirectory -> n += copyDirMissingOnly(child, target)
                child.isFile && !target.exists() -> {
                    child.copyTo(target, overwrite = false)
                    n++
                }
            }
        }
        return n
    }
}
