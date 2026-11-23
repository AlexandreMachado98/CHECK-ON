package com.checkon.app.data

import java.text.Normalizer
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Regras da inspeção, iguais às da API (apps/api/src/checklist/checklist-rules.ts),
 * para avisar o motorista antes de salvar, mesmo sem internet. Quem decide é a API.
 */
object Rules {

    /** Prefixo do QR Code impresso pelo portal (Veículos → QR Code). */
    const val VEHICLE_QR_PREFIX = "CHECKON:VEICULO:"

    fun hasPhoto(answer: Answer?): Boolean = !answer?.photoUrl.isNullOrBlank() || !answer?.localPhoto.isNullOrBlank()

    fun isNotApplicable(answer: Answer?): Boolean = answer?.notApplicable == true

    fun isAnswered(item: TemplateItem, answer: Answer?): Boolean {
        if (answer == null) return false
        if (isNotApplicable(answer)) return true
        return when (item.type) {
            "TEXT" -> !answer.textValue.isNullOrBlank()
            "NUMBER" -> answer.numberValue?.isFinite() == true
            "PHOTO" -> hasPhoto(answer)
            else -> answer.isCompliant != null
        }
    }

    fun isCompliant(item: TemplateItem, answer: Answer?): Boolean =
        if (item.type == "PASS_FAIL") answer?.isCompliant == true else answer?.isCompliant != false

    /** Item que pede foto agora: item de foto, foto sempre exigida ou apontado como não conforme. */
    fun showsPhoto(item: TemplateItem, answer: Answer?): Boolean =
        !isNotApplicable(answer) && (item.type == "PHOTO" || item.photoRequirement == "ALWAYS" ||
            (item.photoRequirement == "ON_NON_COMPLIANCE" && answer?.isCompliant == false))

    private fun photoRequired(item: TemplateItem, compliant: Boolean): Boolean {
        if (item.type == "PHOTO") return false // a própria foto é a resposta
        if (item.photoRequirement == "ALWAYS") return true
        return item.photoRequirement == "ON_NON_COMPLIANCE" && !compliant
    }

    data class Pendency(val itemId: String, val message: String)

    /** O que falta para concluir a inspeção. */
    fun pendingItems(template: Template, answers: Map<String, Answer>): List<Pendency> {
        val result = mutableListOf<Pendency>()
        for (item in template.allItems) {
            val answer = answers[item.id]
            // N/A em item crítico: o motivo é obrigatório (mesma regra da API).
            if (isNotApplicable(answer)) {
                if (item.isCritical && answer?.observations.isNullOrBlank()) {
                    result += Pendency(item.id, "Informe o motivo do N/A: ${item.text}")
                }
                continue
            }
            if (!isAnswered(item, answer)) {
                if (item.isRequired) result += Pendency(item.id, "Responda: ${item.text}")
                if (answer == null || answer.isCompliant != false) continue
            }
            if (photoRequired(item, isCompliant(item, answer)) && !hasPhoto(answer)) {
                result += Pendency(
                    item.id,
                    if (item.photoRequirement == "ALWAYS") "Tire a foto: ${item.text}" else "Tire a foto do problema: ${item.text}",
                )
            }
        }
        return result
    }

    /** Problemas comuns: um toque preenche a observação do item não conforme. */
    val QUICK_PROBLEMS = listOf("Desgastado", "Quebrado", "Vazamento", "Solto", "Faltando", "Não funciona", "Amassado", "Sujo")

    /**
     * Acrescenta um problema comum à observação: "Desgastado" → "Desgastado, solto".
     * Não repete o que já está escrito e respeita o limite de 2000 caracteres.
     */
    fun appendObservation(current: String?, problem: String): String {
        val text = current?.trim().orEmpty()
        if (text.isEmpty()) return problem
        if (text.contains(problem, ignoreCase = true)) return text
        return "$text, ${problem.lowercase()}".take(2000)
    }

    /** Itens respondidos e total da seção (para o título: "RODAGEM · 3/5"). */
    fun sectionProgress(category: TemplateCategory, answers: Map<String, Answer>): Pair<Int, Int> =
        category.items.count { isAnswered(it, answers[it.id]) } to category.items.size

    /** Inspeção concluída hoje (no fuso do celular). */
    fun inspectedToday(last: LastInspection?, now: Instant, zone: ZoneId): Boolean {
        val date = last?.let { runCatching { Instant.parse(it.completedAt) }.getOrNull() } ?: return false
        return date.atZone(zone).toLocalDate() == now.atZone(zone).toLocalDate()
    }

