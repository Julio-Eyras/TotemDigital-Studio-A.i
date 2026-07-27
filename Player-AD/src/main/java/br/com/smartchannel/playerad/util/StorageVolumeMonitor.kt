package br.com.smartchannel.playerad.util

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build

/**
 * Observa montagem/ejeção de volumes (USB/SD) e notifica para
 * re-resolver root, migrar cache e reiniciar o loop do player.
 */
class StorageVolumeMonitor(
    private val onStorageChanged: (action: String) -> Unit,
) {
    @Volatile
    private var registered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val action = intent?.action ?: return
            when (action) {
                Intent.ACTION_MEDIA_EJECT,
                Intent.ACTION_MEDIA_BAD_REMOVAL,
                Intent.ACTION_MEDIA_UNMOUNTED,
                Intent.ACTION_MEDIA_REMOVED,
                Intent.ACTION_MEDIA_MOUNTED,
                Intent.ACTION_MEDIA_CHECKING,
                -> {
                    PlayerAdLogger.w("STORAGE", "Evento de volume: $action")
                    onStorageChanged(action)
                }
            }
        }
    }

    fun register(context: Context) {
        if (registered) return
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_MEDIA_EJECT)
            addAction(Intent.ACTION_MEDIA_BAD_REMOVAL)
            addAction(Intent.ACTION_MEDIA_UNMOUNTED)
            addAction(Intent.ACTION_MEDIA_REMOVED)
            addAction(Intent.ACTION_MEDIA_MOUNTED)
            addAction(Intent.ACTION_MEDIA_CHECKING)
            addDataScheme("file")
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.applicationContext.registerReceiver(
                    receiver,
                    filter,
                    Context.RECEIVER_NOT_EXPORTED,
                )
            } else {
                @Suppress("UnspecifiedRegisterReceiverFlag")
                context.applicationContext.registerReceiver(receiver, filter)
            }
            registered = true
            PlayerAdLogger.i("STORAGE", "StorageVolumeMonitor registado")
        } catch (e: Exception) {
            PlayerAdLogger.e("STORAGE", "Falha a registar StorageVolumeMonitor", e)
        }
    }

    fun unregister(context: Context) {
        if (!registered) return
        try {
            context.applicationContext.unregisterReceiver(receiver)
        } catch (_: Exception) {
            // ignore
        }
        registered = false
    }
}
