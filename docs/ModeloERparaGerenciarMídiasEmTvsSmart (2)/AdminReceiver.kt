package com.smartotem.player

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast

class AdminReceiver : DeviceAdminReceiver() {
    private val TAG = "AdminReceiver"

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.d(TAG, "Administrador do dispositivo ativado.")
        Toast.makeText(context, "SmarTotem Player: Administrador do dispositivo ativado.", Toast.LENGTH_SHORT).show()
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.d(TAG, "Administrador do dispositivo desativado.")
        Toast.makeText(context, "SmarTotem Player: Administrador do dispositivo desativado.", Toast.LENGTH_SHORT).show()
    }

    override fun onLockTaskModeEntering(context: Context, intent: Intent, pkg: String) {
        super.onLockTaskModeEntering(context, intent, pkg)
        Log.d(TAG, "Entrando no modo Lock Task para: $pkg")
        Toast.makeText(context, "SmarTotem Player: Entrando no modo Kiosk.", Toast.LENGTH_SHORT).show()
    }

    override fun onLockTaskModeExiting(context: Context, intent: Intent) {
        super.onLockTaskModeExiting(context, intent)
        Log.d(TAG, "Saindo do modo Lock Task.")
        Toast.makeText(context, "SmarTotem Player: Saindo do modo Kiosk.", Toast.LENGTH_SHORT).show()
    }
}
