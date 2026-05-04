package br.com.smartchannel.smartsignagead.playback

import android.content.Context
import android.net.Uri
import android.view.View
import android.widget.ImageView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import br.com.smartchannel.smartsignagead.R
import br.com.smartchannel.smartsignagead.SmartSignageAdApplication
import br.com.smartchannel.smartsignagead.api.DispatcherApiClient
import br.com.smartchannel.smartsignagead.api.PlayerEventsClient
import br.com.smartchannel.smartsignagead.config.AppConfig
import br.com.smartchannel.smartsignagead.util.AppDirs
import br.com.smartchannel.smartsignagead.util.SmartSignageAdLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.coroutines.resume

class PlayerController(
    private val context: Context,
    private val config: AppConfig,
    private val apiClient: DispatcherApiClient,
    private val exoPlayer: ExoPlayer,
    private val imageView: ImageView,
    private val onIdleStatus: ((String?) -> Unit)? = null
) {
    private enum class PlanSource { ONLINE, PERSISTED, FALLBACK_LOCAL }

    data class DispatchMediaItem(
        val mediaId: Long,
        val url: String,
        val duration: Long?,
        val mediaType: String?,
        val cacheBucket: String,
        val metadata: JSONObject?
    )

    data class DispatchPlan(
        val playlistId: Long,
        val playlistName: String,
        val mediaItems: List<DispatchMediaItem>,
        val campaignId: Long?
    )

    private lateinit var eventsClient: PlayerEventsClient
    private val emptyPlan = DispatchPlan(
        playlistId = 0L,
        playlistName = "Empty",
        mediaItems = emptyList(),
        campaignId = null
    )

    suspend fun start() {
        eventsClient = PlayerEventsClient(
            baseUrl = apiClient.baseUrl,
            uin = apiClient.uin,
            deviceId = apiClient.deviceId,
            dispatcher = apiClient
        )

        awaitDemoSeedIfApplicable()
        logCachePolicyDiagnostics()

        var token = apiClient.cachedToken() ?: ""
        val initialLocal = buildFallbackPlan()
        val initial = if (initialLocal != null && initialLocal.mediaItems.isNotEmpty()) {
            SmartSignageAdLogger.i(
                "PLAYBACK",
                "Arranque imediato local (vinhetas -> propagandas ${config.fallbackPropagandasPerVinheta}:1)"
            )
            initialLocal to PlanSource.FALLBACK_LOCAL
        } else {
            val persisted = loadDispatchPlanFromDisk()?.let { parseDispatchPlan(it) }
            if (persisted != null && persisted.mediaItems.isNotEmpty()) {
                SmartSignageAdLogger.i("PLAYBACK", "Arranque com DispatchPlan persistido")
                persisted to PlanSource.PERSISTED
            } else {
                // Último recurso: tentar online quando não há mídia local nem plano persistido.
                try {
                    token = apiClient.heartbeat()
                    val json = apiClient.getDispatchPlan(token)
                    saveDispatchPlanToDisk(json)
                    parseDispatchPlan(json) to PlanSource.ONLINE
                } catch (e: Exception) {
                    SmartSignageAdLogger.w(
                        "PLAYBACK",
                        "Sem local/persistido e online indisponivel no arranque: ${e.message}"
                    )
                    emptyPlan to PlanSource.FALLBACK_LOCAL
                }
            }
        }

        val (plan, source) = initial
        updatePlanSource(source)
        synchronizeManagedMediaCache(plan)
        playLoop(plan, token, source)
    }

    private fun parseDispatchPlan(json: JSONObject): DispatchPlan {
        val plan = json.optJSONObject("plan") ?: JSONObject()
        val itemsArray = plan.optJSONArray("mediaItems") ?: JSONArray()
        val items = mutableListOf<DispatchMediaItem>()
        for (i in 0 until itemsArray.length()) {
            val obj = itemsArray.optJSONObject(i) ?: continue
            val mediaId = obj.optLong("mediaId", -1L)
            val rawUrl = obj.optString("url", "")
            if (mediaId <= 0 || rawUrl.isBlank()) continue
            val metadata = obj.optJSONObject("metadata")
            val bucketRaw = obj.optString("cacheBucket")
                .ifBlank { obj.optString("bucket") }
                .ifBlank { metadata?.optString("cacheBucket", "").orEmpty() }
            val cacheBucket = if (bucketRaw.equals("vinhetas", true) || bucketRaw.equals("vinheta", true)) {
                "vinhetas"
            } else {
                if (bucketRaw.isBlank()) {
                    SmartSignageAdLogger.w(
                        "MEDIA_CACHE",
                        "mediaId=$mediaId sem cacheBucket no payload; usando bucket padrao 'propagandas'"
                    )
                }
                "propagandas"
            }
            items += DispatchMediaItem(
                mediaId = mediaId,
                url = apiClient.resolveUrl(rawUrl),
                duration = obj.optLong("duration", 0L).takeIf { it > 0L },
                mediaType = obj.optString("mediaType", "").takeIf { it.isNotBlank() },
                cacheBucket = cacheBucket,
                metadata = metadata
            )
        }
        return DispatchPlan(
            playlistId = plan.optLong("playlistId", 0L),
            playlistName = plan.optString("playlistName", "DispatchPlan"),
            mediaItems = items,
            campaignId = plan.optLong("campaignId", 0L).takeIf { it > 0L }
        )
    }

    private suspend fun playLoop(initialPlan: DispatchPlan, initialToken: String, initialSource: PlanSource) {
        var plan = initialPlan
        var token = initialToken
        var source = initialSource
        var idx = 0
        var completedCycle = false
        while (true) {
            if (plan.mediaItems.isEmpty()) {
                onIdleStatus?.invoke(buildWaitingMediaMessage())
                val persisted = loadDispatchPlanFromDisk()?.let { parseDispatchPlan(it) }
                if (persisted != null && persisted.mediaItems.isNotEmpty()) {
                    plan = persisted
                    source = PlanSource.PERSISTED
                    updatePlanSource(source)
                    synchronizeManagedMediaCache(plan)
                    idx = 0
                    completedCycle = false
                    continue
                }
                val fallback = buildFallbackPlan()
                if (fallback == null || fallback.mediaItems.isEmpty()) {
                    SmartSignageAdLogger.w("PLAYBACK", "Sem midia local ainda; aguardando e tentando novamente...")
                    delay(3000L)
                    continue
                }
                plan = fallback
                source = PlanSource.FALLBACK_LOCAL
                updatePlanSource(source)
                idx = 0
                completedCycle = false
                continue
            }

            onIdleStatus?.invoke(null)

            if (idx == 0 && completedCycle) {
                // Enquanto estiver local, prioriza trocar para plano persistido assim que existir.
                if (source == PlanSource.FALLBACK_LOCAL) {
                    val persisted = loadDispatchPlanFromDisk()?.let { parseDispatchPlan(it) }
                    if (persisted != null && persisted.mediaItems.isNotEmpty()) {
                        plan = persisted
                        source = PlanSource.PERSISTED
                        updatePlanSource(source)
                        synchronizeManagedMediaCache(plan)
                    }
                }
                try {
                    token = apiClient.heartbeat()
                    val json = apiClient.getDispatchPlan(token)
                    saveDispatchPlanToDisk(json)
                    val next = parseDispatchPlan(json)
                    if (next.mediaItems.isNotEmpty()) {
                        plan = next
                        source = PlanSource.ONLINE
                        updatePlanSource(source)
                        synchronizeManagedMediaCache(plan)
                    }
                } catch (_: Exception) { }
            }

            val item = plan.mediaItems[idx]
            token = playItem(plan, item, token)
            idx = (idx + 1) % plan.mediaItems.size
            if (idx == 0) completedCycle = true
        }
    }

    private suspend fun awaitDemoSeedIfApplicable() {
        val app = context.applicationContext as? SmartSignageAdApplication ?: return
        app.awaitDemoSeed()
    }

    /** Texto sem String.format nos paths (evita erro se houver % no caminho). So ASCII nas labels para TVs com fonte fraca. */
    private fun buildWaitingMediaMessage(): String = buildString {
        appendLine(context.getString(R.string.playback_waiting_intro))
        appendLine()
        appendLine(context.getString(R.string.playback_waiting_internal_label))
        appendLine(AppDirs.demoPropagandas(context).absolutePath)
        appendLine(AppDirs.demoVinhetas(context).absolutePath)
        appendLine()
        appendLine(context.getString(R.string.playback_waiting_usb_label))
        appendLine(context.getString(R.string.playback_waiting_usb_paths))
        appendLine()
        appendLine(context.getString(R.string.playback_waiting_footer))
    }

    private suspend fun playItem(plan: DispatchPlan, item: DispatchMediaItem, token: String): String {
        var tkn = token
        val mediaType = item.mediaType?.lowercase() ?: "video"
        val isImage = mediaType.contains("image")
        val playbackUrl = resolvePlaybackUrl(item)
        if (isImage) {
            if (!config.acceptImagesInPlaylist) return tkn
            exoPlayer.stop()
            imageView.visibility = View.VISIBLE
            imageView.setImageURI(Uri.parse(playbackUrl))
            tkn = eventsClient.sendEvent(
                token = tkn,
                eventType = "image_display",
                mediaId = item.mediaId,
                playlistId = plan.playlistId,
                campaignId = plan.campaignId,
                durationSeconds = null,
                completed = null,
                metadata = emptyMap()
            )
            val exposureSec = item.duration?.takeIf { it > 0L }
            val imageHoldSeconds = exposureSec ?: config.imageDurationSeconds.toLong()
            delay(imageHoldSeconds * 1000L)
            imageView.visibility = View.GONE
            return tkn
        }

        imageView.visibility = View.GONE
        tkn = eventsClient.sendEvent(
            token = tkn,
            eventType = "video_playback_start",
            mediaId = item.mediaId,
            playlistId = plan.playlistId,
            campaignId = plan.campaignId,
            durationSeconds = null,
            completed = null,
            metadata = emptyMap()
        )

        exoPlayer.setMediaItem(MediaItem.fromUri(Uri.parse(playbackUrl)))
        exoPlayer.prepare()
        exoPlayer.play()
        val playedMs = waitForPlaybackEnd()

        tkn = eventsClient.sendEvent(
            token = tkn,
            eventType = "video_playback_end",
            mediaId = item.mediaId,
            playlistId = plan.playlistId,
            campaignId = plan.campaignId,
            durationSeconds = (playedMs / 1000L).coerceAtLeast(0L),
            completed = true,
            metadata = emptyMap()
        )
        return tkn
    }

    private suspend fun buildFallbackPlan(): DispatchPlan? = withContext(Dispatchers.IO) {
        val vins = collectFallbackUrls("vinhetas")
        val ads = collectFallbackUrls("propagandas")
        if (ads.isEmpty() && vins.isEmpty()) return@withContext null
        // Se só existir uma pasta no USB, ainda assim monta plano (antes exigia as duas e falhava sempre).
        val adsEff = if (ads.isNotEmpty()) ads else listOf(vins.first())
        val vinsEff = if (vins.isNotEmpty()) vins else listOf(ads.first())
        if (vins.isEmpty() && ads.isNotEmpty()) {
            SmartSignageAdLogger.w("FALLBACK", "Sem ficheiros em vinhetas/ no USB; usando primeira propaganda como vinheta.")
        }
        if (ads.isEmpty() && vins.isNotEmpty()) {
            SmartSignageAdLogger.w("FALLBACK", "Sem ficheiros em propagandas/ no USB; usando vinheta também como faixa de propaganda.")
        }
        val n = config.fallbackPropagandasPerVinheta.coerceAtLeast(1)
        val items = mutableListOf<DispatchMediaItem>()
        // Ordem de arranque exigida: 1 vinheta -> N propagandas (intercalado).
        val vinheta = vinsEff[0]
        items += DispatchMediaItem(
            mediaId = 0L,
            url = vinheta,
            duration = null,
            mediaType = if (isImageFile(vinheta)) "image" else "video",
            cacheBucket = "vinhetas",
            metadata = null
        )
        for (k in 0 until n) {
            val ad = adsEff[k % adsEff.size]
            items += DispatchMediaItem(
                mediaId = 0L,
                url = ad,
                duration = null,
                mediaType = if (isImageFile(ad)) "image" else "video",
                cacheBucket = "propagandas",
                metadata = null
            )
        }
        DispatchPlan(
            playlistId = 0L,
            playlistName = "Fallback local (vinheta->${n} propagandas)",
            mediaItems = items,
            campaignId = null
        )
    }

    private fun collectFallbackUrls(folderName: String): List<String> {
        val result = mutableListOf<String>()
        val externalDirs = AppDirs.externalMediaDirs(context, folderName)
        for (dir in externalDirs) {
            if (dir.exists() && dir.isDirectory && dir.listFiles() == null) {
                SmartSignageAdLogger.w(
                    "FALLBACK",
                    "Nao foi possivel listar (permissao ou sistema): ${dir.absolutePath}"
                )
            }
            val files = listLocalMediaFiles(dir)
            if (files.isNotEmpty()) {
                SmartSignageAdLogger.i(
                    "FALLBACK",
                    "Diretorio externo encontrado ($folderName): ${dir.absolutePath} com ${files.size} item(ns)"
                )
            }
            result += files.map { it.toURI().toString() }
        }
        if (result.isNotEmpty()) return result

        // Sem mídia externa: usar demo interna do app
        val demoDir = when (folderName) {
            "vinhetas" -> AppDirs.demoVinhetas(context)
            else -> AppDirs.demoPropagandas(context)
        }
        val demoFiles = listLocalMediaFiles(demoDir)
        if (demoFiles.isNotEmpty()) {
            SmartSignageAdLogger.w(
                "FALLBACK",
                "Sem midia externa para $folderName; usando demo interna (${demoDir.absolutePath})"
            )
            result += demoFiles.map { it.toURI().toString() }
        }
        return result
    }

    private fun listLocalMediaFiles(dir: File): List<File> {
        if (!dir.exists() || !dir.isDirectory) return emptyList()
        return dir.listFiles { f ->
            f.isFile &&
                (f.name.endsWith(".mp4", true) ||
                    f.name.endsWith(".webm", true) ||
                    f.name.endsWith(".mov", true) ||
                    f.name.endsWith(".jpg", true) ||
                    f.name.endsWith(".jpeg", true) ||
                    f.name.endsWith(".png", true))
        }?.sortedBy { it.name.lowercase() } ?: emptyList()
    }

    private fun isImageFile(url: String): Boolean {
        val low = url.lowercase()
        return low.endsWith(".jpg") || low.endsWith(".jpeg") || low.endsWith(".png")
    }

    private suspend fun resolvePlaybackUrl(item: DispatchMediaItem): String = withContext(Dispatchers.IO) {
        if (item.url.startsWith("file://", true)) return@withContext item.url
        val cached = findCachedMediaFile(item)
        if (cached != null) return@withContext cached.toURI().toString()
        val downloaded = downloadMediaToCache(item)
        downloaded?.toURI()?.toString() ?: item.url
    }

    private fun findCachedMediaFile(item: DispatchMediaItem): File? {
        val targetDir = resolveMediaCacheDir(item) ?: return null
        val hash = shortHash(item.url)
        val prefix = "m${item.mediaId}_${hash}"
        val files = targetDir.listFiles() ?: return null
        return files.firstOrNull { it.isFile && it.name.startsWith(prefix) && it.length() > 0L }
    }

    private fun resolveMediaCacheDir(item: DispatchMediaItem): File? {
        val folder = item.cacheBucket
        val external = AppDirs.preferredExternalWritableDir(context, folder)
        if (external != null) return external
        val internal = File(AppDirs.root(context), folder)
        if (!internal.exists()) internal.mkdirs()
        return internal.takeIf { it.exists() && it.isDirectory && it.canWrite() }
    }

    private fun downloadMediaToCache(item: DispatchMediaItem): File? {
        return try {
            val targetDir = resolveMediaCacheDir(item) ?: return null
            if (!targetDir.exists()) targetDir.mkdirs()
            val targetName = managedFileName(item)
            val target = File(targetDir, targetName)
            if (target.exists() && target.length() > 0L) return target

            // Regra: mediaId igual com URL diferente substitui imediatamente.
            targetDir.listFiles()
                ?.filter { it.isFile && it.name.startsWith("m${item.mediaId}_") && it.name != target.name }
                ?.forEach { runCatching { it.delete() } }

            val tmp = File(targetDir, "${target.name}.tmp")
            val conn = (URL(item.url).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15000
                readTimeout = 30000
                instanceFollowRedirects = true
            }
            val code = try { conn.responseCode } catch (_: Exception) { -1 }
            if (code !in 200..299) {
                SmartSignageAdLogger.w("MEDIA_CACHE", "Falha download mediaId=${item.mediaId}, code=$code, url=${item.url}")
                return null
            }
            conn.inputStream.use { input ->
                FileOutputStream(tmp).use { output ->
                    input.copyTo(output)
                }
            }
            if (!tmp.exists() || tmp.length() <= 0L) {
                tmp.delete()
                return null
            }
            if (!tmp.renameTo(target)) {
                tmp.copyTo(target, overwrite = true)
                tmp.delete()
            }
            SmartSignageAdLogger.i("MEDIA_CACHE", "Media cacheada mediaId=${item.mediaId} em ${target.absolutePath}")
            target
        } catch (e: Exception) {
            SmartSignageAdLogger.w("MEDIA_CACHE", "Erro ao cachear mediaId=${item.mediaId}: ${e.message}")
            null
        }
    }

    private suspend fun synchronizeManagedMediaCache(plan: DispatchPlan) = withContext(Dispatchers.IO) {
        val folders = listOf("propagandas", "vinhetas")
        val expectedByFolder = folders.associateWith { linkedSetOf<String>() }.toMutableMap()
        for (item in plan.mediaItems) {
            if (item.mediaId <= 0L) continue
            if (item.url.startsWith("file://", true)) continue
            val folder = if (item.cacheBucket == "vinhetas") "vinhetas" else "propagandas"
            expectedByFolder[folder]?.add(managedFileName(item))
        }
        for (folder in folders) {
            val targets = listOfNotNull(
                AppDirs.preferredExternalWritableDir(context, folder),
                File(AppDirs.root(context), folder)
            ).distinctBy { it.absolutePath }
            for (dir in targets) {
                cleanupManagedMediaFiles(dir, expectedByFolder[folder].orEmpty())
            }
        }
    }

    private fun cleanupManagedMediaFiles(dir: File, keepNames: Set<String>) {
        if (!dir.exists() || !dir.isDirectory) return
        val files = dir.listFiles() ?: return
        val managedNameRegex = Regex("^m\\d+_[0-9a-f]{12}\\.[A-Za-z0-9]+$")
        for (f in files) {
            if (!f.isFile) continue
            if (!managedNameRegex.matches(f.name)) continue
            if (f.name in keepNames) continue
            if (runCatching { f.delete() }.getOrDefault(false)) {
                SmartSignageAdLogger.i("MEDIA_CACHE", "Removido cache obsoleto: ${f.absolutePath}")
            }
        }
    }

    private fun extensionFor(item: DispatchMediaItem): String {
        val cleanUrl = item.url.substringBefore("?").substringBefore("#")
        val fromUrl = cleanUrl.substringAfterLast('.', "").lowercase()
        if (fromUrl in setOf("mp4", "webm", "mov", "jpg", "jpeg", "png")) return ".$fromUrl"
        return if ((item.mediaType ?: "").lowercase().contains("image")) ".jpg" else ".mp4"
    }

    private fun managedFileName(item: DispatchMediaItem): String {
        val hash = shortHash(item.url)
        val ext = extensionFor(item)
        return "m${item.mediaId}_${hash}$ext"
    }

    private fun shortHash(value: String): String {
        val digest = MessageDigest.getInstance("SHA-1").digest(value.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }.take(12)
    }

    private suspend fun saveDispatchPlanToDisk(json: JSONObject) = withContext(Dispatchers.IO) {
        try {
            val target = resolveCacheFile("last-dispatch-plan.json")
            if (target == null) {
                SmartSignageAdLogger.e(
                    "DISPATCH",
                    "Cache interno acima do limite (${config.internalCacheLimitPercent}%) e sem storage externo gravavel para DispatchPlan",
                    null
                )
                return@withContext
            }
            target.parentFile?.mkdirs()
            target.writeText(json.toString(), Charsets.UTF_8)
        } catch (e: Exception) {
            SmartSignageAdLogger.e("DISPATCH", "Falha ao persistir DispatchPlan", e)
        }
    }

    private suspend fun loadDispatchPlanFromDisk(): JSONObject? = withContext(Dispatchers.IO) {
        try {
            val candidates = cacheReadCandidates("last-dispatch-plan.json")
            for (f in candidates) {
                if (!f.exists()) continue
                val raw = f.readText(Charsets.UTF_8)
                if (raw.isBlank()) continue
                return@withContext JSONObject(raw)
            }
            null
        } catch (e: Exception) {
            SmartSignageAdLogger.e("DISPATCH", "Falha ao ler DispatchPlan persistido", e)
            null
        }
    }

    private suspend fun updatePlanSource(source: PlanSource) = withContext(Dispatchers.IO) {
        try {
            val target = resolveCacheFile("current-plan-source.txt")
            if (target == null) {
                SmartSignageAdLogger.e(
                    "PLAYBACK",
                    "Cache interno acima do limite (${config.internalCacheLimitPercent}%) e sem storage externo gravavel para source file",
                    null
                )
                return@withContext
            }
            target.parentFile?.mkdirs()
            target.writeText(source.name, Charsets.UTF_8)
            SmartSignageAdLogger.i("PLAYBACK", "Fonte do plano: ${source.name}")
        } catch (e: Exception) {
            SmartSignageAdLogger.e("PLAYBACK", "Falha ao persistir fonte do plano", e)
        }
    }

    private fun cacheReadCandidates(fileName: String): List<File> {
        val internal = File(AppDirs.root(context), "cache/$fileName")
        val external = AppDirs.preferredExternalWritableDir(context, "cache")?.let { File(it, fileName) }
        return listOfNotNull(external, internal)
    }

    private fun resolveCacheFile(fileName: String): File? {
        val usage = AppDirs.rootUsagePercent(context)
        val limit = config.internalCacheLimitPercent.coerceIn(5, 95)
        return if (usage >= limit) {
            val externalCacheDir = AppDirs.preferredExternalWritableDir(context, "cache")
            if (externalCacheDir == null) {
                SmartSignageAdLogger.w(
                    "CACHE",
                    "Uso interno ${"%.2f".format(usage)}% >= limite ${limit}% e sem SD/USB gravavel"
                )
                null
            } else {
                SmartSignageAdLogger.i(
                    "CACHE",
                    "Uso interno ${"%.2f".format(usage)}% >= limite ${limit}%: usando cache externo ${externalCacheDir.absolutePath}"
                )
                File(externalCacheDir, fileName)
            }
        } else {
            File(AppDirs.root(context), "cache/$fileName")
        }
    }

    private suspend fun logCachePolicyDiagnostics() = withContext(Dispatchers.IO) {
        val usage = AppDirs.rootUsagePercent(context)
        val limit = config.internalCacheLimitPercent.coerceIn(5, 95)
        val externalCacheDir = AppDirs.preferredExternalWritableDir(context, "cache")
        val selected = resolveCacheFile("diagnostic-probe.tmp")
        SmartSignageAdLogger.i(
            "CACHE",
            "Politica cache: uso_interno=${"%.2f".format(usage)}%, limite=${limit}%, externo_disponivel=${externalCacheDir?.absolutePath ?: "-"}, destino_selecionado=${selected?.absolutePath ?: "NONE"}"
        )
    }

    private suspend fun waitForPlaybackEnd(): Long = suspendCancellableCoroutine { cont ->
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED) {
                    exoPlayer.removeListener(this)
                    cont.resume(exoPlayer.currentPosition)
                }
            }
            override fun onPlayerError(error: PlaybackException) {
                exoPlayer.removeListener(this)
                cont.resume(exoPlayer.currentPosition)
            }
        }
        exoPlayer.addListener(listener)
        cont.invokeOnCancellation { exoPlayer.removeListener(listener) }
    }
}
