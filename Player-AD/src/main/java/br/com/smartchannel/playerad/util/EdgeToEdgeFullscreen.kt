package br.com.smartchannel.playerad.util

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import br.com.smartchannel.playerad.R

/**
 * Força a Activity a desenhar no framebuffer completo (sem reservar espaço às barras).
 * Necessário para o viewport em retrato ser 720×1280 (9:16) nestas TV boxes.
 */
object EdgeToEdgeFullscreen {

    fun apply(activity: Activity) {
        val window = activity.window
        WindowCompat.setDecorFitsSystemWindows(window, false)

        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isNavigationBarContrastEnforced = false
            window.isStatusBarContrastEnforced = false
        }

        @Suppress("DEPRECATION")
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
        // NÃO usar FLAG_LAYOUT_NO_LIMITS nestas TV boxes — em Allwinner pode
        // deslocar a janela e deixar o painel todo preto.

        try {
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } catch (_: Exception) {
            // fallback flags abaixo
        }

        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY

        // Evita o contentHost rodado ser cortado se a janela ainda reportar 672 px.
        (activity.findViewById<ViewGroup>(R.id.root))?.let { root ->
            root.clipChildren = false
            root.clipToPadding = false
        }
        (activity.findViewById<ViewGroup>(R.id.contentHost))?.let { host ->
            host.clipChildren = false
            host.clipToPadding = false
        }
        (activity.findViewById<ViewGroup>(android.R.id.content))?.let { content ->
            content.clipChildren = false
            content.clipToPadding = false
        }
    }
}
