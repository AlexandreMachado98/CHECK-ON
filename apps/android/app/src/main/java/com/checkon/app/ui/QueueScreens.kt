package com.checkon.app.ui

import androidx.compose.animation.graphics.res.animatedVectorResource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.checkon.app.data.QueuedInspection
import com.checkon.app.data.SentInspection
import com.checkon.app.data.Rules
import kotlinx.coroutines.launch

@Composable
fun DoneScreen(
    vm: AppViewModel,
    clientId: String,
    onNew: () -> Unit,
    onHome: () -> Unit,
    onOpenInspection: (vehicleId: String, templateId: String) -> Unit,
) {
    val queue by vm.queue.collectAsState()
    val syncing by vm.syncing.collectAsState()
    val online by vm.online.collectAsState()
    val history by vm.history.collectAsState()
    val redo = rememberRedo(vm, onOpenInspection)
    // Guarda a última versão vista: ao refazer, a inspeção sai da fila sem ter sido enviada.
    var lastItem by remember { mutableStateOf<QueuedInspection?>(null) }
    val inQueue = queue.firstOrNull { it.clientId == clientId }
    androidx.compose.runtime.SideEffect { if (inQueue != null) lastItem = inQueue }
    val item = if (redo.busy) inQueue ?: lastItem else inQueue
    val sent = item == null
    val rejected = item?.state == "REJECTED"
    // Resultado devolvido pelo servidor (situação do veículo e NCs), quando já foi aceita.
    val result = history.firstOrNull { it.clientId == clientId }
    // Quantos veículos já foram inspecionados hoje (contando esta).
    val bootstrap by vm.bootstrap.collectAsState()
    val session by vm.session.collectAsState()
    val vehicles = bootstrap?.vehicles ?: emptyList()
    val inspectedToday = Rules.inspectedTodayIds(
        vehicles, queue, history, session?.user?.name, java.time.Instant.now(), java.time.ZoneId.systemDefault(),
    ).size
    // Vibra uma vez quando o servidor aceita (na hora ou quando a internet volta com a tela aberta).
    val view = androidx.compose.ui.platform.LocalView.current
    var celebrated by androidx.compose.runtime.saveable.rememberSaveable { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(sent) {
        if (sent && !celebrated) {
            celebrated = true
            view.answerHaptic(AnswerFeel.Confirm)
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(ScreenPadding),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(32.dp))
        if (sent) {
            // Mesmo desenho do logo: o arco se preenche e o "V" de ok aparece.
            SuccessMark(Modifier.size(120.dp))
        } else {
            Icon(
                if (rejected) Icons.Filled.ErrorOutline else Icons.Filled.CloudUpload,
                contentDescription = null,
                tint = if (rejected) Palette.Danger else Palette.Warning,
                modifier = Modifier.size(88.dp),
            )
        }
        Text(
            when {
                sent -> "Inspeção enviada"
                rejected -> "Inspeção recusada"
                syncing -> "Enviando..."
                else -> "Inspeção guardada"
            },
            fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = Palette.Text, textAlign = TextAlign.Center,
        )
        Muted(
            when {
                sent -> "O gestor já pode ver a inspeção no portal."
                rejected -> "O servidor não aceitou esta inspeção. Veja o motivo abaixo."
                online -> "Está sendo enviada agora. Você pode continuar usando o aplicativo."
                else -> "Ela fica guardada no celular e é enviada sozinha quando a internet voltar."
            },
            Modifier.fillMaxWidth(),
        )
        if (sent && result != null) SentResultCard(result)
        if (rejected) Banner("Motivo", item?.message, Tone.Danger)
        if (rejected && item != null && redo.canRedo(item)) PrimaryButton("Refazer com estas respostas", onClick = { redo.start(item) })
        if (item?.state == "PENDING" && online && !syncing) SecondaryButton("Tentar enviar agora", onClick = vm::syncNow)
        if (!rejected && vehicles.size > 1) {
            Muted(
                if (inspectedToday >= vehicles.size) "Todos os ${vehicles.size} veículos já foram inspecionados hoje."
                else "Hoje: $inspectedToday de ${vehicles.size} veículos inspecionados.",
                Modifier.fillMaxWidth(),
            )
        }
        PrimaryButton("Nova inspeção", onClick = onNew)
        SecondaryButton("Voltar ao início", onClick = onHome)
    }
}

@Composable
fun QueueScreen(vm: AppViewModel, onOpenInspection: (vehicleId: String, templateId: String) -> Unit) {
    val queue by vm.queue.collectAsState()
    val syncing by vm.syncing.collectAsState()
    val online by vm.online.collectAsState()
    val lastSync by vm.lastSync.collectAsState()
    val history by vm.history.collectAsState()
    var toDiscard by remember { mutableStateOf<QueuedInspection?>(null) }
    val pending = queue.count { it.state == "PENDING" }
    val redo = rememberRedo(vm, onOpenInspection)

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(ScreenPadding),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (!online && pending > 0) Banner("Sem internet", "As inspeções serão enviadas sozinhas quando a conexão voltar.", Tone.Info)
        lastSync?.error?.let { Banner("Erro no último envio", it, Tone.Danger) }
        if (pending > 0) PrimaryButton(if (syncing) "Enviando..." else "Enviar agora ($pending)", onClick = vm::syncNow, loading = syncing, enabled = online)
        if (queue.isEmpty()) Muted("Tudo enviado. Nenhuma inspeção guardada neste celular.", Modifier.fillMaxWidth().padding(top = 8.dp))
        queue.forEach { item ->
            val photos = item.payload.answers.count { it.localPhoto != null }
            AppCard(accent = if (item.state == "REJECTED") Palette.Danger else Palette.Warning) {
                Text("${item.vehicleLabel} · ${item.templateName}", fontWeight = FontWeight.Bold, color = Palette.Text)
                Muted("Feita em ${formatDateTime(item.payload.completedAt)}" + if (photos > 0) " · ${Rules.plural(photos, "foto", "fotos")}" else "")
                Tag(if (item.state == "REJECTED") "Recusada" else "Aguardando envio", if (item.state == "REJECTED") Tone.Danger else Tone.Warning)
                if (item.state == "REJECTED") {
                    Text(item.message ?: "", color = Palette.Danger)
                    if (redo.canRedo(item)) SecondaryButton("Refazer com estas respostas", onClick = { redo.start(item) })
                    SecondaryButton("Apagar do celular", onClick = { toDiscard = item })
                }
            }
        }
        if (history.isNotEmpty()) {
            SectionTitle("Enviadas por este celular")
            history.forEach { sentItem -> SentInspectionCard(sentItem) }
            Muted("Mostra as últimas ${history.size} enviadas. O histórico completo fica no portal.", Modifier.fillMaxWidth())
        }
    }

    toDiscard?.let { item ->
        AlertDialog(
            onDismissRequest = { toDiscard = null },
            title = { Text("Apagar esta inspeção?") },
            text = { Text("${item.vehicleLabel} · ${item.templateName}\n\nEla foi recusada pelo servidor e será apagada deste celular. Se precisar, faça a inspeção de novo.") },
            confirmButton = { TextButton(onClick = { vm.discard(item.clientId); toDiscard = null }) { Text("Apagar", color = Palette.Danger) } },
            dismissButton = { TextButton(onClick = { toDiscard = null }) { Text("Cancelar") } },
        )
    }
}

