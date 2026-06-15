package br.com.smartchannel.playerad.cache

import android.content.Context
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
 * - Controlar LRU com limite de tamanho (ex.: 1000 MB)
 * - Manter histórico de plays por dia (sum_play), mesmo após remoção física
 *
 * Esta implementação é um esqueleto inicial para o Player-AD,
 * espelhando o design documentado em `docs/Player-AD-CACHE-E-METADADOS.md`.
 */
class MediaCacheManager(
    private val context: Context,
    private val maxCacheSizeBytes: Long = 1000L * 1024L * 1024L // 1000 MB
 ) {

    private fun propagandasDir(): File = AppDirs.propagandas(context)

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
        val sumPlay: Map<String, Int>
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
        mimeType: String?
    ) {
        val now = System.currentTimeMillis()
        val key = mediaId.toString()
        val existing = metadata.optJSONObject(key)

        val sumPlay = existing?.optJSONObject("sum_play") ?: JSONObject()

        val obj = JSONObject()
        obj.put("mediaId", mediaId)
        obj.put("fileName", fileName)
        obj.put("size", sizeBytes)
        obj.put("checksum", checksum)
        obj.put("mimeType", mimeType)
        obj.put("downloadedAt", existing?.optLong("downloadedAt", now) ?: now)
        obj.put("lastAccessed", now)
        obj.put("valid", true)
        obj.put("sum_play", sumPlay)

        metadata.put(key, obj)
        saveMetadataToDisk()
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
                sumPlay = sumPlayMap
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
     * Calcula o tamanho atual do cache (somando size de mídias valid=true).
     */
    @Synchronized
    fun getCurrentCacheSizeBytes(): Long {
        var total = 0L
        val keys = metadata.keys()
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
     * Executa limpeza LRU:
     * - Considera apenas mídias valid=true com lastAccessed mais antigo que a janela de 8 dias
     * - Dentro desse conjunto, ordena por lastAccessed (asc)
     * - Remove arquivos e marca valid=false até ficar <= maxCacheSizeBytes
     */
    @Synchronized
    fun cleanupIfNeeded() {
        var currentSize = getCurrentCacheSizeBytes()
        if (currentSize <= maxCacheSizeBytes) return

        // Construir lista de (mediaId, lastAccessed, size) para mídias válidas
        data class Entry(val mediaId: Long, val lastAccessed: Long, val size: Long)

        val entries = mutableListOf<Entry>()
        val now = System.currentTimeMillis()
        val eightDaysMillis = 8L * 24L * 60L * 60L * 1000L

        val keys = metadata.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val obj = metadata.optJSONObject(key) ?: continue
            if (!obj.optBoolean("valid", false)) continue
            val id = key.toLongOrNull() ?: continue
            val last = obj.optLong("lastAccessed", 0L)
            // Só considerar para remoção se não for acessada há mais de 8 dias
            if (last == 0L || now - last < eightDaysMillis) continue
            val size = obj.optLong("size", 0L)
            entries += Entry(id, last, size)
        }

        // Ordenar por lastAccessed (mais antigo primeiro)
        entries.sortBy { it.lastAccessed }

        for (entry in entries) {
            if (currentSize <= maxCacheSizeBytes) break
            markAsRemoved(entry.mediaId)
            currentSize -= entry.size
        }
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

