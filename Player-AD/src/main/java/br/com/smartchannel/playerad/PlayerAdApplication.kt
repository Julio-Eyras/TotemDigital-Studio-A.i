package br.com.smartchannel.playerad

import android.app.Application
import br.com.smartchannel.playerad.cache.MediaCacheManager
import br.com.smartchannel.playerad.config.PlayerConfigLoader
import br.com.smartchannel.playerad.fallback.FallbackSeeder
import br.com.smartchannel.playerad.util.PlayerAdLogger
import br.com.smartchannel.playerad.util.PlayerAdPrefs
import br.com.smartchannel.playerad.util.StorageRootResolver
import br.com.smartchannel.playerad.util.SystemDisplayRotation

class PlayerAdApplication : Application() {

    // Singleton simples para compartilhar o MediaCacheManager
    lateinit var mediaCacheManager: MediaCacheManager
        private set

    override fun onCreate() {
        super.onCreate()
        PlayerAdLogger.init(this)

        // Garante que fallback local exista no root resolvido (config: storage)
        FallbackSeeder(this).seedFromAssetsIfNeeded()

        mediaCacheManager = MediaCacheManager(this)
        mediaCacheManager.init()

        val cfg = PlayerConfigLoader(this).load()
        val prefs = PlayerAdPrefs.prefs(this)
        if (prefs.getBoolean(PlayerAdPrefs.KEY_SU_GRANTED, false)) {
            val rot = SystemDisplayRotation.apply(this, cfg.displayRotation)
            if (rot.rotationApplied) {
                PlayerAdLogger.i(
                    "KIOSK",
                    "Boot: user_rotation=${rot.userRotation} aplicado antes da UI"
                )
            }
        }
        val root = StorageRootResolver.resolve(this, cfg)
        PlayerAdLogger.i(
            "STORAGE",
            "Inicialização — modo=${cfg.storageMode} root=${root.absolutePath}"
        )
    }
}

