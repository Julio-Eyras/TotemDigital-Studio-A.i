package com.smartsignage.player.services

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log

/**
 * HeartbeatService - Android Service (stub)
 * Heartbeat ativo é feito pelo [com.smartsignage.player.core.HeartbeatService] no ViewModel.
 */
class HeartbeatService : Service() {

    companion object {
        private const val TAG = "HeartbeatService"
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "onCreate")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "onDestroy")
    }
}
