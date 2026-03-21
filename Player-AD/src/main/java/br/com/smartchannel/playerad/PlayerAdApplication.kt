package br.com.smartchannel.playerad

import android.app.Application
import br.com.smartchannel.playerad.cache.MediaCacheManager
import br.com.smartchannel.playerad.fallback.FallbackSeeder
import br.com.smartchannel.playerad.util.PlayerAdLogger

class PlayerAdApplication : Application() {

    // Singleton simples para compartilhar o MediaCacheManager
    lateinit var mediaCacheManager: MediaCacheManager
        private set

    override fun onCreate() {
        super.onCreate()
        PlayerAdLogger.init(this)

        // Garante que fallback local exista em <externalFilesDir>/propagandas e /vinhetas
        FallbackSeeder(this).seedFromAssetsIfNeeded()

        mediaCacheManager = MediaCacheManager(this)
        mediaCacheManager.init()
    }
}

