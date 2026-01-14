package com.smartsignage.player.cache

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * MediaCacheManager - Android
 * Gerencia cache local de mídias do DispatchPlan
 */
class MediaCacheManager(private val context: Context) {
    
    private val cacheDir: File = File(context.getExternalFilesDir(null), "cache/media")
    private val metadataFile: File = File(context.getExternalFilesDir(null), "cache/metadata.json")
    private val dispatchPlanFile: File = File(context.getExternalFilesDir(null), "cache/dispatch_plan.json")
    
    companion object {
        private const val TAG = "MediaCacheManager"
        private const val MAX_CACHE_SIZE = 32L * 1024 * 1024 * 1024 // 32GB
        private const val CACHE_THRESHOLD = 0.8 // 80%
    }

    init {
        // Criar diretórios se não existirem
        cacheDir.mkdirs()
    }

    /**
     * Processa DispatchPlan e baixa mídias necessárias
     */
    suspend fun processDispatchPlan(
        dispatchPlan: com.smartsignage.player.models.DispatchPlan,
        apiClient: com.smartsignage.player.api.APIClient
    ): CacheStats = withContext(Dispatchers.IO) {
        val stats = CacheStats()
        
        try {
            // Salvar último DispatchPlan para modo offline
            saveLastDispatchPlan(dispatchPlan)
            
            // Verificar espaço disponível
            ensureCacheSpace(dispatchPlan.mediaItems)
            
            // Processar cada mídia
            dispatchPlan.mediaItems.forEach { mediaItem ->
                try {
                    val cached = getCachedMedia(mediaItem.mediaId)
                    
                    if (cached != null && cached.valid) {
                        // Verificar checksum se disponível
                        if (mediaItem.metadata?.checksum != null) {
                            val isValid = validateChecksum(cached.localPath, mediaItem.metadata.checksum)
                            if (!isValid) {
                                Log.warn(TAG, "Mídia ${mediaItem.mediaId} corrompida, removendo e baixando novamente")
                                removeCachedMedia(mediaItem.mediaId)
                                downloadMedia(mediaItem, apiClient, stats)
                            } else {
                                stats.skipped++
                            }
                        } else {
                            stats.skipped++
                        }
                    } else {
                        // Download necessário
                        downloadMedia(mediaItem, apiClient, stats)
                    }
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

    /**
     * Baixa uma mídia específica
     */
    private suspend fun downloadMedia(
        mediaItem: com.smartsignage.player.models.DispatchPlanMediaItem,
        apiClient: com.smartsignage.player.api.APIClient,
        stats: CacheStats
    ) = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Baixando mídia ${mediaItem.mediaId}...")
            
            // Determinar URL de download
            val downloadUrl = if (mediaItem.url.startsWith("http://") || mediaItem.url.startsWith("https://")) {
                mediaItem.url
            } else {
                "${apiClient.baseURL}/api/media/${mediaItem.mediaId}/download"
            }
            
            // Baixar arquivo
            val response = apiClient.downloadMedia(mediaItem.mediaId)
            if (!response.isSuccessful) {
                throw IOException("HTTP ${response.code}: ${response.message}")
            }
            
            val body = response.body?.bytes() ?: throw IOException("Response body is null")
            
            // Validar tamanho se disponível
            if (mediaItem.metadata?.size != null && body.size != mediaItem.metadata.size) {
                throw IOException("Tamanho incorreto: esperado ${mediaItem.metadata.size}, recebido ${body.size}")
            }
            
            // Calcular checksum
            val checksum = calculateChecksum(body)
            
            // Validar checksum se disponível
            if (mediaItem.metadata?.checksum != null && checksum != mediaItem.metadata.checksum) {
                throw IOException("Checksum inválido: esperado ${mediaItem.metadata.checksum}, calculado $checksum")
            }
            
            // Salvar arquivo
            val extension = getFileExtension(mediaItem.metadata?.mimeType ?: "application/octet-stream")
            val fileName = "${mediaItem.mediaId}_${checksum}.$extension"
            val localPath = File(cacheDir, fileName)
            
            FileOutputStream(localPath).use { it.write(body) }
            
            // Salvar metadados
            saveMediaMetadata(mediaItem.mediaId, MediaMetadata(
                mediaId = mediaItem.mediaId,
                url = mediaItem.url,
                localPath = localPath.absolutePath,
                checksum = checksum,
                size = body.size,
                mimeType = mediaItem.metadata?.mimeType ?: "application/octet-stream",
                downloadedAt = System.currentTimeMillis(),
                lastAccessed = System.currentTimeMillis(),
                valid = true
            ))
            
            stats.success++
            Log.d(TAG, "Mídia ${mediaItem.mediaId} baixada com sucesso: ${localPath.absolutePath}")
            
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao baixar mídia ${mediaItem.mediaId}", e)
            stats.failed++
            throw e
        }
    }

    /**
     * Obtém mídia do cache
     */
    fun getCachedMedia(mediaId: Int): MediaMetadata? {
        return try {
            val metadata = loadMediaMetadata(mediaId)
            if (metadata != null && metadata.valid) {
                // Verificar se arquivo ainda existe
                val file = File(metadata.localPath)
                if (file.exists()) {
                    // Atualizar último acesso
                    metadata.lastAccessed = System.currentTimeMillis()
                    saveMediaMetadata(mediaId, metadata)
                    metadata
                } else {
                    null
                }
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao obter mídia do cache", e)
            null
        }
    }

    /**
     * Obtém caminho local de uma mídia
     */
    fun getLocalPath(mediaId: Int): String? {
        return getCachedMedia(mediaId)?.localPath
    }

    /**
     * Remove mídia do cache
     */
    fun removeCachedMedia(mediaId: Int) {
        try {
            val metadata = loadMediaMetadata(mediaId)
            if (metadata != null && metadata.localPath.isNotEmpty()) {
                File(metadata.localPath).delete()
            }
            removeMediaMetadata(mediaId)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao remover mídia do cache", e)
        }
    }

    /**
     * Garante espaço suficiente no cache
     */
    private suspend fun ensureCacheSpace(mediaItems: List<com.smartsignage.player.models.DispatchPlanMediaItem>) {
        val totalSize = mediaItems.sumOf { it.metadata?.size?.toLong() ?: 0L }
        val currentSize = getCacheSize()
        val availableSpace = MAX_CACHE_SIZE - currentSize
        
        if (totalSize > availableSpace) {
            val neededSpace = totalSize - availableSpace
            Log.i(TAG, "Espaço insuficiente. Liberando $neededSpace bytes...")
            cleanupCache(neededSpace, mediaItems.map { it.mediaId })
        }
    }

    /**
     * Obtém tamanho atual do cache
     */
    fun getCacheSize(): Long {
        return cacheDir.listFiles()?.sumOf { it.length() } ?: 0L
    }

    /**
     * Limpa cache usando política LRU
     */
    private fun cleanupCache(minBytesToFree: Long, currentMediaIds: List<Int>) {
        val currentMediaIdsSet = currentMediaIds.toSet()
        val allMetadata = loadAllMediaMetadata()
        
        // Filtrar mídias não usadas e ordenar por último acesso (LRU)
        val unusedMedia = allMetadata
            .filter { it.mediaId !in currentMediaIdsSet }
            .sortedBy { it.lastAccessed }
        
        var freedSpace = 0L
        for (metadata in unusedMedia) {
            if (freedSpace >= minBytesToFree) break
            
            removeCachedMedia(metadata.mediaId)
            freedSpace += metadata.size
        }
        
        Log.i(TAG, "Limpeza concluída: $freedSpace bytes liberados")
    }

    /**
     * Salva último DispatchPlan para modo offline
     */
    private fun saveLastDispatchPlan(dispatchPlan: com.smartsignage.player.models.DispatchPlan) {
        try {
            val json = com.google.gson.Gson().toJson(dispatchPlan)
            dispatchPlanFile.writeText(json)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao salvar DispatchPlan", e)
        }
    }

    /**
     * Carrega último DispatchPlan salvo (modo offline)
     */
    fun loadLastDispatchPlan(): com.smartsignage.player.models.DispatchPlan? {
        return try {
            if (dispatchPlanFile.exists()) {
                val json = dispatchPlanFile.readText()
                com.google.gson.Gson().fromJson(json, com.smartsignage.player.models.DispatchPlan::class.java)
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao carregar DispatchPlan", e)
            null
        }
    }

    /**
     * Salva metadados de mídia
     */
    private fun saveMediaMetadata(mediaId: Int, metadata: MediaMetadata) {
        try {
            val allMetadata = loadAllMediaMetadata().toMutableMap()
            allMetadata[mediaId] = metadata
            val json = com.google.gson.Gson().toJson(allMetadata)
            metadataFile.writeText(json)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao salvar metadados", e)
        }
    }

    /**
     * Carrega metadados de uma mídia
     */
    private fun loadMediaMetadata(mediaId: Int): MediaMetadata? {
        return loadAllMediaMetadata()[mediaId]
    }

    /**
     * Carrega todos os metadados
     */
    private fun loadAllMediaMetadata(): Map<Int, MediaMetadata> {
        return try {
            if (metadataFile.exists()) {
                val json = metadataFile.readText()
                val type = object : com.google.gson.reflect.TypeToken<Map<Int, MediaMetadata>>() {}.type
                com.google.gson.Gson().fromJson(json, type) ?: emptyMap()
            } else {
                emptyMap()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao carregar metadados", e)
            emptyMap()
        }
    }

    /**
     * Remove metadados de uma mídia
     */
    private fun removeMediaMetadata(mediaId: Int) {
        try {
            val allMetadata = loadAllMediaMetadata().toMutableMap()
            allMetadata.remove(mediaId)
            val json = com.google.gson.Gson().toJson(allMetadata)
            metadataFile.writeText(json)
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao remover metadados", e)
        }
    }

    /**
     * Calcula checksum SHA-256
     */
    private fun calculateChecksum(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(data)
        return hash.joinToString("") { "%02x".format(it) }
    }

    /**
     * Valida checksum de um arquivo
     */
    private fun validateChecksum(filePath: String, expectedChecksum: String): Boolean {
        return try {
            val file = File(filePath)
            val data = file.readBytes()
            val calculatedChecksum = calculateChecksum(data)
            calculatedChecksum == expectedChecksum
        } catch (e: Exception) {
            Log.e(TAG, "Erro ao validar checksum", e)
            false
        }
    }

    /**
     * Obtém extensão de arquivo do MIME type
     */
    private fun getFileExtension(mimeType: String): String {
        return when (mimeType) {
            "video/mp4" -> "mp4"
            "video/webm" -> "webm"
            "video/quicktime" -> "mov"
            "image/jpeg", "image/jpg" -> "jpg"
            "image/png" -> "png"
            "image/gif" -> "gif"
            "image/webp" -> "webp"
            "audio/mpeg", "audio/mp3" -> "mp3"
            "audio/ogg" -> "ogg"
            "audio/wav" -> "wav"
            else -> "bin"
        }
    }

    /**
     * Estatísticas de cache
     */
    data class CacheStats(
        var success: Int = 0,
        var failed: Int = 0,
        var skipped: Int = 0
    )

    /**
     * Metadados de mídia em cache
     */
    data class MediaMetadata(
        val mediaId: Int,
        val url: String,
        val localPath: String,
        val checksum: String,
        val size: Long,
        val mimeType: String,
        val downloadedAt: Long,
        var lastAccessed: Long,
        val valid: Boolean
    )
}
