package com.smartsignage.player.services

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.lifecycle.LifecycleService
import com.smartsignage.player.core.HeartbeatService as CoreHeartbeatService

/**
 * HeartbeatService - Android Service
 * Serviço em background para heartbeat
 */
class HeartbeatService : LifecycleService() {

    private lateinit var coreHeartbeatService: CoreHeartbeatService

    override fun onCreate() {
        super.onCreate()
        // Inicializar será feito quando necessário
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        // Service será iniciado quando necessário
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }

    override fun onDestroy() {
        super.onDestroy()
        // Cleanup será feito automaticamente
    }
}

