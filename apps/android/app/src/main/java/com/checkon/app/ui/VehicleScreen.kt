package com.checkon.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.checkon.app.data.Draft
import com.checkon.app.data.OpenNc
import com.checkon.app.data.Rules
import com.checkon.app.data.Template
import kotlinx.coroutines.launch

@Composable
fun VehicleScreen(vm: AppViewModel, vehicleId: String, onStart: (vehicleId: String, templateId: String) -> Unit) {
    val bootstrap by vm.bootstrap.collectAsState()
    val online by vm.online.collectAsState()
    val queue by vm.queue.collectAsState()
    val history by vm.history.collectAsState()
    val session by vm.session.collectAsState()
    val vehicle = bootstrap?.vehicles?.firstOrNull { it.id == vehicleId }
    var freshNcs by remember { mutableStateOf<List<OpenNc>?>(null) }
    var pendingDraft by remember { mutableStateOf<Pair<Draft, Template>?>(null) }
    var againToday by remember { mutableStateOf<Template?>(null) }
    val scope = rememberCoroutineScope()

    // Com internet, confere as NCs na hora (outro motorista pode ter apontado algo hoje).
    LaunchedEffect(vehicleId, online) {
        if (online) freshNcs = runCatching { vm.repository.vehicleNcs(vehicleId) }.getOrNull() ?: freshNcs
    }

    if (vehicle == null) {
        CenteredMessage("Veículo não encontrado", "Este veículo não está mais ativo ou ainda não foi baixado. Atualize os dados na tela inicial.")
        return
    }
    val ncs = freshNcs ?: bootstrap?.openNcs?.filter { it.vehicleId == vehicleId } ?: emptyList()
    // Só os checklists que valem na frente de trabalho deste veículo.
    val templates = Rules.templatesForVehicle(bootstrap?.templates ?: emptyList(), vehicle)

    // Última inspeção (servidor + este celular), para evitar inspecionar duas vezes no mesmo dia.
    val last = Rules.latestInspection(vehicle.id, vehicle.lastInspection, queue, history, session?.user?.name)
    val zone = java.time.ZoneId.systemDefault()

    fun start(template: Template, confirmedToday: Boolean = false) {
        scope.launch {
            val draft = vm.repository.readDraft()
            val today = Rules.inspectedToday(last, java.time.Instant.now(), zone)
            when (Rules.startAction(draft, vehicle.id, template.id, today, confirmedToday)) {
                Rules.StartAction.AskAboutOtherDraft -> pendingDraft = draft!! to template
                Rules.StartAction.AskInspectedToday -> againToday = template
                Rules.StartAction.Start -> onStart(vehicle.id, template.id)
            }
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(ScreenPadding),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        AppCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(vehicle.label, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = Palette.Text)
                StatusTag(vehicle.status)
            }
            Muted(
                vehicle.description.ifBlank { "Sem modelo cadastrado" } +
                    (vehicle.fleet?.let { " · Frota ${it.name}" } ?: "") +
                    (vehicle.fleet?.unit?.let { " · ${it.name}" } ?: ""),
            )
            // Evita inspecionar de novo o que um colega acabou de inspecionar.
            val now = java.time.Instant.now()
            val today = Rules.inspectedToday(last, now, zone)
            Text(
                Rules.lastInspectionText(last, now, zone),
                color = if (today) Palette.Info else Palette.Muted,
                fontSize = 14.sp,
                fontWeight = if (today) FontWeight.SemiBold else FontWeight.Normal,
            )
        }
        if (vehicle.status == "BLOQUEADO") {
            Banner("Veículo bloqueado", "Este veículo tem problema crítico em aberto e não deve circular até ser liberado pelo gestor.", Tone.Danger)
        }

        SectionTitle("Escolha o checklist")
        if (templates.isEmpty()) Muted("Não há checklist ativo para a frente de trabalho deste veículo. Fale com o seu gestor.")
        templates.forEach { template ->
            AppCard(onClick = { start(template) }) {
                IconRow(Icons.AutoMirrored.Filled.Assignment, Palette.Primary) {
                    Column {
                        Text(template.name, fontWeight = FontWeight.Bold, color = Palette.Text)
                        Muted(Rules.plural(template.allItems.size, "item", "itens") + (template.description?.let { " · $it" } ?: ""))
                    }
                }
            }
        }

        SectionTitle("NCs em aberto (${ncs.size})")
        if (ncs.isEmpty()) Muted("Nenhuma não conformidade em aberto neste veículo.")
        ncs.forEach { nc ->
            AppCard(accent = if (nc.severity == "CRITICAL") Palette.Danger else Palette.Warning) {
                Text(nc.item?.text ?: "Item do checklist", fontWeight = FontWeight.Bold, color = Palette.Text)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Tag("Gravidade ${Rules.SEVERITY_LABEL[nc.severity] ?: nc.severity}", if (nc.severity == "CRITICAL") Tone.Danger else Tone.Warning)
                    Tag(if (nc.status == "IN_PROGRESS") "Em tratamento" else "Aberta", Tone.Info)
                    if (nc.occurrences > 1) Tag("${nc.occurrences}x apontada")
                }
                nc.notes?.takeIf { it.isNotBlank() }?.let { Muted(it) }
                Muted("Desde ${formatDateTime(nc.createdAt)}")
            }
        }
    }

    pendingDraft?.let { (draft, template) ->
        AlertDialog(
            onDismissRequest = { pendingDraft = null },
            title = { Text("Inspeção em andamento") },
            text = { Text("Você começou uma inspeção do veículo ${draft.vehicleLabel} (${draft.templateName}) e não concluiu. O que deseja fazer?") },
            confirmButton = {
                TextButton(onClick = {
                    pendingDraft = null
                    onStart(draft.vehicleId, draft.templateId)
                }) { Text("Continuar a anterior") }
            },
            dismissButton = {
                TextButton(onClick = {
                    pendingDraft = null
                    scope.launch {
                        draft.answers.values.forEach { vm.repository.photos.delete(it.localPhoto) }
                        vm.repository.saveDraft(null)
                        onStart(vehicle.id, template.id)
                    }
                }) { Text("Descartar e começar esta", color = Palette.Danger) }
            },
        )
    }
    againToday?.let { template ->
        AlertDialog(
            onDismissRequest = { againToday = null },
            title = { Text("Já inspecionado hoje") },
            text = {
                Text(
                    "${Rules.lastInspectionText(last, java.time.Instant.now(), zone)}.\n\n" +
                        "Faça outra só se algo mudou (troca de turno, problema novo). Senão, o gestor recebe inspeções repetidas.",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    againToday = null
                    start(template, confirmedToday = true)
                }) { Text("Fazer outra") }
            },
            dismissButton = { TextButton(onClick = { againToday = null }) { Text("Cancelar") } },
        )
    }
}
