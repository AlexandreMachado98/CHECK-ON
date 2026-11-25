package com.checkon.app.data

import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

/** Fila de envio guardada no celular: inspeções ainda não enviadas não podem sumir. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class LocalStoreTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private val store = LocalStore(context)
    private val user = "user-1"
    private val dir get() = File(context.filesDir, "data/$user")

    private fun queued(id: String) = QueuedInspection(
        clientId = id,
        payload = SubmitPayload(
            clientId = id, templateId = "t1", templateVersion = 1, vehicleId = "v1",
            startedAt = "2026-11-25T08:00:00Z", completedAt = "2026-11-25T08:10:00Z",
            answers = listOf(Answer("i1", isCompliant = false, localPhoto = "/f/1.jpg")),
        ),
        vehicleLabel = "ABC1D23", templateName = "Diário",
    )

    @Test fun `grava e le a fila`() = runBlocking {
        store.updateQueue(user) { it + queued("c1") + queued("c2") }
        assertEquals(listOf("c1", "c2"), store.readQueue(user).map { it.clientId })
        assertTrue("não sobra arquivo temporário", dir.listFiles()!!.none { it.name.endsWith(".tmp") })
    }

    @Test fun `fila ilegivel abre vazia mas guarda copia antes de ser substituida`() = runBlocking {
        store.updateQueue(user) { listOf(queued("c1")) }
        val outbox = File(dir, "outbox.json")
        val original = outbox.readText()
        outbox.writeText(original.dropLast(40)) // cortado no meio, como numa gravação interrompida
        assertEquals(emptyList<QueuedInspection>(), store.readQueue(user))
        // Nova inspeção salva por cima: a cópia do arquivo ilegível continua lá para recuperar.
        store.updateQueue(user) { it + queued("c9") }
        val copies = dir.listFiles()!!.filter { it.name.startsWith("outbox.json.ilegivel-") }
        assertTrue("guardou a cópia", copies.isNotEmpty())
        assertTrue(copies.first().readText().contains("\"c1\""))
        assertEquals(listOf("c9"), store.readQueue(user).map { it.clientId })
    }

    @Test fun `arquivo vazio nao gera copia`() = runBlocking {
        dir.mkdirs()
        File(dir, "outbox.json").writeText("")
        assertEquals(emptyList<QueuedInspection>(), store.readQueue(user))
        assertTrue(dir.listFiles()!!.none { it.name.contains("ilegivel") })
    }
}
