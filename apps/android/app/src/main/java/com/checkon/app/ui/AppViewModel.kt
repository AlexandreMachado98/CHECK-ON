package com.checkon.app.ui

import android.app.Application
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.checkon.app.CheckOnApp
import com.checkon.app.data.ApiException
import com.checkon.app.data.Bootstrap
import com.checkon.app.data.QueuedInspection
import com.checkon.app.data.SessionEndedException
import com.checkon.app.sync.SyncWorker
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChangedBy
import kotlinx.coroutines.launch

/** Estado do app inteiro: sessão, dados offline, fila de envio e internet. */
class AppViewModel(application: Application) : AndroidViewModel(application) {
    val repository = (application as CheckOnApp).repository
    val session = repository.sessions.session
    val queue = repository.queue
    val syncing = repository.syncing
    val lastSync = repository.lastSync

    private val _bootstrap = MutableStateFlow<Bootstrap?>(null)
    val bootstrap: StateFlow<Bootstrap?> = _bootstrap
    private val _loadingBootstrap = MutableStateFlow(false)
    val loadingBootstrap: StateFlow<Boolean> = _loadingBootstrap
    private val _bootstrapError = MutableStateFlow<String?>(null)
    val bootstrapError: StateFlow<String?> = _bootstrapError
    /** Mensagem na tela de login quando a sessão terminou sozinha (ex.: acesso bloqueado). */
    private val _sessionMessage = MutableStateFlow<String?>(null)
    val sessionMessage: StateFlow<String?> = _sessionMessage
    private val _online = MutableStateFlow(true)
    val online: StateFlow<Boolean> = _online

    private val connectivity = application.getSystemService(ConnectivityManager::class.java)
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) = updateOnline()
        override fun onLost(network: Network) = updateOnline()
        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) = updateOnline()
    }

    init {
        updateOnline()
        runCatching { connectivity.registerDefaultNetworkCallback(networkCallback) }
        // A cada login (ou ao abrir o app já logado): carrega o que está no celular e atualiza com a internet.
        viewModelScope.launch {
            session.distinctUntilChangedBy { it?.user?.id }.collect { current ->
                if (current == null) {
                    _bootstrap.value = null
                    return@collect
                }
                _bootstrap.value = repository.cachedBootstrap()
                repository.reloadQueue()
                catchUp()
            }
        }
    }

    private fun updateOnline() {
        val wasOnline = _online.value
        val caps = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
        _online.value = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        if (_online.value && !wasOnline) viewModelScope.launch { catchUp() }
    }

    /** Com internet: atualiza dados com mais de 15 minutos e envia a fila. */
    fun catchUp() {
        if (session.value == null || !_online.value) return
        val downloadedAt = _bootstrap.value?.downloadedAt ?: 0
        if (System.currentTimeMillis() - downloadedAt > 15 * 60 * 1000) refreshBootstrap()
        syncNow()
    }

    fun refreshBootstrap() {
        if (_loadingBootstrap.value) return
        viewModelScope.launch {
            _loadingBootstrap.value = true
            try {
                _bootstrap.value = repository.downloadBootstrap()
                _bootstrapError.value = null
            } catch (e: ApiException) {
                handle(e)
                _bootstrapError.value = e.message
            } finally {
                _loadingBootstrap.value = false
            }
        }
    }

    fun syncNow() {
        SyncWorker.schedule(getApplication())
        viewModelScope.launch {
            try {
                val summary = repository.sync()
                // Inspeção enviada pode ter aberto NC ou mudado o status do veículo.
                if ((summary?.sent ?: 0) > 0) refreshBootstrap()
            } catch (e: ApiException) {
                handle(e)
            }
        }
    }

    suspend fun login(companyCode: String, matricula: String) {
        repository.login(companyCode, matricula)
        _sessionMessage.value = null
    }

    fun logout() {
        viewModelScope.launch {
            _sessionMessage.value = null
            repository.logout()
        }
    }

    suspend fun enqueue(item: QueuedInspection) {
        repository.enqueue(item)
        syncNow()
    }

    fun discard(clientId: String) {
        viewModelScope.launch { repository.discard(clientId) }
    }

    private fun handle(e: ApiException) {
        if (e is SessionEndedException) _sessionMessage.value = e.message
    }

    override fun onCleared() {
        runCatching { connectivity.unregisterNetworkCallback(networkCallback) }
    }
}
