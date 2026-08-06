package br.com.smartchannel.playerad.cache

import android.content.Context
import br.com.smartchannel.playerad.config.PlayerConfig
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import br.com.smartchannel.playerad.util.AppDirs
import br.com.smartchannel.playerad.util.PlayerAdLogger
import org.json.JSONObject
import org.json.JSONException
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.charset.Charset

/**
 * MediaCacheManager - Player-AD (Android TV)
 *
 * Responsável por:
 * - Gerir o diretório de cache local `propagandas`
 * - Persistir metadados em `propagandas/metadata.json`
 * - Controlar LRU com limite de tamanho (default 1000 MB)
 * - Manter histórico de plays por dia (sum_play), mesmo após remoção física
 *
 * Limpeza: primeiro candidatos com lastAccessed ≥ 8 dias; se ainda acima do teto,
 * LRU sem filtro de idade (pressão). Ver também [ensureDiskSpaceFor].
 * Documentação: `docs/Player-AD-CACHE-E-METADADOS.md`.
 */
class MediaCacheManager private constructor(
    private val resolvePropagandas: () -> File,
    maxCacheSizeBytes: Long = 1000L * 1024L * 1024L,
) {
    constructor(
        context: Context,
        maxCacheSizeBytes: Long = 1000L * 1024L * 1024L,
    ) : this(
        resolvePropagandas = { AppDirs.propagandas(context) },
        maxCacheSizeBytes = maxCacheSizeBytes,
    )

    companion object {
        /** Reserva mínima de espaço livre no volume após um download. */
        const val MIN_FREE_BYTES_AFTER_DOWNLOAD = 200L * 1024L * 1024L
        private const val EIGHT_DAYS_MS = 8L * 24L * 60L * 60L * 1000L
        /** Estimativa quando Content-Length é desconhecido. */
        const val UNKNOWN_DOWNLOAD_ESTIMATE_BYTES = 32L * 1024L * 1024L

        /**
         * Teto efectivo = min(maxCacheSizeMb, % do totalSpace se configurado).
         */
        fun effectiveMaxCacheBytes(
            maxCacheSizeMb: Int,
            maxCachePercentOfVolume: Int?,
            volumeTotalBytes: Long,
        ): Long {
            val fromMb = PlayerConfigLoader.coerceMaxCacheSizeMb(maxCacheSizeMb) * 1024L * 1024L
            val pct = maxCachePercentOfVolume
            if (pct == null || pct <= 0 || volumeTotalBytes <= 0L) return fromMb
            val fromPct = volumeTotalBytes * pct.coerceIn(1, 90) / 100L
            val minBytes = PlayerConfigLoader.MAX_CACHE_SIZE_MB_MIN * 1024L * 1024L
            return minOf(fromMb, fromPct).coerceAtLeast(minBytes)
        }

        /** Instância para testes JVM (sem Context Android). */
        fun forTesting(
            propagandasDir: File,
            maxCacheSizeBytes: Long = 1000L * 1024L * 1024L,
        ): MediaCacheManager = MediaCacheManager(
            resolvePropagandas = { propagandasDir },
            maxCacheSizeBytes = maxCacheSizeBytes,
        )
    }

    @Volatile
    private var maxCacheSizeBytes: Long = maxCacheSizeBytes.coerceAtLeast(
        PlayerConfigLoader.MAX_CACHE_SIZE_MB_MIN * 1024L * 1024L
    )

    /** Actualiza o teto LRU (ex.: após reload de config). */
    @Synchronized
    fun updateMaxCacheSizeBytes(bytes: Long) {
        maxCacheSizeBytes = bytes.coerceAtLeast(
            PlayerConfigLoader.MAX_CACHE_SIZE_MB_MIN * 1024L * 1024L
        )
        PlayerAdLogger.i("CACHE", "maxCacheSizeBytes=$maxCacheSizeBytes")
    }

    fun applyLimitsFromConfig(cfg: PlayerConfig) {
        val total = try {
            propagandasDir().totalSpace
        } catch (_: Exception) {
            0L
        }
        updateMaxCacheSizeBytes(
            effectiveMaxCacheBytes(cfg.maxCacheSizeMb, cfg.maxCachePercentOfVolume, total)
        )
    }

    private fun propagandasDir(): File = resolvePropagandas().also { dir ->
        if (!dir.exists()) dir.mkdirs()
    }

    private fun metadataFile(): File = File(propagandasDir(), "metadata.json")

    /** Caminho usado na última carga de metadados (mudança de `storage` em config exige reload). */
    private var lastPropagandasAbsolutePath: String = ""

    // Estrutura em memória: JSONObject com chaves = mediaId (string), valor = objeto de metadados
    @Volatile
    private var metadata: JSONObject = JSONObject()

    /**
     * Representação tipada dos metadados de uma mídia.
     */
    data class MediaMetadata(
        val mediaId: Long,
        val fileName: String?,
        val size: Long,
        val checksum: String?,
        val mimeType: String?,
        val downloadedAt: Long,
        val lastAccessed: Long,
        val valid: Boolean,
        val sumPlay: Map<String, Int>,
        /** Avaliação de orientação no cache concluída (com ou sem rotação). */
        val cacheOrientationReady: Boolean = false,
        val cacheRotated: Boolean = false,
        /** Montagem (0–3) para a qual o ficheiro/matrix de cache foi preparado. */
        val cacheDisplayRotation: Int? = null,
        val contentVersion: String? = null,
    )

    /**
     * Inicializar: carregar metadata.json (se existir) para memória.
     */
    @Synchronized
    fun init() {
        lastPropagandasAbsolutePath = propagandasDir().absolutePath
        metadata = loadMetadataFromDisk()
    }

    /**
     * Chamar após alterar `player-config.json` (ex.: voltar do ecrã de debug com novo armazenamento).
     * Recarrega `metadata.json` do diretório atual de propagandas.
     */
    @Synchronized
    fun reloadStorageRootsIfNeeded() {
        val path = propagandasDir().absolutePath
        if (path != lastPropagandasAbsolutePath) {
            PlayerAdLogger.i(
                "STORAGE",
                "Cache de propagandas mudou de '$lastPropagandasAbsolutePath' para '$path' — a recarregar metadados"
            )
            lastPropagandasAbsolutePath = path
            metadata = loadMetadataFromDisk()
        }
    }

    /**
     * Registra/atualiza metadados após download bem-sucedido.
     *
     * - Cria/atualiza entrada com valid=true
     * - Atualiza downloadedAt/lastAccessed
     * - Preserva sum_play existente (histórico)
     */
    @Synchronized
    fun onDownloadCompleted(
        mediaId: Long,
        fileName: String,
        sizeBytes: Long,
        checksum: String?,
        mimeType: String?,
        cacheOrientationReady: Boolean = false,
        cacheRotated: Boolean = false,
        cacheDisplayRotation: Int? = null,
        contentVersion: String? = null,
    ) {
        val now = System.currentTimeMillis()
        val key = mediaId.toString()
        val existing = metadata.optJSONObject(key)

        val sumPlay = existing?.optJSONObject("sum_play") ?: JSONObject()

        val obj = JSONObject()
        obj.put("mediaId", mediaId)
        obj.put("fileName", fileName)
        obj.put("size", sizeBytes)
        obj.put("checksum", checksum ?: JSONObject.NULL)
        obj.put("mimeType", mimeType ?: JSONObject.NULL)
        obj.put("downloadedAt", existing?.optLong("downloadedAt", now) ?: now)
        obj.put("lastAccessed", now)
        obj.put("valid", true)
        obj.put("sum_play", sumPlay)
        obj.put("cacheOrientationReady", cacheOrientationReady)
        obj.put("cacheRotated", cacheRotated)
        val mount = cacheDisplayRotation?.coerceIn(0, 3)
            ?: existing?.optInt("cacheDisplayRotation", -1)?.takeIf { it in 0..3 }
        if (mount != null) {
            obj.put("cacheDisplayRotation", mount)
        }
        if (!contentVersion.isNullOrBlank()) {
            obj.put("contentVersion", contentVersion)
        } else {
            existing?.optString("contentVersion", "")?.takeIf { it.isNotBlank() }?.let {
                obj.put("contentVersion", it)
            }
        }

        metadata.put(key, obj)
        saveMetadataToDisk()
    }

    @Synchronized
    fun updateCacheOrientationState(
        mediaId: Long,
        fileName: String?,
        sizeBytes: Long?,
        cacheOrientationReady: Boolean,
        cacheRotated: Boolean,
        cacheDisplayRotation: Int? = null,
    ) {
        val key = mediaId.toString()
        val existing = metadata.optJSONObject(key) ?: return
        fileName?.let { existing.put("fileName", it) }
        sizeBytes?.let { existing.put("size", it) }
        existing.put("cacheOrientationReady", cacheOrientationReady)
        existing.put("cacheRotated", cacheRotated)
        cacheDisplayRotation?.coerceIn(0, 3)?.let { existing.put("cacheDisplayRotation", it) }
        existing.put("lastAccessed", System.currentTimeMillis())
        metadata.put(key, existing)
        saveMetadataToDisk()
    }

    /**
     * Após mudança de montagem no menu/config:
     * - ficheiros fisicamente rodados para outro mount → remove (re-download)
     * - restantes → marca orientação como pendente (matrix em runtime)
     * @return quantas entradas foram afectadas
     */
    @Synchronized
    fun reconcileForDisplayRotation(displayRotation: Int): Int {
        val mount = ((displayRotation % 4) + 4) % 4
        var touched = 0
        val keys = metadata.keys().asSequence().toList()
        for (key in keys) {
            val obj = metadata.optJSONObject(key) ?: continue
            if (!obj.optBoolean("valid", false)) continue
            val cachedMount = if (obj.has("cacheDisplayRotation")) {
                obj.optInt("cacheDisplayRotation", mount)
            } else {
                // Legado sem campo: se já foi rodado no disco, forçar re-download
                if (obj.optBoolean("cacheRotated", false)) -1 else mount
            }
            if (cachedMount == mount) continue
            touched++
            val id = key.toLongOrNull()
            if (obj.optBoolean("cacheRotated", false) || cachedMount < 0) {
                if (id != null) {
                    markAsRemoved(id)
                } else {
                    obj.put("valid", false)
                    obj.put("cacheOrientationReady", false)
                    obj.put("cacheRotated", false)
                    obj.remove("cacheDisplayRotation")
                }
            } else {
                obj.put("cacheOrientationReady", false)
                obj.put("cacheRotated", false)
                obj.put("cacheDisplayRotation", mount)
                metadata.put(key, obj)
            }
        }
        if (touched > 0) {
            saveMetadataToDisk()
            PlayerAdLogger.i(
                "CACHE",
                "Montagem=$mount: $touched entrada(s) de cache reconciliadas (orientação)",
            )
        }
        return touched
    }

    /**
     * Registra um play a partir do cache:
     * - Atualiza lastAccessed
     * - Incrementa sum_play[hoje] (yyyy-MM-dd)
     */
    @Synchronized
    fun onPlayFromCache(mediaId: Long, today: String) {
        val key = mediaId.toString()
        val existing = metadata.optJSONObject(key) ?: JSONObject().apply {
            put("mediaId", mediaId)
            put("fileName", JSONObject.NULL)
            put("size", 0L)
            put("checksum", JSONObject.NULL)
            put("mimeType", JSONObject.NULL)
            put("downloadedAt", System.currentTimeMillis())
            put("valid", false)
        }

        val now = System.currentTimeMillis()
        existing.put("lastAccessed", now)

        val sumPlay = existing.optJSONObject("sum_play") ?: JSONObject()
        val currentCount = sumPlay.optInt(today, 0)
        sumPlay.put(today, currentCount + 1)

        existing.put("sum_play", sumPlay)
        metadata.put(key, existing)
        saveMetadataToDisk()
    }

    /**
     * Marca uma mídia como removida fisicamente do cache (LRU):
     * - Apaga arquivo em propagandas/fileName
     * - Mantém entrada no JSON mas com valid=false
     */
    @Synchronized
    fun markAsRemoved(mediaId: Long) {
        val key = mediaId.toString()
        val existing = metadata.optJSONObject(key) ?: return

        val fileName = existing.optString("fileName", "").takeIf { it.isNotBlank() }
        if (!fileName.isNullOrEmpty()) {
            val file = File(propagandasDir(), fileName)
            if (file.exists()) {
                file.delete()
            }
        }

        existing.put("valid", false)
        metadata.put(key, existing)
        saveMetadataToDisk()
    }

    /**
     * Retorna metadados tipados de uma mídia, ou null se não existir.
     */
    @Synchronized
    fun getMetadata(mediaId: Long): MediaMetadata? {
        val key = mediaId.toString()
        val obj = metadata.optJSONObject(key) ?: return null

        return try {
            val sumPlayObj = obj.optJSONObject("sum_play") ?: JSONObject()
            val sumPlayMap = mutableMapOf<String, Int>()
            val keys = sumPlayObj.keys()
            while (keys.hasNext()) {
                val d = keys.next()
                sumPlayMap[d] = sumPlayObj.optInt(d, 0)
            }

            MediaMetadata(
                mediaId = obj.optLong("mediaId", mediaId),
                fileName = obj.optString("fileName", "").takeIf { it.isNotBlank() },
                size = obj.optLong("size", 0L),
                checksum = obj.optString("checksum", "").takeIf { it.isNotBlank() },
                mimeType = obj.optString("mimeType", "").takeIf { it.isNotBlank() },
                downloadedAt = obj.optLong("downloadedAt", 0L),
                lastAccessed = obj.optLong("lastAccessed", 0L),
                valid = obj.optBoolean("valid", false),
                sumPlay = sumPlayMap,
                cacheOrientationReady = obj.optBoolean("cacheOrientationReady", false),
                cacheRotated = obj.optBoolean("cacheRotated", false),
                cacheDisplayRotation = if (obj.has("cacheDisplayRotation")) {
                    obj.optInt("cacheDisplayRotation", 0).coerceIn(0, 3)
                } else {
                    null
                },
                contentVersion = obj.optString("contentVersion", "").takeIf { it.isNotBlank() },
            )
        } catch (e: JSONException) {
            null
        }
    }

    /**
     * Remove do cache físico mídias válidas cujo mediaId não está na playlist atual.
     * @return quantidade de entradas removidas
     */
    @Synchronized
    fun removeValidEntriesNotIn(currentMediaIds: Set<Long>): Int {
        val toRemove = mutableListOf<Long>()
        val keys = metadata.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val obj = metadata.optJSONObject(key) ?: continue
            if (!obj.optBoolean("valid", false)) continue
            val id = key.toLongOrNull() ?: continue
            if (id !in currentMediaIds) toRemove += id
        }
        for (id in toRemove) {
            markAsRemoved(id)
        }
        return toRemove.size
    }

    /**
     * Mídias com `valid=true` cujo arquivo ainda existe em `propagandas/`.
     * Usado no fallback offline (playlist vazia) junto com arquivos soltos na pasta.
     */
    @Synchronized
    fun listValidCachedMediaFiles(): List<CachedMediaFile> {
        val dir = propagandasDir()
        val out = mutableListOf<CachedMediaFile>()
        val keys = metadata.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val obj = metadata.optJSONObject(key) ?: continue
            if (!obj.optBoolean("valid", false)) continue
            val fileName = obj.optString("fileName", "").takeIf { it.isNotBlank() } ?: continue
            val file = File(dir, fileName)
            if (!file.isFile || file.length() <= 0L) continue
            val mediaId = key.toLongOrNull() ?: obj.optLong("mediaId", 0L)
            out += CachedMediaFile(
                mediaId = mediaId,
                file = file,
                mimeType = obj.optString("mimeType", "").takeIf { it.isNotBlank() }
            )
        }
        return out.sortedBy { it.file.name.lowercase() }
    }

    data class CachedMediaFile(
        val mediaId: Long,
        val file: File,
        val mimeType: String?
    )

    @Synchronized
    fun getCurrentCacheSizeBytes(): Long {
        var total = 0L
        val keys = metadataKeysOrEmpty()
        while (keys.hasNext()) {
            val key = keys.next()
            val obj = metadata.optJSONObject(key) ?: continue
            if (obj.optBoolean("valid", false)) {
                total += obj.optLong("size", 0L)
            }
        }
        return total
    }

    /**
     * Limpeza LRU até `<= maxCacheSizeBytes`:
     * 1) Só entradas valid com lastAccessed ≥ 8 dias
     * 2) Se ainda acima do teto, LRU de todas as valid (sem filtro de idade)
     */
    @Synchronized
    fun cleanupIfNeeded() {
        evictUntilUnderMax(respectAgeWindow = true)
        if (getCurrentCacheSizeBytes() > maxCacheSizeBytes) {
            PlayerAdLogger.w(
                "CACHE",
                "Cache ainda acima do teto após janela 8 dias — LRU sob pressão (sem filtro de idade)"
            )
            evictUntilUnderMax(respectAgeWindow = false)
        }
    }

    /**
     * Garante espaço livre no volume para um download de [neededBytes].
     * Corre [cleanupIfNeeded] e, se necessário, LRU agressivo até libertar espaço
     * ou não haver mais candidatos. Retorna false se ainda for insuficiente.
     */
    @Synchronized
    fun ensureDiskSpaceFor(
        neededBytes: Long,
        minFreeAfter: Long = MIN_FREE_BYTES_AFTER_DOWNLOAD,
    ): Boolean {
        val need = neededBytes.coerceAtLeast(0L)
        cleanupIfNeeded()
        val targetFree = need + minFreeAfter
        if (usableSpaceBytes() >= targetFree) return true

        PlayerAdLogger.w(
            "CACHE",
            "Espaço insuficiente para download need=$need free=${usableSpaceBytes()} — LRU agressivo"
        )
        evictUntilUsableSpace(targetFree)

        val free = usableSpaceBytes()
        val ok = free >= need + (minFreeAfter / 2)
        if (!ok) {
            PlayerAdLogger.e(
                "CACHE",
                "Abortar download: espaço livre=$free need=$need minReserve=${minFreeAfter / 2}"
            )
        }
        return ok
    }

    /**
     * Após apagar ficheiros fisicamente (ex.: remote `purge_cache`):
     * marca todas as entradas `valid=false` e persiste (mantém sum_play).
     */
    @Synchronized
    fun invalidateAllEntriesKeepHistory() {
        val keys = metadataKeysOrEmpty().asSequence().toList()
        for (key in keys) {
            val obj = metadata.optJSONObject(key) ?: continue
            obj.put("valid", false)
            metadata.put(key, obj)
        }
        saveMetadataToDisk()
        PlayerAdLogger.i("CACHE", "Metadados invalidados após purge físico (${keys.size} entradas)")
    }

    fun usableSpaceBytes(): Long =
        try {
            propagandasDir().usableSpace
        } catch (_: Exception) {
            0L
        }

    fun maxCacheSizeBytes(): Long = maxCacheSizeBytes

    private fun metadataKeysOrEmpty(): Iterator<String> {
        @Suppress("UNCHECKED_CAST")
        val keys = metadata.keys() as? Iterator<String>
        return keys ?: emptyList<String>().iterator()
    }

    private fun evictUntilUnderMax(respectAgeWindow: Boolean) {
        var currentSize = getCurrentCacheSizeBytes()
        if (currentSize <= maxCacheSizeBytes) return

        val entries = collectValidEntries(respectAgeWindow)
        entries.sortBy { it.lastAccessed }

        for (entry in entries) {
            if (currentSize <= maxCacheSizeBytes) break
            markAsRemoved(entry.mediaId)
            currentSize -= entry.size
        }
    }

    private fun evictUntilUsableSpace(targetFreeBytes: Long) {
        val entries = collectValidEntries(respectAgeWindow = false)
        entries.sortBy { it.lastAccessed }
        for (entry in entries) {
            if (usableSpaceBytes() >= targetFreeBytes) break
            markAsRemoved(entry.mediaId)
        }
    }

    private data class CacheEntry(val mediaId: Long, val lastAccessed: Long, val size: Long)

    private fun collectValidEntries(respectAgeWindow: Boolean): MutableList<CacheEntry> {
        val entries = mutableListOf<CacheEntry>()
        val now = System.currentTimeMillis()
        val keys = metadataKeysOrEmpty()
        while (keys.hasNext()) {
            val key = keys.next()
            val obj = metadata.optJSONObject(key) ?: continue
            if (!obj.optBoolean("valid", false)) continue
            val id = key.toLongOrNull() ?: continue
            val last = obj.optLong("lastAccessed", 0L)
            if (respectAgeWindow && last != 0L && now - last < EIGHT_DAYS_MS) continue
            val size = obj.optLong("size", 0L)
            entries += CacheEntry(id, last, size)
        }
        return entries
    }

    // ---------- Helpers de I/O ----------

    private fun loadMetadataFromDisk(): JSONObject {
        val mf = metadataFile()
        if (!mf.exists()) {
            return JSONObject()
        }
        return try {
            FileInputStream(mf).use { fis ->
                val bytes = fis.readBytes()
                val text = bytes.toString(Charset.forName("UTF-8"))
                JSONObject(text)
            }
        } catch (e: Exception) {
            JSONObject()
        }
    }

    private fun saveMetadataToDisk() {
        try {
            FileOutputStream(metadataFile(), false).use { fos ->
                fos.write(metadata.toString().toByteArray(Charset.forName("UTF-8")))
            }
        } catch (_: Exception) {
            // Em caso de falha de disco, não interromper o player; apenas não persiste metadados.
        }
    }
}