    /**
     * Última inspeção do veículo juntando o que veio do servidor com o que foi feito neste celular
     * (na fila esperando envio ou já aceito depois do último download). Assim "Inspecionado hoje"
     * aparece na hora, mesmo sem internet. Inspeção recusada pelo servidor não conta.
     */
    fun latestInspection(
        vehicleId: String,
        server: LastInspection?,
        queue: List<QueuedInspection>,
        history: List<SentInspection>,
        myName: String?,
    ): LastInspection? {
        val local = queue.filter { it.state != "REJECTED" && it.payload.vehicleId == vehicleId }.map { it.payload.completedAt } +
            history.filter { it.vehicleId == vehicleId }.map { it.completedAt }
        val candidates = listOfNotNull(server) + local.map { LastInspection(it, myName) }
        return candidates
            .mapNotNull { last -> runCatching { Instant.parse(last.completedAt) }.getOrNull()?.let { it to last } }
            .maxByOrNull { it.first }?.second ?: server
    }

    /** "Última inspeção: hoje às 07:12 · Maria" / "ontem às ..." / "21/11 às ...". */
    fun lastInspectionText(last: LastInspection?, now: Instant, zone: ZoneId): String {
        val date = last?.let { runCatching { Instant.parse(it.completedAt) }.getOrNull() } ?: return "Nenhuma inspeção registrada"
        val local = date.atZone(zone)
        val today = now.atZone(zone).toLocalDate()
        val time = local.format(DateTimeFormatter.ofPattern("HH:mm"))
        val day = when (local.toLocalDate()) {
            today -> "hoje"
            today.minusDays(1) -> "ontem"
            else -> local.format(DateTimeFormatter.ofPattern("dd/MM"))
        }
        val who = last.driverName?.takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""
        return "Última inspeção: $day às $time$who"
    }

    /** Dados do celular com mais de 24 horas: vale avisar para atualizar. */
    fun isStale(downloadedAt: Long, now: Long): Boolean = downloadedAt > 0 && now - downloadedAt > 24 * 60 * 60 * 1000L

    /** Resultado de uma inspeção enviada, em texto: "1 NC aberta" / "Sem NC nova". */
    fun sentResult(item: SentInspection): String = when {
        item.ncsOpened > 0 && item.ncsRecurrent > 0 ->
            "${plural(item.ncsOpened, "NC aberta", "NCs abertas")} · ${plural(item.ncsRecurrent, "reincidência", "reincidências")}"
        item.ncsOpened > 0 -> plural(item.ncsOpened, "NC aberta", "NCs abertas")
        item.ncsRecurrent > 0 -> plural(item.ncsRecurrent, "reincidência", "reincidências")
        else -> "Sem NC nova"
    }

    /** Assinatura válida: traços de verdade, não um toque sem querer (pelo menos 8 pontos). */
    fun hasSignature(strokes: List<List<Float>>): Boolean = strokes.sumOf { it.size / 2 } >= 8

    /**
     * "Marcar conformes" de uma seção: só os itens Conforme/Não conforme ainda sem resposta.
     * Nunca muda o que já foi respondido (Não conforme, N/A ou Conforme). Foto exigida continua exigida.
     */
    fun unansweredPassFail(category: TemplateCategory, answers: Map<String, Answer>): List<TemplateItem> =
        category.items.filter { item ->
            val answer = answers[item.id]
            item.type == "PASS_FAIL" && !isNotApplicable(answer) && answer?.isCompliant == null
        }

    /** Respostas depois de marcar como conformes os itens sem resposta da seção. */
    fun markSectionCompliant(category: TemplateCategory, answers: Map<String, Answer>): Map<String, Answer> =
        answers + unansweredPassFail(category, answers).associate { item ->
            item.id to (answers[item.id] ?: Answer(itemId = item.id)).copy(isCompliant = true, notApplicable = null)
        }

    /**
     * Próximo item a responder, na ordem do checklist: o primeiro sem resposta ou com
     * algo faltando (foto, motivo do N/A). Null quando não falta nada.
     */
    fun nextToAnswer(template: Template, answers: Map<String, Answer>): String? {
        val pending = pendingItems(template, answers).map { it.itemId }.toSet()
        return template.allItems.firstOrNull { it.id in pending || !isAnswered(it, answers[it.id]) }?.id
    }

