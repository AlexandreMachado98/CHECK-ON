package com.checkon.app.ui

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
import androidx.compose.material.icons.filled.CheckCircle
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

@Composable
fun DoneScreen(vm: AppViewModel, clientId: String, onNew: () -> Unit, onHome: () -> Unit) {
    val queue by vm.queue.collectAsState()
    val syncing by vm.syncing.collectAsState()
    val online by vm.online.collectAsState()
    val history by vm.history.collectAsState()
    val item = queue.firstOrNull { it.clientId == clientId }
    val sent = item == null
    val rejected = item?.state == "REJECTED"
    // Resultado devolvido pelo servidor (situação do veículo e NCs), quando já foi aceita.
    val result = history.firstOrNull { it.clientId == clientId }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(ScreenPadding),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(32.dp))
        Icon(
            when {
                sent -> Icons.Filled.CheckCircle
                rejected -> Icons.Filled.ErrorOutline
                else -> Icons.Filled.CloudUpload
            },
            contentDescription = null,
            tint = when {
                sent -> Palette.Primary
                rejected -> Palette.Danger
                else -> Palette.Warning
            },
            modifier = Modifier.size(88.dp),
        )
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
        if (item?.state == "PENDING" && online && !syncing) SecondaryButton("Tentar enviar agora", onClick = vm::syncNow)
        PrimaryButton("Nova inspeção", onClick = onNew)
        SecondaryButton("Voltar ao início", onClick = onHome)
    }
}

@Composable
fun QueueScreen(vm: AppViewModel) {
    val queue by vm.queue.collectAsState()
    val syncing by vm.syncing.collectAsState()
    val online by vm.online.collectAsState()
    val lastSync by vm.lastSync.collectAsState()
    val history by vm.history.collectAsState()
    var toDiscard by remember { mutableStateOf<QueuedInspection?>(null) }
    val pending = queue.count { it.state == "PENDING" }

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
