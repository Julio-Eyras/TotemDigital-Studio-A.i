package br.com.smartchannel.playeradmon

import android.app.Application
import br.com.smartchannel.playeradmon.data.AppContainer

class PlayerAdMonApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
