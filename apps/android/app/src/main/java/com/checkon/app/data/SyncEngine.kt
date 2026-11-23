package com.checkon.app.data

/** Erro de chamada à API. [offline] = não chegou ao servidor (sem internet, servidor fora, tempo esgotado). */
open class ApiException(message: String, val status: Int, val offline: Boolean = false) : Exception(message)

/** A sessão terminou (acesso bloqueado, sessão expirada): é preciso entrar de novo. */
class SessionEndedException(message: String) : ApiException(message, 401)

data class SyncSummary(
    val sent: Int = 0,
    val rejected: Int = 0,
    val pending: Int = 0,
    /** Fotos do celular que podem ser apagadas (inspeção aceita pelo servidor). */
    val photosToDelete: List<String> = emptyList(),
    /** Inspeções aceitas neste envio, para o histórico do celular. */
    val accepted: List<SentInspection> = emptyList(),
    val offline: Boolean = false,
    val error: String? = null,
)

/**
 * Envio da fila, sem dependência de Android (testado em SyncEngineTest).
 * Primeiro as fotos (cada uma uma vez só), depois as inspeções em lote.
 * Sem conexão, para e mantém tudo na fila. Recusa do servidor fica marcada para a pessoa ver.
 */
class SyncEngine(
    private val uploadPhoto: suspend (localPath: String) -> String,
    /** Relógio (milissegundos), trocável nos testes. */
    private val now: () -> Long = { System.currentTimeMillis() },
    private val postSync: suspend (List<SubmitPayload>) -> List<SyncResult>,
    /** Grava a fila depois de cada mudança (não perde foto já enviada se o app fechar). */
    private val persist: suspend (List<QueuedInspection>) -> Unit,
) {
    suspend fun run(initial: List<QueuedInspection>): Pair<List<QueuedInspection>, SyncSummary> {
        val queue = initial.toMutableList()
        var offline = false
        var error: String? = null
        val photosToDelete = mutableListOf<String>()
        val accepted = mutableListOf<SentInspection>()
        val ready = mutableListOf<String>()

        for (index in queue.indices) {
            if (queue[index].state != "PENDING") continue
            var item = queue[index]
            var failed = false
            // Assinatura primeiro: sobe como uma foto, uma vez só.
            val signature = item.payload.signatureLocal
            if (signature != null && item.payload.signatureUrl == null) {
                try {
                    val url = uploadPhoto(signature)
                    item = item.copy(payload = item.payload.copy(signatureUrl = url))
                    queue[index] = item
                    persist(queue.toList())
                } catch (e: ApiException) {
                    if (e.offline) {
                        offline = true
                    } else {
                        item = item.copy(state = "REJECTED", message = "Não foi possível enviar a assinatura: ${e.message}")
                        queue[index] = item
                        error = error ?: item.message
                        persist(queue.toList())
                    }
                    failed = true
                }
            }
            if (offline) break
            if (failed) continue
            for ((answerIndex, answer) in item.payload.answers.withIndex()) {
                val local = answer.localPhoto
                if (local == null || answer.photoUrl != null) continue
                try {
                    val url = uploadPhoto(local)
                    val answers = item.payload.answers.toMutableList()
                    answers[answerIndex] = answer.copy(photoUrl = url)
                    item = item.copy(payload = item.payload.copy(answers = answers))
                    queue[index] = item
                    persist(queue.toList())
                } catch (e: ApiException) {
                    if (e.offline) {
                        offline = true
                    } else {
                        item = item.copy(state = "REJECTED", message = "Não foi possível enviar uma foto: ${e.message}")
                        queue[index] = item
                        error = error ?: item.message
                        persist(queue.toList())
                    }
                    failed = true
                    break
                }
            }
            if (offline) break
            if (!failed) ready += item.clientId
        }

        for (batch in ready.chunked(20)) {
            if (offline) break
            val payloads = batch.mapNotNull { id -> queue.firstOrNull { it.clientId == id }?.let { toApiPayload(it.payload) } }
            val results = try {
                postSync(payloads)
            } catch (e: ApiException) {
                if (e.offline) offline = true else error = error ?: e.message
                break
            }
            val byId = results.associateBy { it.clientId }
            val done = mutableSetOf<String>()
            for (id in batch) {
                val index = queue.indexOfFirst { it.clientId == id }
                if (index < 0) continue
                val item = queue[index]
                val result = byId[id] ?: continue
                when (result.status) {
                    "CREATED", "DUPLICATE" -> {
                        done += id
                        accepted += SentInspection(
                            clientId = id,
                            vehicleLabel = item.vehicleLabel,
                            templateName = item.templateName,
                            completedAt = item.payload.completedAt,
                            vehicleId = item.payload.vehicleId,
                            sentAt = now(),
                            vehicleStatus = result.vehicleStatus,
                            ncsOpened = result.ncsOpened,
                            ncsRecurrent = result.ncsRecurrent,
                        )
                        photosToDelete += item.payload.answers.mapNotNull { it.localPhoto } + listOfNotNull(item.payload.signatureLocal)
                    }
                    "REJECTED" -> queue[index] = item.copy(state = "REJECTED", message = result.message)
                    else -> queue[index] = item.copy(attempts = item.attempts + 1)
                }
            }
            queue.removeAll { it.clientId in done }
            persist(queue.toList())
        }

        val summary = SyncSummary(
            sent = initial.size - queue.size,
            rejected = queue.count { it.state == "REJECTED" },
            pending = queue.count { it.state == "PENDING" },
            photosToDelete = photosToDelete,
            accepted = accepted,
            offline = offline,
            error = error,
        )
        return queue.toList() to summary
    }

    companion object {
        /** Corpo que vai para a API: sem o caminho local das fotos e da assinatura. */
        fun toApiPayload(payload: SubmitPayload): SubmitPayload =
            payload.copy(answers = payload.answers.map { it.copy(localPhoto = null) }, signatureLocal = null)
    }
}
