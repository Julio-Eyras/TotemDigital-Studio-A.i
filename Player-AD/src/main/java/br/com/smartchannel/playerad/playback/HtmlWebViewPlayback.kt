package br.com.smartchannel.playerad.playback

import android.graphics.Color
import android.webkit.WebSettings
import android.webkit.WebView
import java.io.File

/**
 * Configuração e carga de mídia HTML (Publicar em Tela — animações e cardápio ao vivo).
 * Usa [baseUrl] do servidor para que fetch('/api/...') no HTML funcione também em cache local.
 */
object HtmlWebViewPlayback {

    fun configure(webView: WebView) {
        webView.setBackgroundColor(Color.BLACK)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            @Suppress("DEPRECATION")
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }
    }

    fun load(
        webView: WebView,
        serverBaseUrl: String,
        httpUrl: String,
        cachedHtmlFile: File?
    ) {
        val base = serverBaseUrl.trimEnd('/') + "/"
        when {
            cachedHtmlFile != null && cachedHtmlFile.exists() -> {
                val html = cachedHtmlFile.readText()
                webView.loadDataWithBaseURL(base, html, "text/html", "UTF-8", null)
            }
            else -> webView.loadUrl(httpUrl)
        }
    }

    fun stop(webView: WebView) {
        webView.stopLoading()
        webView.loadUrl("about:blank")
        webView.visibility = android.view.View.GONE
    }

    fun isHtmlMediaType(mediaType: String?, url: String): Boolean {
        val lower = mediaType?.lowercase()?.trim().orEmpty()
        if (lower in HTML_TYPES) return true
        if (lower.startsWith("text/html")) return true
        return url.contains(".html", ignoreCase = true)
    }

    private val HTML_TYPES = setOf("html", "web", "widget", "iframe")

}
