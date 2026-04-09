package br.com.smartchannel.smartsignagead

import android.app.Application
import br.com.smartchannel.smartsignagead.fallback.FallbackSeeder
import br.com.smartchannel.smartsignagead.util.SmartSignageAdLogger
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class SmartSignageAdApplication : Application() {
    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val demoSeedDone = CompletableDeferred<Unit>()

    override fun onCreate() {
        super.onCreate()
        SmartSignageAdLogger.init(this)
        // Copia de assets em background (evita ANR). O playback espera por isto para nao ver plano vazio.
        applicationScope.launch(Dispatchers.IO) {
            try {
                FallbackSeeder(this@SmartSignageAdApplication).seedDemoAssetsIfNeeded()
            } catch (_: Exception) {
            } finally {
                if (!demoSeedDone.isCompleted) demoSeedDone.complete(Unit)
            }
        }
        SmartSignageAdLogger.i("APP", "SmartSignage-AD application iniciada")
    }

    suspend fun awaitDemoSeed() {
        demoSeedDone.await()
    }
}
