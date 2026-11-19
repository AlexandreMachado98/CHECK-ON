package com.checkon.app.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import java.io.File

/** Sessão do aplicativo, guardada na área privada do app (o motorista continua conectado sem internet). */
class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("checkon.session", Context.MODE_PRIVATE)
    private val state = MutableStateFlow(load())
    val session: StateFlow<Session?> = state

    fun current(): Session? = state.value

    fun save(session: Session?) {
        prefs.edit().apply {
            if (session == null) remove("session") else putString("session", AppJson.encodeToString(Session.serializer(), session))
        }.apply()
        state.value = session
    }

    var lastCompanyCode: String
        get() = prefs.getString("lastCompanyCode", "") ?: ""
        set(value) = prefs.edit().putString("lastCompanyCode", value).apply()

    private fun load(): Session? = prefs.getString("session", null)?.let {
        runCatching { AppJson.decodeFromString(Session.serializer(), it) }.getOrNull()
    }
}

/**
 * Dados guardados no celular, separados por pessoa (o celular pode ser compartilhado):
 * dados para trabalhar offline, fila de envio e rascunho da inspeção.
 */
class LocalStore(context: Context) {
    private val root = File(context.filesDir, "data")
    private val lock = Mutex()

    private fun file(userId: String, name: String) = File(File(root, userId.filter { it.isLetterOrDigit() || it == '-' }), name)

    private suspend fun <T> read(file: File, serializer: KSerializer<T>): T? = withContext(Dispatchers.IO) {
        if (!file.exists()) null else runCatching { AppJson.decodeFromString(serializer, file.readText()) }.getOrNull()
    }

    private suspend fun <T> write(file: File, serializer: KSerializer<T>, value: T?) = withContext(Dispatchers.IO) {
        if (value == null) {
            file.delete()
            return@withContext
        }
        file.parentFile?.mkdirs()
        // Grava num arquivo temporário e troca: um app fechado no meio não corrompe os dados.
        val temp = File(file.parentFile, file.name + ".tmp")
        temp.writeText(AppJson.encodeToString(serializer, value))
        if (!temp.renameTo(file)) {
            file.delete()
            temp.renameTo(file)
        }
    }

    suspend fun readBootstrap(userId: String) = read(file(userId, "bootstrap.json"), Bootstrap.serializer())
    suspend fun saveBootstrap(userId: String, value: Bootstrap) = write(file(userId, "bootstrap.json"), Bootstrap.serializer(), value)

    suspend fun readDraft(userId: String) = read(file(userId, "draft.json"), Draft.serializer())
    suspend fun saveDraft(userId: String, value: Draft?) = write(file(userId, "draft.json"), Draft.serializer(), value)

    private val queueSerializer = ListSerializer(QueuedInspection.serializer())
    suspend fun readQueue(userId: String): List<QueuedInspection> = lock.withLock { read(file(userId, "outbox.json"), queueSerializer) ?: emptyList() }

    /** Alteração da fila com exclusividade: salvar, descartar e sincronizar não se atropelam. */
    suspend fun updateQueue(userId: String, change: (List<QueuedInspection>) -> List<QueuedInspection>): List<QueuedInspection> =
        lock.withLock {
            val f = file(userId, "outbox.json")
            val next = change(read(f, queueSerializer) ?: emptyList())
            write(f, queueSerializer, next)
            next
        }
}
