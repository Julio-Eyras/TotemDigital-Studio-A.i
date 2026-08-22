package br.com.smartchannel.playeradmon.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import br.com.smartchannel.playeradmon.BuildConfig
import br.com.smartchannel.playeradmon.data.AppContainer
import br.com.smartchannel.playeradmon.data.telemetry.PlaybackConnectionStatus
import br.com.smartchannel.playeradmon.data.telemetry.PlaybackTelemetryService
import br.com.smartchannel.playeradmon.model.AuthUser
import br.com.smartchannel.playeradmon.model.Totem
import br.com.smartchannel.playeradmon.model.TotemPlaybackState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class AppViewModelFactory(
    private val container: AppContainer,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(AuthViewModel::class.java) ->
                AuthViewModel(container) as T
            modelClass.isAssignableFrom(TotemListViewModel::class.java) ->
                TotemListViewModel(container) as T
            modelClass.isAssignableFrom(SettingsViewModel::class.java) ->
                SettingsViewModel(container) as T
            else -> throw IllegalArgumentException("Unknown ViewModel: ${modelClass.name}")
        }
    }

    fun forMonitor(totemId: Int): ViewModelProvider.Factory =
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                if (modelClass.isAssignableFrom(MonitorViewModel::class.java)) {
                    return MonitorViewModel(container, totemId) as T
                }
                throw IllegalArgumentException("Unknown ViewModel: ${modelClass.name}")
            }
        }
}

class AuthViewModel(private val container: AppContainer) : ViewModel() {
    val isAuthenticated: StateFlow<Boolean> = container.authRepository.isAuthenticated
    val currentUser: StateFlow<AuthUser?> = container.authRepository.currentUser
    val pendingTwoFactorUser: StateFlow<AuthUser?> = container.authRepository.pendingTwoFactorUser

    private val _serverUrl = MutableStateFlow(container.settings.serverUrl)
    val serverUrl: StateFlow<String> = _serverUrl.asStateFlow()

    private val _username = MutableStateFlow("")
    val username: StateFlow<String> = _username.asStateFlow()

    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    private val _twoFactorCode = MutableStateFlow("")
    val twoFactorCode: StateFlow<String> = _twoFactorCode.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    val versionLine: String = "Player-AD-MON Vs${BuildConfig.VERSION_NAME} · build ${BuildConfig.VERSION_CODE}"

    fun updateServerUrl(value: String) { _serverUrl.value = value }
    fun updateUsername(value: String) { _username.value = value }
    fun updatePassword(value: String) { _password.value = value }
    fun updateTwoFactorCode(value: String) { _twoFactorCode.value = value }

    fun login() {
        viewModelScope.launch {
            container.settings.serverUrl = _serverUrl.value.trim()
            if (container.settings.normalizedServerUrl() == null) {
                _errorMessage.value = "Indique a URL do servidor (ex.: https://meuservidor:3000)."
                return@launch
            }
            if (_username.value.isBlank() || _password.value.isBlank()) {
                _errorMessage.value = "Preencha utilizador e palavra-passe."
                return@launch
            }
            _isLoading.value = true
            _errorMessage.value = null
            try {
                container.authRepository.login(_username.value.trim(), _password.value)
            } catch (e: Exception) {
                _errorMessage.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun verifyTwoFactor() {
        viewModelScope.launch {
            val code = _twoFactorCode.value.trim()
            if (code.length < 6) {
                _errorMessage.value = "Introduza o código 2FA (6 dígitos ou código de backup)."
                return@launch
            }
            _isLoading.value = true
            _errorMessage.value = null
            try {
                container.authRepository.verifyTwoFactor(code)
                _twoFactorCode.value = ""
            } catch (e: Exception) {
                _errorMessage.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun cancelTwoFactor() {
        container.authRepository.cancelTwoFactor()
        _twoFactorCode.value = ""
        _errorMessage.value = null
    }

    fun logout() {
        viewModelScope.launch {
            container.authRepository.logout()
        }
    }
}

class TotemListViewModel(private val container: AppContainer) : ViewModel() {
    private val _totems = MutableStateFlow<List<Totem>>(emptyList())
    val totems: StateFlow<List<Totem>> = _totems.asStateFlow()

    private val _searchText = MutableStateFlow("")
    val searchText: StateFlow<String> = _searchText.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        refresh()
    }

    fun updateSearch(value: String) { _searchText.value = value }

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                val q = _searchText.value.trim()
                _totems.value = container.totemRepository.fetchTotems(
                    search = q.ifEmpty { null },
                )
            } catch (e: Exception) {
                _errorMessage.value = e.message
            } finally {
                _isLoading.value = false
            }
        }
    }
}

class MonitorViewModel(
    private val container: AppContainer,
    val totemId: Int,
) : ViewModel() {
    private val telemetry: PlaybackTelemetryService = container.createTelemetryService()

    private val _totem = MutableStateFlow<Totem?>(null)
    val totem: StateFlow<Totem?> = _totem.asStateFlow()

    private val _totemError = MutableStateFlow<String?>(null)
    val totemError: StateFlow<String?> = _totemError.asStateFlow()

    val playbackState: StateFlow<TotemPlaybackState?> = telemetry.state
    val connectionStatus: StateFlow<PlaybackConnectionStatus> = telemetry.connectionStatus
    val lastError: StateFlow<String?> = telemetry.lastError

    private val _tickMs = MutableStateFlow(System.currentTimeMillis())
    val tickMs: StateFlow<Long> = _tickMs.asStateFlow()

    init {
        telemetry.start(totemId)
        viewModelScope.launch { loadTotem() }
        viewModelScope.launch {
            while (true) {
                kotlinx.coroutines.delay(500)
                _tickMs.value = System.currentTimeMillis()
            }
        }
    }

    private suspend fun loadTotem() {
        try {
            _totem.value = container.totemRepository.fetchTotem(totemId)
            _totemError.value = null
        } catch (e: Exception) {
            _totemError.value = e.message
        }
    }

    override fun onCleared() {
        telemetry.stop()
        super.onCleared()
    }
}

class SettingsViewModel(private val container: AppContainer) : ViewModel() {
    private val _serverUrl = MutableStateFlow(container.settings.serverUrl)
    val serverUrl: StateFlow<String> = _serverUrl.asStateFlow()

    private val _savedMessage = MutableStateFlow<String?>(null)
    val savedMessage: StateFlow<String?> = _savedMessage.asStateFlow()

    val currentUser: StateFlow<AuthUser?> = container.authRepository.currentUser
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), container.authRepository.currentUser.value)

    val versionLine: String =
        "Player-AD-MON Vs${BuildConfig.VERSION_NAME} · build ${BuildConfig.VERSION_CODE}"

    fun updateServerUrl(value: String) {
        _serverUrl.value = value
        _savedMessage.value = null
    }

    fun save() {
        container.settings.serverUrl = _serverUrl.value.trim()
        _savedMessage.value = if (container.settings.normalizedServerUrl() != null) {
            "URL guardada."
        } else {
            "URL inválida ou vazia."
        }
    }
}
