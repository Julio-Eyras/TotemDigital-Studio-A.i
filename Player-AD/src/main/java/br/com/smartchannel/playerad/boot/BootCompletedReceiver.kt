package br.com.smartchannel.playerad.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import br.com.smartchannel.playerad.ui.MainActivity
import br.com.smartchannel.playerad.util.KioskEscape

/**
 * Receiver simples para iniciar o Player-AD após o boot do dispositivo.
 *
 * Em Android TV, isso ajuda a simular o comportamento de "app de sistema":
 * ao ligar a TV, o player é aberto automaticamente.
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            KioskEscape.setHomeAliasEnabled(context, enabled = true)
            KioskEscape.restorePreferredHome(context)
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            context.startActivity(launchIntent)
        }
    }
}