/** Inspeção aceita pelo servidor (histórico do celular). */
@Composable
fun SentInspectionCard(item: SentInspection) {
    AppCard {
        Text("${item.vehicleLabel} · ${item.templateName}", fontWeight = FontWeight.Bold, color = Palette.Text)
        Muted("Feita em ${formatDateTime(item.completedAt)} · enviada ${formatMillis(item.sentAt)}")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            item.vehicleStatus?.let { StatusTag(it) }
            Text(
                Rules.sentResult(item),
                color = if (item.ncsOpened + item.ncsRecurrent > 0) Palette.Warning else Palette.Muted,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

/** Resultado da inspeção recém-enviada (tela de conclusão). */
@Composable
private fun SentResultCard(item: SentInspection) {
    val tone = when (item.vehicleStatus) {
        "BLOQUEADO" -> Tone.Danger
        "ATENCAO" -> Tone.Warning
        else -> Tone.Success
    }
    Banner(
        title = "Veículo ${Rules.STATUS_LABEL[item.vehicleStatus] ?: "registrado"} · ${Rules.sentResult(item)}",
        text = when (item.vehicleStatus) {
            "BLOQUEADO" -> "Há problema crítico em aberto. O veículo não deve circular até ser liberado pelo gestor."
            "ATENCAO" -> "Há não conformidade em aberto. O gestor vai tratar no portal."
            else -> null
        },
        tone = tone,
    )
}

/** Marca de sucesso animada (logo do app): toca uma vez ao aparecer. */
@OptIn(androidx.compose.animation.graphics.ExperimentalAnimationGraphicsApi::class)
@Composable
private fun SuccessMark(modifier: Modifier) {
    val image = androidx.compose.animation.graphics.vector.AnimatedImageVector.animatedVectorResource(com.checkon.app.R.drawable.ic_logo_animated)
    var atEnd by remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(Unit) { atEnd = true }
    androidx.compose.foundation.Image(
        painter = androidx.compose.animation.graphics.res.rememberAnimatedVectorPainter(image, atEnd),
        contentDescription = "Inspeção enviada",
        modifier = modifier,
    )
}

/**
 * "Refazer com estas respostas" de uma inspeção recusada: confere se o veículo e o checklist
 * ainda estão ativos e se não há outra inspeção em andamento; então abre a inspeção já preenchida.
 */
private class Redo(
    val canRedo: (QueuedInspection) -> Boolean,
    val start: (QueuedInspection) -> Unit,
    /** Refazendo agora: a inspeção sai da fila, mas não foi "enviada". */
    val busy: Boolean,
)

@Composable
private fun rememberRedo(vm: AppViewModel, onOpenInspection: (vehicleId: String, templateId: String) -> Unit): Redo {
    val bootstrap by vm.bootstrap.collectAsState()
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var blocked by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    blocked?.let { text ->
        AlertDialog(
            onDismissRequest = { blocked = null },
            title = { Text("Inspeção em andamento") },
            text = { Text(text) },
            confirmButton = { TextButton(onClick = { blocked = null }) { Text("Ok") } },
        )
    }
    fun templateOf(item: QueuedInspection) = bootstrap?.let { data ->
        val vehicle = data.vehicles.firstOrNull { it.id == item.payload.vehicleId } ?: return@let null
        Rules.templatesForVehicle(data.templates, vehicle).firstOrNull { it.id == item.payload.templateId }
    }
    return Redo(
        canRedo = { item -> item.state == "REJECTED" && templateOf(item) != null },
        start = { item ->
            scope.launch {
                val template = templateOf(item) ?: return@launch
                val current = vm.repository.readDraft()
                if (current != null) {
                    blocked = "Você já tem uma inspeção começada (${current.vehicleLabel} · ${current.templateName}). " +
                        "Conclua ou descarte essa antes de refazer a recusada."
                    return@launch
                }
                busy = true
                val draft = vm.redoRejected(item.clientId, template)
                if (draft == null) {
                    busy = false
                    return@launch
                }
                onOpenInspection(draft.vehicleId, draft.templateId)
            }
        },
        busy = busy,
    )
}
