package br.com.smartchannel.smartsignagead.util

import android.app.Application
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object SmartSignageAdLogger {
    private const val LOGCAT_TAG = "SmartSignage-AD"
    private const val LOG_FILE_NAME = "smartsignage-ad.log"
    private const val MAX_BYTES = 256 * 1024L

    @Volatile
    private var app: Application? = null

    fun init(application: Application) {
        app = application
    }

    private fun ts(): String = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US).format(Date())

    @Synchronized
    fun i(category: String, message: String) = append("I", category, message)

    @Synchronized
    fun w(category: String, message: String) = append("W", category, message)

    @Synchronized
    fun e(category: String, message: String, t: Throwable? = null) {
        val full = if (t == null) message else "$message | ${t.javaClass.simpleName}: ${t.message}"
        append("E", category, full)
    }

    @Synchronized
    private fun append(level: String, category: String, message: String) {
        val line = "${ts()} [$level] [$category] $message"
        when (level) {
            "E" -> Log.e(LOGCAT_TAG, line)
            "W" -> Log.w(LOGCAT_TAG, line)
            else -> Log.i(LOGCAT_TAG, line)
        }
        val ctx = app ?: return
        try {
            val f = File(ctx.filesDir, LOG_FILE_NAME)
            f.appendText(line + "\n", Charsets.UTF_8)
            trimIfNeeded(f)
        } catch (_: Exception) {}
    }

    private fun trimIfNeeded(file: File) {
        if (file.length() <= MAX_BYTES) return
        val keep = file.readLines().takeLast(1200)
        file.writeText(keep.joinToString("\n") + "\n", Charsets.UTF_8)
    }
}
