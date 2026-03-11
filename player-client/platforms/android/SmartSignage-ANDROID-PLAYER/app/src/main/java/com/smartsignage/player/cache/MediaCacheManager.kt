package com.smartsignage.player.cache

import android.content.Context
import android.util.Log
import com.smartsignage.player.api.APIClient
import com.smartsignage.player.models.DispatchPlan
import com.smartsignage.player.models.DispatchPlanMediaItem
import com.smartsignage.player.storage.StorageHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest

/**
 * MediaCacheManager - Android
 * Gerencia cache local em {pathBase}/propagandas/ (design: path fixo /propagandas).
 * Usa StorageHelper: interno + USB quando presente; resolução interno → USB para leitura.
 */
class MediaCacheManager(private val context: Context) {

    private val storageHelper = StorageHelper(context)
    private val metadataFile: File = File(context.filesDir, "cache/metadata.json")
    private val dispatchPlanFile: File = File(context.filesDir, "cache/dispatch_plan.json")

    init {
        metadataFile.parentFile?.mkdirs()
    }

    companion object {
        private const val TAG = "MediaCacheManager"
        private const val CACHE_THRESHOLD_FREE = 0.2 // Manter pelo menos 20% livre
    }

    /**
     * Processa DispatchPlan: baixa mídias para .../propagandas/{mediaId}.{ext}
     */
    suspend fun processDispatchPlan(
        dispatchPlan: DispatchPlan,
        apiClient: APIClient
    ): CacheStats = withContext(Dispatchers.IO) {
        val stats = CacheStats()
        try {
            saveLastDispatchPlan(dispatchPlan)
            ensureCacheSpace(dispatchPlan.mediaItems)
            for (mediaItem in dispatchPlan.mediaItems) {
                try {
                    val mediaIdStr = mediaItem.mediaId.toString()
                    val ext = getFileExtension(mediaItem.metadata?.get("mimeType")?.toString() ?: "application/octet-stream")
                    val resolved = storageHelper.resolveMediaPath(mediaIdStr, ext)
                    if (resolved != null) {
                        val meta = loadMediaMetadata(mediaItem.mediaId)
                        if (meta != null && mediaItem.metadata?.get("checksum")?.toString()?.let { meta.checksum == it } == true) {
                            stats.skipped++
                            continue
                        }
                    }
                    downloadMedia(mediaItem, apiClient, stats)
                } catch (e: Exception) {
                    Log.e(TAG, "Erro ao processar mídia ${mediaItem.mediaId}", e)
                    stats.failed++
                }
            }
            Log.i(TAG, "Processamento concluído: ${stats.success} sucesso, ${stats.failed} falhas, ${stats.skipped} puladas")
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao processar DispatchPlan", e)
        }
        stats
    }

    private suspend fun downloadMedia(
        mediaItem: DispatchPlanMediaItem,
        apiClient: APIClient,
        stats: CacheStats
    ) = withContext(Dispatchers.IO) {
        try {
            val mediaIdStr = mediaItem.mediaId.toString()
            val ext = getFileExtension(mediaItem.metadata?.get("mimeType")?.toString() ?: "application/octet-stream")
            val fileName = "$mediaIdStr.$ext"
            val propagandasDir = storageHelper.getWritePropagandasDir()
            val localFile = File(propagandasDir, fileName)

            val response = if (mediaItem.url.isNotBlank()) {
                apiClient.downloadFromUrl(mediaItem.url)
            } else {
                apiClient.downloadMedia(mediaItem.mediaId)
            }
            if (!response.isSuccessful) {
                throw IOException("HTTP ${response.code}: ${response.message}")
            }
            val body = response.body?.bytes() ?: throw IOException("Response body is null")

            val checksum = calculateChecksum(body)
            val expectedChecksum = mediaItem.metadata?.get("checksum")?.toString()
            if (expectedChecksum != null && checksum != expectedChecksum) {
                throw IOException("Checksum inválido")
            }

            FileOutputStream(localFile).use { it.write(body) }

            saveMediaMetadata(
                mediaItem.mediaId,
                MediaMetadata(
                    mediaId = mediaItem.mediaId,
                    url = mediaItem.url,
                    localPath = localFile.absolutePath,
                    checksum = checksum,
                    size = body.size,
                    mimeType = mediaItem.metadata?.get("mimeType")?.toString() ?: "application/octet-stream",
                    extension = ext,
                    downloadedAt = System.currentTimeMillis(),
                    lastAccessed = System.currentTimeMillis(),
                    valid = true
                )
            )
            stats.success++
            Log.d(TAG, "Mídia ${mediaItem.mediaId} baixada: ${localFile.absolutePath}")
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao baixar mídia ${mediaItem.mediaId}", e)
            stats.failed++
        }
    }

