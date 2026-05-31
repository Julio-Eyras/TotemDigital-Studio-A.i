package br.com.smartchannel.playerad.ota

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.content.FileProvider
import br.com.smartchannel.playerad.api.DispatcherApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Download e instalação de APK OTA (Player-AD Android).
 * Atualização obrigatória: apenas aviso — não bloqueia playback.
 */
class OtaUpdateCoordinator(
    private val context: Context,
    private val apiClient: DispatcherApiClient,
    private val appVersion: String
) {
    data class OtaPackage(
        val id: Int,
        val version: String,
        val checksum: String,
        val downloadUrl: String,
        val isMandatory: Boolean
    )

    private val tag = "Player-AD-OTA"
    private var lastHandledVersion: String? = null

    suspend fun handleFromHeartbeat(otaJson: JSONObject?) = withContext(Dispatchers.IO) {
        if (otaJson == null) return@withContext
        val version = otaJson.optString("version", "").trim()
        if (version.isBlank() || version == appVersion) return@withContext
        if (version == lastHandledVersion) return@withContext

        val pkg = OtaPackage(
            id = otaJson.optInt("id", 0),
            version = version,
            checksum = otaJson.optString("checksum", ""),
            downloadUrl = otaJson.optString("downloadUrl", ""),
            isMandatory = otaJson.optBoolean("isMandatory", false)
        )
        if (pkg.downloadUrl.isBlank()) return@withContext

        try {
            report("downloading", pkg.version)
            val apkFile = downloadApk(pkg)
            if (!verifyChecksum(apkFile, pkg.checksum)) {
                report("failed", pkg.version, "Checksum inválido")
                return@withContext
            }
            report("installing", pkg.version)
            promptInstall(apkFile)
            if (pkg.isMandatory) {
                Log.i(tag, "Atualização obrigatória disponível ($version) — aviso apenas, playback continua")
            }
            lastHandledVersion = version
        } catch (e: Exception) {
            Log.e(tag, "Falha OTA ${pkg.version}", e)
            report("failed", pkg.version, e.message)
        }
    }

    private suspend fun downloadApk(pkg: OtaPackage): File {
        val dir = File(context.cacheDir, "ota").apply { mkdirs() }
        val out = File(dir, "update-${pkg.id}-${pkg.version}.apk")
        if (out.exists() && out.length() > 0) return out

        val base = apiClient.baseUrl.trimEnd('/')
        val token = apiClient.cachedToken() ?: throw IllegalStateException("Token ausente para download OTA")
        val path = pkg.downloadUrl.trim()
        val url = buildString {
            if (path.startsWith("http")) append(path) else append(base).append(path)
            append(if (this.contains("?")) "&" else "?")
            append("uin=").append(java.net.URLEncoder.encode(apiClient.uin, "UTF-8"))
            append("&token=").append(java.net.URLEncoder.encode(token, "UTF-8"))
        }
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 30000
            readTimeout = 120000
        }
        conn.inputStream.use { input ->
            FileOutputStream(out).use { output -> input.copyTo(output) }
        }
        return out
    }

    private fun verifyChecksum(file: File, expected: String): Boolean {
        if (expected.isBlank()) return true
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(8192)
            var read: Int
            while (input.read(buf).also { read = it } > 0) {
                digest.update(buf, 0, read)
            }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        return actual.equals(expected, ignoreCase = true)
    }

    private fun promptInstall(apk: File) {
        val uri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            apk
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(intent)
    }

    private suspend fun report(status: String, availableVersion: String, error: String? = null) {
        apiClient.reportOtaStatus(
            currentVersion = appVersion,
            updateStatus = status,
            availableVersion = availableVersion,
            error = error
        )
    }
}
