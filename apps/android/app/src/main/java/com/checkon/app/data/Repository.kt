package com.checkon.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File

/** Junta API, dados do celular e fotos. Uma instância para o app inteiro (CheckOnApp.repository). */
class Repository(
    val sessions: SessionStore,
    private val api: Api,
    private val store: LocalStore,
    val photos: Photos,
) {
    private val _queue = MutableStateFlow<List<QueuedInspection>>(emptyList())
    val queue: StateFlow<List<QueuedInspection>> = _queue
    private val _syncing = MutableStateFlow(false)
    val syncing: StateFlow<Boolean> = _syncing
    private val _syncProgress = MutableStateFlow<SyncProgress?>(null)
    /** Fotos enviadas / total durante o envio; null fora do envio ou sem fotos. */
    val syncProgress: StateFlow<SyncProgress?> = _syncProgress
    private val _history = MutableStateFlow<List<SentInspection>>(emptyList())
    /** Últimas inspeções aceitas pelo servidor, deste celular (mais recentes primeiro). */
    val history: StateFlow<List<SentInspection>> = _history
    private val _lastSync = MutableStateFlow<SyncSummary?>(null)
    val lastSync: StateFlow<SyncSummary?> = _lastSync
    private val syncLock = Mutex()

    private fun userId(): String? = sessions.current()?.user?.id

    suspend fun login(companyCode: String, matricula: String): Session {
        val session = api.appLogin(companyCode, matricula)
        sessions.lastCompanyCode = companyCode
        reloadQueue()
        return session
    }

    /** Sai do app. A fila continua guardada e é enviada quando a mesma pessoa entrar de novo. */
    suspend fun logout() {
        api.logout()
        _queue.value = emptyList()
        _history.value = emptyList()
    }

    suspend fun reloadQueue() {
        val id = userId() ?: return
        _queue.value = store.readQueue(id)
        _history.value = store.readHistory(id)
    }

    suspend fun cachedBootstrap(): Bootstrap? = userId()?.let { store.readBootstrap(it) }

    suspend fun downloadBootstrap(): Bootstrap {
        val id = userId() ?: throw SessionEndedException("Entre no aplicativo.")
        val data = api.bootstrap().copy(downloadedAt = System.currentTimeMillis())
        store.saveBootstrap(id, data)
        return data
    }

    suspend fun vehicleNcs(vehicleId: String): List<OpenNc> = api.vehicleNcs(vehicleId)

    suspend fun readDraft(): Draft? = userId()?.let { store.readDraft(it) }
    suspend fun saveDraft(draft: Draft?) {
        userId()?.let { store.saveDraft(it, draft) }
    }

    suspend fun enqueue(item: QueuedInspection) {
        val id = userId() ?: return
        _queue.value = store.updateQueue(id) { queue -> queue.filter { it.clientId != item.clientId } + item }
    }

    /** Tira da fila uma inspeção recusada pelo servidor (a pessoa leu o motivo e vai refazer). */
    suspend fun discard(clientId: String) {
        val id = userId() ?: return
        _queue.value = store.updateQueue(id) { queue ->
            queue.firstOrNull { it.clientId == clientId }?.payload?.let { payload ->
                payload.answers.forEach { photos.delete(it.localPhoto) }
                photos.delete(payload.signatureLocal)
            }
            queue.filter { it.clientId != clientId }
        }
    }

    /**
     * Refaz uma inspeção recusada: vira o rascunho atual (com as respostas que ainda valem) e sai
     * da fila. Fotos aproveitadas continuam no celular; as outras e a assinatura são apagadas.
     */
    suspend fun redoRejected(clientId: String, template: Template): Draft? {
        val id = userId() ?: return null
        val item = store.readQueue(id).firstOrNull { it.clientId == clientId && it.state == "REJECTED" } ?: return null
        val (draft, dropped) = Rules.draftFromRejected(item, template, java.util.UUID.randomUUID().toString(), java.time.Instant.now(), fileExists = { File(it).isFile })
        // Primeiro grava o rascunho; só depois tira da fila (se o app fechar no meio, nada se perde).
        store.saveDraft(id, draft)
        _queue.value = store.updateQueue(id) { queue -> queue.filter { it.clientId != clientId } }
        dropped.forEach { photos.delete(it) }
        return draft
    }

    /** Envia a fila. Chamadas ao mesmo tempo esperam o envio em andamento. */
    suspend fun sync(): SyncSummary? = syncLock.withLock {
        val id = userId() ?: return null
        val snapshot = store.readQueue(id)
        if (snapshot.none { it.state == "PENDING" }) {
            _queue.value = snapshot
            return SyncSummary(rejected = snapshot.size)
        }
        val snapshotIds = snapshot.map { it.clientId }.toSet()
        _syncing.value = true
        try {
            val engine = SyncEngine(
                uploadPhoto = { path -> api.uploadPhoto(File(path)) },
                postSync = { payloads -> api.sync(payloads) },
                // Grava o resultado sem apagar o que foi salvo ou descartado durante o envio.
                persist = { result ->
                    _queue.value = store.updateQueue(id) { stored ->
                        val storedIds = stored.map { it.clientId }.toSet()
                        result.filter { it.clientId in storedIds } + stored.filter { it.clientId !in snapshotIds }
                    }
                },
                onProgress = { _syncProgress.value = it },
                fileExists = { File(it).isFile },
            )
            val (_, summary) = engine.run(snapshot)
            if (summary.accepted.isNotEmpty()) _history.value = store.addHistory(id, summary.accepted)
            summary.photosToDelete.forEach { photos.delete(it) }
            if (summary.sent > 0) cleanupPhotos(id)
            _lastSync.value = summary
            return summary
        } finally {
            _syncing.value = false
            _syncProgress.value = null
            _queue.value = store.readQueue(id)
        }
    }

    private suspend fun cleanupPhotos(userId: String) {
        val inUse = store.readQueue(userId).flatMap { item -> item.payload.answers.mapNotNull { it.localPhoto } + listOfNotNull(item.payload.signatureLocal) } +
            (store.readDraft(userId)?.answers?.values?.mapNotNull { it.localPhoto } ?: emptyList())
        photos.cleanOrphans(inUse)
    }
}