    fun getCachedMedia(mediaId: Int): MediaMetadata? {
        val meta = loadMediaMetadata(mediaId) ?: return null
        val ext = meta.extension.ifEmpty { null }
        val path = storageHelper.resolveMediaPath(mediaId.toString(), ext)
        if (path != null && File(path).exists()) {
            meta.lastAccessed = System.currentTimeMillis()
            saveMediaMetadata(mediaId, meta)
            return meta.copy(localPath = path)
        }
        return null
    }

    /** Path local para reprodução (ordem conforme config: por defeito externo → interno) */
    fun getLocalPath(mediaId: Int): String? {
        val meta = loadMediaMetadata(mediaId)
        val ext = meta?.extension?.takeIf { it.isNotEmpty() }
        return storageHelper.resolveMediaPath(mediaId.toString(), ext)
    }

    fun removeCachedMedia(mediaId: Int) {
        val meta = loadMediaMetadata(mediaId) ?: return
        val ext = meta.extension.ifEmpty { null }
        for (root in storageHelper.getStorageRoots()) {
            val prop = File(root, StorageHelper.PROPAGANDAS_DIR)
            if (ext != null) {
                File(prop, "${mediaId}.$ext").delete()
            } else {
                for (e in listOf("mp4", "webm", "jpg", "jpeg", "png", "gif", "webp")) {
                    File(prop, "$mediaId.$e").delete()
                }
            }
        }
        removeMediaMetadata(mediaId)
    }

    private suspend fun ensureCacheSpace(mediaItems: List<DispatchPlanMediaItem>) {
        val totalNeeded = mediaItems.sumOf { (it.metadata?.get("size") as? Number)?.toLong() ?: 0L }
        val writeProp = storageHelper.getWritePropagandasDir()
        var free = storageHelper.getFreeSpaceBytes(writeProp.parentFile ?: writeProp)
        if (totalNeeded > free * (1 - CACHE_THRESHOLD_FREE)) {
            val allMeta = loadAllMediaMetadata()
            val currentIds = mediaItems.map { it.mediaId }.toSet()
            val unused = allMeta.filter { it.mediaId !in currentIds }.sortedBy { it.lastAccessed }
            var freed = 0L
            for (m in unused) {
                if (freed >= totalNeeded) break
                removeCachedMedia(m.mediaId)
                freed += m.size
            }
            Log.i(TAG, "Limpeza: $freed bytes liberados")
        }
    }

    fun loadLastDispatchPlan(): DispatchPlan? {
        return try {
            if (dispatchPlanFile.exists()) {
                com.google.gson.Gson().fromJson(
                    dispatchPlanFile.readText(),
                    DispatchPlan::class.java
                )
            } else null
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao carregar DispatchPlan", e)
            null
        }
    }

    private fun saveLastDispatchPlan(plan: DispatchPlan) {
        try {
            dispatchPlanFile.writeText(com.google.gson.Gson().toJson(plan))
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao salvar DispatchPlan", e)
        }
    }

    private fun saveMediaMetadata(mediaId: Int, metadata: MediaMetadata) {
        val all = loadAllMediaMetadata().toMutableMap()
        all[mediaId] = metadata
        metadataFile.writeText(com.google.gson.Gson().toJson(all))
    }

    private fun loadMediaMetadata(mediaId: Int): MediaMetadata? = loadAllMediaMetadata()[mediaId]

    private fun loadAllMediaMetadata(): Map<Int, MediaMetadata> {
        if (!metadataFile.exists()) return emptyMap()
        return try {
            val type = object : com.google.gson.reflect.TypeToken<Map<Int, MediaMetadata>>() {}.type
            com.google.gson.Gson().fromJson(metadataFile.readText(), type) ?: emptyMap()
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao carregar metadados", e)
            emptyMap()
        }
    }

    private fun removeMediaMetadata(mediaId: Int) {
        val all = loadAllMediaMetadata().toMutableMap()
        all.remove(mediaId)
        metadataFile.writeText(com.google.gson.Gson().toJson(all))
    }

    private fun calculateChecksum(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(data).joinToString("") { "%02x".format(it) }
    }

    private fun getFileExtension(mimeType: String): String = when (mimeType) {
        "video/mp4" -> "mp4"
        "video/webm" -> "webm"
        "video/quicktime" -> "mov"
        "image/jpeg", "image/jpg" -> "jpg"
        "image/png" -> "png"
        "image/gif" -> "gif"
        "image/webp" -> "webp"
        else -> "bin"
    }

    fun getStorageHelper(): StorageHelper = storageHelper

    data class CacheStats(var success: Int = 0, var failed: Int = 0, var skipped: Int = 0)

    data class MediaMetadata(
        val mediaId: Int,
        val url: String,
        val localPath: String,
        val checksum: String,
        val size: Long,
        val mimeType: String,
        val extension: String = "",
        val downloadedAt: Long,
        var lastAccessed: Long,
        val valid: Boolean
    )
}
