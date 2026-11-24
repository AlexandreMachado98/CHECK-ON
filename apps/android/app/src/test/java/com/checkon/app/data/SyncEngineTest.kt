package com.checkon.app.data

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class SyncEngineTest {
    private fun queued(id: String, answers: List<Answer> = listOf(Answer("a", isCompliant = true))) = QueuedInspection(
        clientId = id,
        payload = SubmitPayload(id, "t", 1, "v", "x", "y", answers = answers),
        vehicleLabel = "ABC1D23",
        templateName = "Diário",
    )

    private fun offline() = ApiException("Sem conexão", 0, offline = true)

    @Test fun `envia fotos uma vez, manda o lote e tira da fila o que foi aceito`() = runBlocking {
        val uploads = mutableListOf<String>()
        val sent = mutableListOf<SubmitPayload>()
        val engine = SyncEngine(
            fileExists = { true }, // caminhos de mentira: os arquivos "existem"
            uploadPhoto = { uploads += it; "https://storage/1.jpg" },
            postSync = { list ->
                sent += list
                listOf(SyncResult("CREATED", "c1"), SyncResult("DUPLICATE", "c2"))
            },
            persist = {},
        )
        val (rest, summary) = engine.run(listOf(queued("c1", listOf(Answer("a", isCompliant = false, localPhoto = "/1.jpg"))), queued("c2")))
        assertEquals(listOf("/1.jpg"), uploads)
        assertEquals(listOf(Answer("a", isCompliant = false, photoUrl = "https://storage/1.jpg")), sent[0].answers)
        assertTrue(rest.isEmpty())
        assertEquals(2, summary.sent)
        assertEquals(listOf("/1.jpg"), summary.photosToDelete)
    }

    @Test fun `sem internet nada sai da fila e a foto ja enviada nao e reenviada`() = runBlocking {
        var saved = emptyList<QueuedInspection>()
        var calls = 0
        val first = SyncEngine(
            fileExists = { true }, // caminhos de mentira: os arquivos "existem"
            uploadPhoto = { calls++; if (calls == 2) throw offline(); "https://storage/1.jpg" },
            postSync = { fail("não deveria enviar sem as fotos"); emptyList() },
            persist = { saved = it },
        ).run(listOf(queued("c1", listOf(Answer("a", isCompliant = false, localPhoto = "/1.jpg"), Answer("b", isCompliant = false, localPhoto = "/2.jpg")))))
        assertTrue(first.second.offline)
        assertEquals(1, first.first.size)
        assertEquals("https://storage/1.jpg", saved[0].payload.answers[0].photoUrl)

        val uploads = mutableListOf<String>()
        val second = SyncEngine(
            fileExists = { true }, // caminhos de mentira: os arquivos "existem"
            uploadPhoto = { uploads += it; "https://storage/2.jpg" },
            postSync = { listOf(SyncResult("CREATED", "c1")) },
            persist = {},
        ).run(saved)
        assertEquals(listOf("/2.jpg"), uploads)
        assertTrue(second.first.isEmpty())
    }

    @Test fun `recusa fica marcada e erro temporario continua pendente`() = runBlocking {
        val (queue, summary) = SyncEngine(
            fileExists = { true }, // caminhos de mentira: os arquivos "existem"
            uploadPhoto = { "x" },
            postSync = { listOf(SyncResult("REJECTED", "c1", "Veículo não encontrado ou inativo."), SyncResult("RETRY", "c2", "Erro temporário")) },
            persist = {},
        ).run(listOf(queued("c1"), queued("c2")))
        assertEquals("REJECTED", queue.first { it.clientId == "c1" }.state)
        assertEquals("Veículo não encontrado ou inativo.", queue.first { it.clientId == "c1" }.message)
        assertEquals("PENDING", queue.first { it.clientId == "c2" }.state)
        assertEquals(1, summary.rejected)
        assertEquals(1, summary.pending)
    }

    @Test fun `inspecao recusada nao e reenviada`() = runBlocking {
        val (_, summary) = SyncEngine(
            fileExists = { true }, // caminhos de mentira: os arquivos "existem"
            uploadPhoto = { "x" },
            postSync = { fail("não deveria enviar"); emptyList() },
            persist = {},
        ).run(listOf(queued("c1").copy(state = "REJECTED", message = "x")))
        assertEquals(0, summary.sent)
    }

    @Test fun `corpo enviado nao leva o caminho local da foto`() {
        val payload = queued("c1", listOf(Answer("a", isCompliant = true, localPhoto = "/1.jpg", photoUrl = "https://s/1.jpg"))).payload
        val json = AppJson.encodeToString(SubmitPayload.serializer(), SyncEngine.toApiPayload(payload))
        assertTrue(json.contains("\"photoUrl\":\"https://s/1.jpg\""))
        assertTrue(!json.contains("localPhoto"))
        assertTrue(!json.contains("textValue")) // campos nulos não vão (a API recusa campos desconhecidos/vazios)
        assertNull(SyncEngine.toApiPayload(payload).answers[0].localPhoto)
    }

    @Test fun `assinatura sobe antes da inspecao, uma vez so, e o caminho local nao vai para a API`() = runBlocking {
        val uploads = mutableListOf<String>()
        val sent = mutableListOf<SubmitPayload>()
        val signed = queued("c1").let { it.copy(payload = it.payload.copy(signatureLocal = "/assinatura.png", signedName = "Maria")) }
        val (rest, summary) = SyncEngine(
            fileExists = { true }, // caminhos de mentira: os arquivos "existem"
            uploadPhoto = { uploads += it; "https://storage/assinatura.png" },
            postSync = { list -> sent += list; listOf(SyncResult("CREATED", "c1")) },
            persist = {},
        ).run(listOf(signed))
        assertEquals(listOf("/assinatura.png"), uploads)
        assertEquals("https://storage/assinatura.png", sent[0].signatureUrl)
        assertNull(sent[0].signatureLocal)
        assertEquals("Maria", sent[0].signedName)
        assertTrue(rest.isEmpty())
        assertEquals(listOf("/assinatura.png"), summary.photosToDelete)
    }

    @Test fun `assinatura ja enviada nao e reenviada e sem internet a inspecao fica na fila`() = runBlocking {
        val alreadySent = queued("c1").let {
            it.copy(payload = it.payload.copy(signatureLocal = "/assinatura.png", signatureUrl = "https://storage/assinatura.png"))
        }
        var uploads = 0
        val (rest, summary) = SyncEngine(
            fileExists = { true }, // caminhos de mentira: os arquivos "existem"
            uploadPhoto = { uploads++; "x" },
            postSync = { throw offline() },
            persist = {},
        ).run(listOf(alreadySent))
        assertEquals(0, uploads)
        assertTrue(summary.offline)
        assertEquals(1, rest.size)
    }

    @Test fun `inspecao aceita entra no historico com o resultado do servidor`() = runBlocking {
        val (_, summary) = SyncEngine(
            fileExists = { true }, // caminhos de mentira: os arquivos "existem"
            uploadPhoto = { "x" },
            now = { 1_000L },
            postSync = { listOf(SyncResult("CREATED", "c1", vehicleStatus = "BLOQUEADO", ncsOpened = 2, ncsRecurrent = 1), SyncResult("REJECTED", "c2", "erro")) },
            persist = {},
        ).run(listOf(queued("c1"), queued("c2")))
        assertEquals(1, summary.accepted.size)
        val sent = summary.accepted[0]
        assertEquals("c1", sent.clientId)
        assertEquals("ABC1D23", sent.vehicleLabel)
        assertEquals("v", sent.vehicleId)
        assertEquals("BLOQUEADO", sent.vehicleStatus)
        assertEquals(2, sent.ncsOpened)
        assertEquals(1, sent.ncsRecurrent)
        assertEquals(1_000L, sent.sentAt)
    }

    @Test fun `progresso conta so as fotos que faltam e avisa a cada uma`() = runBlocking {
        val progress = mutableListOf<SyncProgress>()
        SyncEngine(
            fileExists = { true }, // caminhos de mentira: os arquivos "existem"
            uploadPhoto = { "https://storage/$it" },
            postSync = { list -> list.map { SyncResult("CREATED", it.clientId) } },
            persist = {},
            onProgress = { progress += it },
        ).run(
            listOf(
                // 1 foto já enviada antes (não conta de novo) e 2 a enviar.
                queued("c1", listOf(
                    Answer("a", isCompliant = false, localPhoto = "/1.jpg", photoUrl = "https://storage/antiga.jpg"),
                    Answer("b", isCompliant = false, localPhoto = "/2.jpg"),
                    Answer("c", isCompliant = true),
                )),
                queued("c2", listOf(Answer("d", isCompliant = false, localPhoto = "/3.jpg"))),
            ),
        )
        assertEquals(listOf(SyncProgress(0, 2), SyncProgress(1, 2), SyncProgress(2, 2)), progress)
    }

    @Test fun `sem fotos nao avisa progresso`() = runBlocking {
        val progress = mutableListOf<SyncProgress>()
        SyncEngine(
            fileExists = { true }, // caminhos de mentira: os arquivos "existem"
            uploadPhoto = { fail("sem fotos"); "" },
            postSync = { list -> list.map { SyncResult("CREATED", it.clientId) } },
            persist = {},
            onProgress = { progress += it },
        ).run(listOf(queued("c1", listOf(Answer("a", isCompliant = true)))))
        assertTrue(progress.isEmpty())
    }

    @Test fun `foto apagada do celular recusa so aquela inspecao e nao trava a fila`() = runBlocking {
        val uploads = mutableListOf<String>()
        val posted = mutableListOf<String>()
        val (queue, summary) = SyncEngine(
            fileExists = { it != "/apagada.jpg" },
            uploadPhoto = { uploads += it; "https://storage/$it" },
            postSync = { list -> posted += list.map { it.clientId }; list.map { SyncResult("CREATED", it.clientId) } },
            persist = {},
        ).run(
            listOf(
                queued("c1", listOf(Answer("a", isCompliant = false, localPhoto = "/ok1.jpg"), Answer("b", isCompliant = false, localPhoto = "/apagada.jpg"))),
                queued("c2", listOf(Answer("c", isCompliant = false, localPhoto = "/ok2.jpg"))),
            ),
        )
        assertEquals(listOf("/ok2.jpg"), uploads) // nem tenta subir as fotos da inspeção quebrada
        assertEquals(listOf("c2"), posted)
        assertEquals(1, queue.size)
        assertEquals("REJECTED", queue[0].state)
        assertEquals(MISSING_FILE_MESSAGE, queue[0].message)
        assertEquals(1, summary.sent)
        assertTrue(!summary.offline)
    }

    @Test fun `assinatura apagada tambem recusa, mas foto ja enviada antes nao importa`() = runBlocking {
        val semAssinatura = queued("c1").let { it.copy(payload = it.payload.copy(signatureLocal = "/assinatura.png")) }
        val (queue, _) = SyncEngine(
            fileExists = { false },
            uploadPhoto = { fail("nada a subir"); "" },
            postSync = { list -> list.map { SyncResult("CREATED", it.clientId) } },
            persist = {},
        ).run(
            listOf(
                semAssinatura,
                // Foto apagada do celular, mas já está no servidor: segue normalmente.
                queued("c2", listOf(Answer("a", isCompliant = false, localPhoto = "/sumiu.jpg", photoUrl = "https://storage/x.jpg"))),
            ),
        )
        assertEquals(listOf("c1"), queue.map { it.clientId })
        assertEquals("REJECTED", queue[0].state)
    }
}