    /** Respostas que vão para a API: só itens respondidos, sem campos vazios. */
    fun answersToSend(template: Template, answers: Map<String, Answer>): List<Answer> =
        template.allItems.mapNotNull { item ->
            val answer = answers[item.id] ?: return@mapNotNull null
            if (isNotApplicable(answer)) {
                return@mapNotNull Answer(itemId = item.id, notApplicable = true, observations = answer.observations?.trim()?.takeIf { it.isNotEmpty() })
            }
            if (!isAnswered(item, answer) && answer.isCompliant != false) return@mapNotNull null
            Answer(
                itemId = item.id,
                isCompliant = answer.isCompliant,
                textValue = answer.textValue?.trim()?.takeIf { item.type == "TEXT" && it.isNotEmpty() },
                numberValue = answer.numberValue?.takeIf { item.type == "NUMBER" },
                observations = answer.observations?.trim()?.takeIf { it.isNotEmpty() },
                localPhoto = answer.localPhoto,
                photoUrl = answer.photoUrl,
            )
        }

    /** "12,5" ou "12.5" → 12.5. Texto inválido → null. */
    fun parseNumber(text: String): Double? {
        val normalized = text.trim().replace(" ", "").replace(',', '.')
        if (!Regex("^-?\\d+(\\.\\d+)?$").matches(normalized)) return null
        return normalized.toDoubleOrNull()?.takeIf { it.isFinite() }
    }

    /** Placa sem traço, espaço ou diferença de maiúsculas: "abc-1d23" → "ABC1D23". */
    fun normalizePlate(value: String): String = value.uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }

    /** Código da empresa como a API espera: sem espaços e em maiúsculas. */
    fun normalizeCompanyCode(value: String): String = value.filterNot { it.isWhitespace() }.uppercase()

    /**
     * Acha o veículo pelo conteúdo do QR Code, sem internet: aceita o QR do portal,
     * o código de QR cadastrado no veículo ou a placa/prefixo escritos no QR.
     */
    fun findVehicleByQr(vehicles: List<Vehicle>, raw: String): Vehicle? {
        val data = raw.trim()
        if (data.isEmpty()) return null
        if (data.uppercase().startsWith(VEHICLE_QR_PREFIX)) {
            val id = data.substring(VEHICLE_QR_PREFIX.length).trim()
            return vehicles.firstOrNull { it.id == id }
        }
        vehicles.firstOrNull { it.qrCode != null && it.qrCode == data }?.let { return it }
        val plate = normalizePlate(data)
        if (plate.isEmpty()) return null
        return vehicles.firstOrNull { normalizePlate(it.plate) == plate }
            ?: vehicles.firstOrNull { it.prefix != null && normalizePlate(it.prefix) == plate }
    }

    /** Filtro da lista de veículos: placa, prefixo, marca, modelo ou frota. */
    fun matchesVehicle(vehicle: Vehicle, query: String): Boolean {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return true
        val plate = normalizePlate(q)
        if (plate.isNotEmpty() && normalizePlate(vehicle.plate).contains(plate)) return true
        return listOfNotNull(vehicle.prefix, vehicle.brand, vehicle.model, vehicle.fleet?.name)
            .any { it.lowercase().contains(q) }
    }

    /** "1 foto" / "3 fotos": número com a palavra no singular ou no plural. */
    fun plural(count: Int, singular: String, plural: String): String = "$count ${if (count == 1) singular else plural}"

    /**
     * Checklists que valem para o veículo: os de todas as frentes e os da frente de trabalho dele.
     * Sem a frente do veículo (servidor antigo), mostra todos, como antes.
     */
    fun templatesForVehicle(templates: List<Template>, vehicle: Vehicle): List<Template> {
        val unitId = vehicle.fleet?.unitId ?: return templates
        return templates.filter { it.allUnits || it.units.any { unit -> unit.unitId == unitId } }
    }

    /** Frentes de trabalho dos veículos (id → nome), na ordem do nome. Vazio se o servidor não informa. */
    fun vehicleUnits(vehicles: List<Vehicle>): List<Pair<String, String>> =
        vehicles.mapNotNull { vehicle ->
            val id = vehicle.fleet?.unitId ?: return@mapNotNull null
            id to (vehicle.fleet.unit?.name ?: "Frente")
        }.distinctBy { it.first }.sortedBy { it.second.lowercase() }

    val STATUS_LABEL = mapOf("LIBERADO" to "Liberado", "ATENCAO" to "Atenção", "BLOQUEADO" to "Bloqueado")
    val SEVERITY_LABEL = mapOf("LOW" to "Baixa", "MEDIUM" to "Média", "HIGH" to "Alta", "CRITICAL" to "Crítica")

    /** Texto do aparelho só com ASCII (o cabeçalho HTTP não aceita acentos). */
    fun asciiOnly(text: String): String =
        Normalizer.normalize(text, Normalizer.Form.NFD).filter { it.code in 0x20..0x7e }.take(200)
}
