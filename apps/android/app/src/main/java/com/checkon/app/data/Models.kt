package com.checkon.app.data

import kotlinx.serialization.Serializable

/** Formatos da API do CHECK-ON (rotas de login do app e do celular). */

@Serializable
data class SessionUser(
    val id: String,
    val name: String,
    val tenantId: String,
    val tenantName: String = "",
    val tenantCode: String? = null,
    val role: String = "",
)

@Serializable
data class Session(val accessToken: String, val refreshToken: String, val user: SessionUser)

@Serializable
data class TokenResponse(
    @kotlinx.serialization.SerialName("access_token") val accessToken: String,
    @kotlinx.serialization.SerialName("refresh_token") val refreshToken: String,
    val user: SessionUser,
)

@Serializable
data class TemplateItem(
    val id: String,
    val text: String,
    val type: String = "PASS_FAIL", // PASS_FAIL, TEXT, NUMBER, PHOTO
    val isRequired: Boolean = true,
    val isCritical: Boolean = false,
    val photoRequirement: String = "NONE", // NONE, ON_NON_COMPLIANCE, ALWAYS
    val order: Int = 0,
)

@Serializable
data class TemplateCategory(val id: String, val name: String, val order: Int = 0, val items: List<TemplateItem> = emptyList())

@Serializable
data class Template(
    val id: String,
    val name: String,
    val description: String? = null,
    val version: Int = 1,
    val categories: List<TemplateCategory> = emptyList(),
    /** Vale em todas as frentes de trabalho. Falso: só nos veículos das frentes em [units]. */
    val allUnits: Boolean = true,
    val units: List<TemplateUnit> = emptyList(),
) {
    val allItems: List<TemplateItem> get() = categories.flatMap { it.items }
}

@Serializable
data class TemplateUnit(val unitId: String)

@Serializable
data class Fleet(val id: String, val name: String, val unitId: String? = null, val unit: FleetUnit? = null)

/** Frente de trabalho da frota (só o nome; o filtro usa Fleet.unitId). */
@Serializable
data class FleetUnit(val name: String)

@Serializable
data class Vehicle(
    val id: String,
    val plate: String,
    val prefix: String? = null,
    val brand: String? = null,
    val model: String? = null,
    val year: Int? = null,
    val status: String = "LIBERADO", // LIBERADO, ATENCAO, BLOQUEADO
    val qrCode: String? = null,
    val fleet: Fleet? = null,
) {
    val label: String get() = if (prefix.isNullOrBlank()) plate else "$plate · $prefix"
    val description: String get() = listOfNotNull(brand, model, year?.toString()).joinToString(" ")
}

@Serializable
data class NcItem(val text: String, val isCritical: Boolean = false)

@Serializable
data class OpenNc(
    val id: String,
    val vehicleId: String,
    val itemId: String,
    val status: String,
    val severity: String,
    val notes: String? = null,
    val occurrences: Int = 1,
    val createdAt: String? = null,
    val item: NcItem? = null,
)

@Serializable
data class Bootstrap(
    val templates: List<Template> = emptyList(),
    val vehicles: List<Vehicle> = emptyList(),
    val openNcs: List<OpenNc> = emptyList(),
    /** Quando o celular baixou estes dados (preenchido no app, em milissegundos). */
    val downloadedAt: Long = 0,
)

/** Resposta de um item, como o app guarda até enviar. */
@Serializable
data class Answer(
    val itemId: String,
    val isCompliant: Boolean? = null,
    /** "Não se aplica": o item não existe neste veículo (não abre NC). */
    val notApplicable: Boolean? = null,
    val textValue: String? = null,
    val numberValue: Double? = null,
    val observations: String? = null,
    /** Foto ainda no celular (caminho do arquivo). Não vai para a API. */
    val localPhoto: String? = null,
    /** Endereço da foto depois de enviada (POST /checklists/photos). */
    val photoUrl: String? = null,
)

/** Inspeção em andamento: salva a cada resposta. */
@Serializable
data class Draft(
    val clientId: String,
    val vehicleId: String,
    val vehicleLabel: String,
    val templateId: String,
    val templateName: String,
    val templateVersion: Int,
    val startedAt: String,
    val answers: Map<String, Answer> = emptyMap(),
)

/** Corpo do POST /checklists/sync (cada item). */
@Serializable
data class SubmitPayload(
    val clientId: String,
    val templateId: String,
    val templateVersion: Int,
    val vehicleId: String,
    val startedAt: String,
    val completedAt: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val answers: List<Answer>,
)

/** Inspeção na fila de envio do celular. */
@Serializable
data class QueuedInspection(
    val clientId: String,
    val payload: SubmitPayload,
    val vehicleLabel: String,
    val templateName: String,
    /** PENDING: aguardando envio. REJECTED: o servidor recusou e a pessoa precisa ver o motivo. */
    val state: String = "PENDING",
    val message: String? = null,
    val attempts: Int = 0,
)

@Serializable
data class SyncResult(
    val status: String, // CREATED, DUPLICATE, REJECTED, RETRY
    val clientId: String,
    val message: String? = null,
)

@Serializable
data class SyncResponse(val results: List<SyncResult>)

@Serializable
data class SyncRequest(val checklists: List<SubmitPayload>)

@Serializable
data class PhotoResponse(val photoUrl: String)
