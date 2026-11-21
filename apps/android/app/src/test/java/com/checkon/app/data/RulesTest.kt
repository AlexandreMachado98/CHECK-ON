package com.checkon.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RulesTest {
    private fun item(id: String, type: String = "PASS_FAIL", required: Boolean = true, photo: String = "NONE") =
        TemplateItem(id = id, text = "Item $id", type = type, isRequired = required, photoRequirement = photo)

    private fun template(vararg items: TemplateItem) =
        Template(id = "t", name = "Diário", categories = listOf(TemplateCategory("c", "Geral", 0, items.toList())))

    private fun vehicle(id: String, plate: String, prefix: String? = null, qr: String? = null, model: String? = null, fleet: String? = null) =
        Vehicle(id = id, plate = plate, prefix = prefix, qrCode = qr, model = model, fleet = fleet?.let { Fleet("f", it) })

    @Test fun `item obrigatorio sem resposta fica pendente`() {
        val t = template(item("a"), item("b", required = false))
        assertEquals(listOf("a"), Rules.pendingItems(t, emptyMap()).map { it.itemId })
        assertTrue(Rules.pendingItems(t, mapOf("a" to Answer("a", isCompliant = true))).isEmpty())
    }

    @Test fun `nao conforme com foto do problema pede foto`() {
        val t = template(item("a", photo = "ON_NON_COMPLIANCE"))
        assertTrue(Rules.pendingItems(t, mapOf("a" to Answer("a", isCompliant = true))).isEmpty())
        val missing = Rules.pendingItems(t, mapOf("a" to Answer("a", isCompliant = false)))
        assertEquals(1, missing.size)
        assertTrue(missing[0].message.contains("foto do problema"))
        assertTrue(Rules.pendingItems(t, mapOf("a" to Answer("a", isCompliant = false, localPhoto = "/f.jpg"))).isEmpty())
    }

    @Test fun `foto sempre exigida vale mesmo quando conforme`() {
        val t = template(item("a", photo = "ALWAYS"))
        assertEquals(1, Rules.pendingItems(t, mapOf("a" to Answer("a", isCompliant = true))).size)
        assertTrue(Rules.pendingItems(t, mapOf("a" to Answer("a", isCompliant = true, photoUrl = "https://x/y.jpg"))).isEmpty())
    }

    @Test fun `texto numero e foto so contam com valor`() {
        val t = template(item("t", "TEXT"), item("n", "NUMBER"), item("p", "PHOTO"))
        assertEquals(3, Rules.pendingItems(t, mapOf("t" to Answer("t", textValue = "  "), "n" to Answer("n"), "p" to Answer("p"))).size)
        val ok = mapOf("t" to Answer("t", textValue = "ok"), "n" to Answer("n", numberValue = 0.0), "p" to Answer("p", localPhoto = "/p.jpg"))
        assertTrue(Rules.pendingItems(t, ok).isEmpty())
    }

    @Test fun `respostas enviadas sem campos vazios`() {
        val t = template(item("a"), item("b", "TEXT", required = false), item("c", "NUMBER"))
        val sent = Rules.answersToSend(
            t,
            mapOf(
                "a" to Answer("a", isCompliant = false, observations = "  pneu careca  "),
                "b" to Answer("b", textValue = " "),
                "c" to Answer("c", numberValue = 12.5, textValue = "lixo"),
            ),
        )
        assertEquals(listOf(Answer("a", isCompliant = false, observations = "pneu careca"), Answer("c", numberValue = 12.5)), sent)
    }

    @Test fun `numero aceita virgula e recusa texto`() {
        assertEquals(12.5, Rules.parseNumber("12,5")!!, 0.0)
        assertEquals(100.0, Rules.parseNumber(" 100 ")!!, 0.0)
        assertEquals(-3.2, Rules.parseNumber("-3.2")!!, 0.0)
        assertNull(Rules.parseNumber("12a"))
        assertNull(Rules.parseNumber(""))
    }

    @Test fun `QR do portal, codigo cadastrado, placa e prefixo`() {
        val list = listOf(vehicle("v1", "ABC-1D23", qr = "QR-77"), vehicle("v2", "XYZ9876", prefix = "1020"))
        assertEquals("v2", Rules.findVehicleByQr(list, "${Rules.VEHICLE_QR_PREFIX}v2")?.id)
        assertEquals("v1", Rules.findVehicleByQr(list, "checkon:veiculo:v1")?.id)
        assertEquals("v1", Rules.findVehicleByQr(list, "QR-77")?.id)
        assertEquals("v1", Rules.findVehicleByQr(list, "abc1d23")?.id)
        assertEquals("v2", Rules.findVehicleByQr(list, "1020")?.id)
        assertNull(Rules.findVehicleByQr(list, "${Rules.VEHICLE_QR_PREFIX}outro"))
        assertNull(Rules.findVehicleByQr(list, "https://site-qualquer.com"))
    }

    @Test fun `busca de veiculo`() {
        val v = vehicle("v1", "ABC-1D23", model = "Atego 1719", fleet = "Leste")
        assertTrue(Rules.matchesVehicle(v, "abc1"))
        assertTrue(Rules.matchesVehicle(v, "atego"))
        assertTrue(Rules.matchesVehicle(v, "leste"))
        assertFalse(Rules.matchesVehicle(v, "volvo"))
    }

    @Test fun `codigo da empresa e texto do aparelho`() {
        assertEquals("VISTECSSQV", Rules.normalizeCompanyCode(" vistec ssqv "))
        assertEquals("Android 15 - Galaxia", Rules.asciiOnly("Android 15 - Galáxia"))
    }

    @Test fun `mensagem de erro da API`() {
        assertEquals("A\nB", Api.messageFrom("""{"message":["A","B"]}""", "x"))
        assertEquals("Bloqueado", Api.messageFrom("""{"message":"Bloqueado"}""", "x"))
        assertEquals("x", Api.messageFrom("<html>", "x"))
    }

    @Test fun `N A vale como resposta e nao pede foto`() {
        val t = template(item("a", photo = "ALWAYS"), item("t", "TEXT"))
        val answers = mapOf("a" to Answer("a", notApplicable = true), "t" to Answer("t", notApplicable = true, textValue = "lixo"))
        assertTrue(Rules.pendingItems(t, answers).isEmpty())
        assertFalse(Rules.showsPhoto(t.allItems[0], answers["a"]))
        assertEquals(listOf(Answer("a", notApplicable = true), Answer("t", notApplicable = true)), Rules.answersToSend(t, answers))
    }

    @Test fun `N A em item critico exige o motivo`() {
        val critico = TemplateItem(id = "f", text = "Freio de mão", isCritical = true)
        val t = template(critico)
        assertEquals(listOf("f"), Rules.pendingItems(t, mapOf("f" to Answer("f", notApplicable = true))).map { it.itemId })
        assertTrue(Rules.pendingItems(t, mapOf("f" to Answer("f", notApplicable = true, observations = "sem freio mecânico"))).isEmpty())
        assertEquals(
            listOf(Answer("f", notApplicable = true, observations = "sem freio mecânico")),
            Rules.answersToSend(t, mapOf("f" to Answer("f", notApplicable = true, observations = " sem freio mecânico ", isCompliant = true))),
        )
    }

    @Test fun `JSON do N A so leva o campo quando marcado`() {
        val json = AppJson.encodeToString(Answer.serializer(), Answer("a", notApplicable = true))
        assertTrue(json.contains("\"notApplicable\":true"))
        assertFalse(AppJson.encodeToString(Answer.serializer(), Answer("a", isCompliant = true)).contains("notApplicable"))
    }

    @Test fun `plural usa singular so com um`() {
        assertEquals("1 foto", Rules.plural(1, "foto", "fotos"))
        assertEquals("0 fotos", Rules.plural(0, "foto", "fotos"))
        assertEquals("3 inspeções recusadas", Rules.plural(3, "inspeção recusada", "inspeções recusadas"))
    }

    @Test fun `tema automatico segue o celular e os outros ignoram`() {
        assertTrue(ThemeMode.AUTOMATICO.isDark(systemDark = true))
        assertFalse(ThemeMode.AUTOMATICO.isDark(systemDark = false))
        assertFalse(ThemeMode.CLARO.isDark(systemDark = true))
        assertTrue(ThemeMode.ESCURO.isDark(systemDark = false))
    }

    @Test fun `tema salvo desconhecido volta para automatico`() {
        assertEquals(ThemeMode.ESCURO, ThemeMode.fromStored("ESCURO"))
        assertEquals(ThemeMode.AUTOMATICO, ThemeMode.fromStored(null))
        assertEquals(ThemeMode.AUTOMATICO, ThemeMode.fromStored("NOTURNO"))
    }

    @Test fun `proximo item e o primeiro sem resposta ou com foto faltando`() {
        val t = template(item("a"), item("b", photo = "ON_NON_COMPLIANCE"), item("c", required = false))
        assertEquals("a", Rules.nextToAnswer(t, emptyMap()))
        // "a" respondido; "b" não conforme sem a foto do problema: ainda falta.
        val answers = mapOf("a" to Answer("a", isCompliant = true), "b" to Answer("b", isCompliant = false))
        assertEquals("b", Rules.nextToAnswer(t, answers))
        // Item opcional também entra, mas só depois dos anteriores.
        val done = answers + ("b" to Answer("b", isCompliant = true))
        assertEquals("c", Rules.nextToAnswer(t, done))
        assertNull(Rules.nextToAnswer(t, done + ("c" to Answer("c", notApplicable = true))))
    }
}
