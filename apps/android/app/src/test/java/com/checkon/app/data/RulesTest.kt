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

    @Test fun `checklist de uma frente so aparece nos veiculos dela`() {
        val all = Template(id = "todas", name = "Diário")
        val onlyA = Template(id = "a", name = "Só A", allUnits = false, units = listOf(TemplateUnit("frente-a")))
        val vehicleA = Vehicle(id = "v1", plate = "AAA1A11", fleet = Fleet("f1", "Frota A", unitId = "frente-a"))
        val vehicleB = Vehicle(id = "v2", plate = "BBB2B22", fleet = Fleet("f2", "Frota B", unitId = "frente-b"))
        assertEquals(listOf("todas", "a"), Rules.templatesForVehicle(listOf(all, onlyA), vehicleA).map { it.id })
        assertEquals(listOf("todas"), Rules.templatesForVehicle(listOf(all, onlyA), vehicleB).map { it.id })
        // Servidor antigo, sem a frente do veículo: mostra todos.
        val legacy = Vehicle(id = "v3", plate = "CCC3C33", fleet = Fleet("f3", "Frota"))
        assertEquals(2, Rules.templatesForVehicle(listOf(all, onlyA), legacy).size)
    }

    @Test fun `marcar conformes so preenche os itens sem resposta da secao`() {
        val category = TemplateCategory(
            "c", "Rodagem", 0,
            listOf(item("a"), item("b"), item("c"), item("d", type = "TEXT"), item("e")),
        )
        val answers = mapOf(
            "b" to Answer("b", isCompliant = false, observations = "pneu careca"),
            "c" to Answer("c", notApplicable = true),
            "e" to Answer("e", observations = "só a observação"),
        )
        assertEquals(listOf("a", "e"), Rules.unansweredPassFail(category, answers).map { it.id })
        val marked = Rules.markSectionCompliant(category, answers)
        assertEquals(true, marked["a"]?.isCompliant)
        // Não conforme e N/A ficam como estavam; texto não é marcado; observação é mantida.
        assertEquals(false, marked["b"]?.isCompliant)
        assertTrue(marked["c"]?.notApplicable == true)
        assertNull(marked["d"])
        assertEquals("só a observação", marked["e"]?.observations)
        assertEquals(true, marked["e"]?.isCompliant)
    }

    @Test fun `frentes da lista de veiculos sem repetir e em ordem`() {
        val list = listOf(
            Vehicle(id = "1", plate = "AAA1A11", fleet = Fleet("f1", "Frota 1", unitId = "u2", unit = FleetUnit("Mina Sul"))),
            Vehicle(id = "2", plate = "BBB2B22", fleet = Fleet("f2", "Frota 2", unitId = "u1", unit = FleetUnit("Contrato Norte"))),
            Vehicle(id = "3", plate = "CCC3C33", fleet = Fleet("f3", "Frota 3", unitId = "u2", unit = FleetUnit("Mina Sul"))),
            Vehicle(id = "4", plate = "DDD4D44", fleet = Fleet("f4", "Frota antiga")),
        )
        assertEquals(listOf("u1" to "Contrato Norte", "u2" to "Mina Sul"), Rules.vehicleUnits(list))
    }

    @Test fun `assinatura precisa de tracos de verdade`() {
        assertFalse(Rules.hasSignature(emptyList()))
        // Um toque sem querer não vale.
        assertFalse(Rules.hasSignature(listOf(listOf(0.5f, 0.5f))))
        val stroke = (0 until 10).flatMap { listOf(it / 10f, 0.5f) }
        assertTrue(Rules.hasSignature(listOf(stroke)))
    }

    @Test fun `dados com mais de 24 horas estao desatualizados`() {
        val hour = 60 * 60 * 1000L
        assertFalse(Rules.isStale(downloadedAt = 0, now = 100 * hour))
        assertFalse(Rules.isStale(downloadedAt = 10 * hour, now = 30 * hour))
        assertTrue(Rules.isStale(downloadedAt = 10 * hour, now = 35 * hour))
    }

    @Test fun `resultado da inspecao enviada em texto`() {
        fun sent(opened: Int, recurrent: Int) = SentInspection("c", "ABC", "Diário", "x", 0, "LIBERADO", opened, recurrent)
        assertEquals("Sem NC nova", Rules.sentResult(sent(0, 0)))
        assertEquals("1 NC aberta", Rules.sentResult(sent(1, 0)))
        assertEquals("2 NCs abertas · 1 reincidência", Rules.sentResult(sent(2, 1)))
        assertEquals("3 reincidências", Rules.sentResult(sent(0, 3)))
    }

    @Test fun `problema comum preenche a observacao sem repetir`() {
        assertEquals("Desgastado", Rules.appendObservation(null, "Desgastado"))
        assertEquals("Desgastado", Rules.appendObservation("  ", "Desgastado"))
        assertEquals("Desgastado, solto", Rules.appendObservation("Desgastado", "Solto"))
        assertEquals("Pneu desgastado", Rules.appendObservation("Pneu desgastado", "Desgastado"))
    }

    @Test fun `progresso da secao conta os itens respondidos`() {
        val category = TemplateCategory("c", "Rodagem", 0, listOf(item("a"), item("b"), item("c", type = "TEXT")))
        val answers = mapOf("a" to Answer("a", isCompliant = true), "c" to Answer("c", notApplicable = true))
        assertEquals(2 to 3, Rules.sectionProgress(category, answers))
    }

    @Test fun `ultima inspecao do veiculo em texto e inspecionado hoje`() {
        val zone = java.time.ZoneId.of("America/Sao_Paulo")
        val now = java.time.Instant.parse("2026-11-23T15:00:00Z") // 12:00 em São Paulo
        val today = LastInspection("2026-11-23T10:12:00Z", "Maria") // 07:12
        val yesterday = LastInspection("2026-11-22T20:30:00Z", "João") // 17:30 de ontem
        val older = LastInspection("2026-11-20T11:05:00Z")
        assertTrue(Rules.inspectedToday(today, now, zone))
        assertFalse(Rules.inspectedToday(yesterday, now, zone))
        assertFalse(Rules.inspectedToday(null, now, zone))
        assertEquals("Última inspeção: hoje às 07:12 · Maria", Rules.lastInspectionText(today, now, zone))
        assertEquals("Última inspeção: ontem às 17:30 · João", Rules.lastInspectionText(yesterday, now, zone))
        assertEquals("Última inspeção: 20/11 às 08:05", Rules.lastInspectionText(older, now, zone))
        assertEquals("Nenhuma inspeção registrada", Rules.lastInspectionText(null, now, zone))
    }

    @Test
    fun latestInspectionCountsWhatThisPhoneDid() {
        val server = LastInspection("2026-11-22T20:30:00Z", "João")
        fun queued(vehicleId: String, completedAt: String, state: String = "PENDING") = QueuedInspection(
            clientId = "c-$vehicleId-$completedAt",
            payload = SubmitPayload(
                clientId = "c", templateId = "t", templateVersion = 1, vehicleId = vehicleId,
                startedAt = completedAt, completedAt = completedAt, answers = emptyList(),
            ),
            vehicleLabel = "ABC", templateName = "Diário", state = state,
        )
        val sent = SentInspection("s1", "ABC", "Diário", "2026-11-23T09:00:00Z", vehicleId = "v1", sentAt = 0)

        // Sem nada no celular: fica o do servidor.
        assertEquals(server, Rules.latestInspection("v1", server, emptyList(), emptyList(), "Ana"))
        // Na fila esperando envio: conta, com o nome de quem está no celular.
        assertEquals(
            LastInspection("2026-11-23T10:00:00Z", "Ana"),
            Rules.latestInspection("v1", server, listOf(queued("v1", "2026-11-23T10:00:00Z")), listOf(sent), "Ana"),
        )
        // Já aceito pelo servidor depois do download.
        assertEquals(LastInspection("2026-11-23T09:00:00Z", "Ana"), Rules.latestInspection("v1", server, emptyList(), listOf(sent), "Ana"))
        // Recusada ou de outro veículo: não conta.
        assertEquals(
            server,
            Rules.latestInspection("v1", server, listOf(queued("v1", "2026-11-23T10:00:00Z", "REJECTED"), queued("v2", "2026-11-23T11:00:00Z")), emptyList(), "Ana"),
        )
        // Histórico antigo sem veículo não conta; sem nada, null.
        assertEquals(null, Rules.latestInspection("v1", null, emptyList(), listOf(sent.copy(vehicleId = null)), "Ana"))
    }

    @Test
    fun stackAnswerChoicesWhenLabelDoesNotFit() {
        // Celular de 360dp: o cartão tem 296dp. "Não conforme" mede ~84dp na fonte normal.
        assertFalse(Rules.stackAnswerChoices(296f, 84f))
        // Fonte do sistema em 130%: ~109dp, não cabe no botão do meio (~100dp).
        assertTrue(Rules.stackAnswerChoices(296f, 109f))
        // Tela larga aguenta a fonte grande.
        assertFalse(Rules.stackAnswerChoices(400f, 109f))
    }

    @Test
    fun nonCompliantListShowsCriticalFirstAndLimits() {
        assertEquals("Todos os itens conformes.", Rules.nonCompliantList(emptyList()))
        val items = listOf(
            TemplateItem("1", "Pneus"),
            TemplateItem("2", "Freio", isCritical = true),
            TemplateItem("3", "Buzina"),
        )
        assertEquals(
            "3 itens não conformes:\n• Freio (crítico)\n• Pneus\n• Buzina\n\nO gestor vai receber a não conformidade no portal.",
            Rules.nonCompliantList(items),
        )
        val many = (1..7).map { TemplateItem("$it", "Item $it") }
        val text = Rules.nonCompliantList(many, max = 5)
        assertTrue(text.startsWith("7 itens não conformes:\n• Item 1"))
        assertTrue(text.contains("• Item 5\n...e mais 2"))
        assertFalse(text.contains("Item 6"))
        assertTrue(Rules.nonCompliantList(listOf(TemplateItem("1", "Óleo"))).startsWith("1 item não conforme:"))
    }

    @Test
    fun greetingAndDraftAge() {
        assertEquals("Bom dia", Rules.greeting(5))
        assertEquals("Bom dia", Rules.greeting(11))
        assertEquals("Boa tarde", Rules.greeting(12))
        assertEquals("Boa tarde", Rules.greeting(17))
        assertEquals("Boa noite", Rules.greeting(18))
        assertEquals("Boa noite", Rules.greeting(2))

        val zone = java.time.ZoneId.of("America/Sao_Paulo")
        val now = java.time.Instant.parse("2026-11-23T13:00:00Z") // 10:00
        assertEquals("Começada hoje às 07:10" to false, Rules.draftStarted("2026-11-23T10:10:00Z", now, zone))
        // 20:30 de ontem: 13h30 atrás, rascunho antigo.
        assertEquals("Começada ontem às 20:30" to true, Rules.draftStarted("2026-11-22T23:30:00Z", now, zone))
        assertEquals("" to false, Rules.draftStarted("x", now, zone))
    }

    @Test
    fun inspectedTodayIdsMixesServerAndPhone() {
        val zone = java.time.ZoneId.of("America/Sao_Paulo")
        val now = java.time.Instant.parse("2026-11-23T13:00:00Z")
        val vehicles = listOf(
            Vehicle("v1", "AAA1A11", lastInspection = LastInspection("2026-11-23T10:00:00Z")), // servidor: hoje
            Vehicle("v2", "BBB2B22", lastInspection = LastInspection("2026-11-22T10:00:00Z")), // servidor: ontem
            Vehicle("v3", "CCC3C33"),
        )
        val sentToday = SentInspection("s", "CCC3C33", "Diário", "2026-11-23T12:00:00Z", sentAt = 0, vehicleId = "v3")
        assertEquals(setOf("v1", "v3"), Rules.inspectedTodayIds(vehicles, emptyList(), listOf(sentToday), "Ana", now, zone))
    }

    @Test
    fun startActionAsksBeforeRepeatingToday() {
        val other = Draft("c", "v2", "BBB", "t1", "Diário", 1, "2026-11-23T10:00:00Z")
        val same = other.copy(vehicleId = "v1")
        assertEquals(Rules.StartAction.Start, Rules.startAction(null, "v1", "t1", inspectedToday = false, confirmedToday = false))
        assertEquals(Rules.StartAction.AskInspectedToday, Rules.startAction(null, "v1", "t1", inspectedToday = true, confirmedToday = false))
        assertEquals(Rules.StartAction.Start, Rules.startAction(null, "v1", "t1", inspectedToday = true, confirmedToday = true))
        // Rascunho de outro veículo vem antes do aviso de "hoje".
        assertEquals(Rules.StartAction.AskAboutOtherDraft, Rules.startAction(other, "v1", "t1", inspectedToday = true, confirmedToday = false))
        // Retomando o mesmo rascunho: não pergunta nada.
        assertEquals(Rules.StartAction.Start, Rules.startAction(same, "v1", "t1", inspectedToday = true, confirmedToday = false))
    }

    @Test
    fun draftFromRejectedKeepsAnswersOfCurrentItems() {
        val template = Template(
            id = "t1", name = "Diário", version = 3,
            categories = listOf(TemplateCategory("c1", "Geral", items = listOf(TemplateItem("i1", "Pneus"), TemplateItem("i2", "Freio")))),
        )
        val rejected = QueuedInspection(
            clientId = "old",
            payload = SubmitPayload(
                clientId = "old", templateId = "t1", templateVersion = 2, vehicleId = "v1",
                startedAt = "2026-11-23T08:00:00Z", completedAt = "2026-11-23T08:10:00Z",
                answers = listOf(
                    Answer("i1", isCompliant = false, observations = "Careca", localPhoto = "/f/i1.jpg"),
                    Answer("i9", isCompliant = true, localPhoto = "/f/i9.jpg"), // item que saiu do checklist
                ),
                signatureLocal = "/f/assinatura.png",
            ),
            vehicleLabel = "ABC1D23", templateName = "Diário", state = "REJECTED", message = "Versão antiga",
        )
        val now = java.time.Instant.parse("2026-11-23T09:00:00Z")
        val (draft, dropped) = Rules.draftFromRejected(rejected, template, "new", now)
        assertEquals("new", draft.clientId)
        assertEquals(3, draft.templateVersion)
        assertEquals("2026-11-23T09:00:00Z", draft.startedAt)
        assertEquals(setOf("i1"), draft.answers.keys)
        assertEquals("Careca", draft.answers["i1"]?.observations)
        assertEquals("/f/i1.jpg", draft.answers["i1"]?.localPhoto)
        assertTrue(draft.signature.isEmpty())
        assertEquals(listOf("/f/i9.jpg", "/f/assinatura.png"), dropped)
    }
}
