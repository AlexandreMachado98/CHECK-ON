@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.checkon.app.ui

import android.content.Context
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.Assignment
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.checkon.app.R
import com.checkon.app.data.ApiException
import com.checkon.app.data.Draft
import com.checkon.app.data.Rules
import com.checkon.app.data.Vehicle
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(vm: AppViewModel) {
    val sessionMessage by vm.sessionMessage.collectAsState()
    var companyCode by rememberSaveable { mutableStateOf(vm.repository.sessions.lastCompanyCode) }
    var matricula by rememberSaveable { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val matriculaFocus = remember { FocusRequester() }

    fun submit() {
        val code = Rules.normalizeCompanyCode(companyCode)
        val mat = matricula.trim()
        if (code.isEmpty() || mat.isEmpty()) {
            error = if (code.isEmpty()) "Informe o código da empresa." else "Informe a sua matrícula."
            return
        }
        error = null
        loading = true
        scope.launch {
            try {
                vm.login(code, mat)
            } catch (e: ApiException) {
                error = e.message
            } finally {
                loading = false
            }
        }
    }

    Column(
        Modifier.fillMaxSize().background(Palette.Background).imePadding().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterVertically),
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            // Tema antes do login: quem usa o app à noite já entra no escuro.
            androidx.compose.foundation.layout.Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                ThemeButton(vm.themeSettings)
            }
            // Mesmo desenho do ícone do app (medidor em C com check) sobre o fundo azul-noite.
            Box(
                Modifier
                    .size(84.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF0F2A2A), Color(0xFF020617)))),
                contentAlignment = Alignment.Center,
            ) {
                Image(
                    painterResource(R.drawable.ic_launcher_foreground),
                    contentDescription = "CHECK-ON",
                    modifier = Modifier.requiredSize(126.dp),
                )
            }
            Spacer(Modifier.height(10.dp))
            Text("CHECK-ON", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = Palette.Text)
            Muted("Inspeção de veículos")
        }
        if (sessionMessage != null && error == null) Banner("Entre de novo", sessionMessage, Tone.Warning)
        OutlinedTextField(
            value = companyCode,
            onValueChange = { companyCode = it.uppercase().take(20) },
            label = { Text("Código da empresa") },
            placeholder = { Text("Ex.: VISTECSSQV") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false, imeAction = ImeAction.Next),
            keyboardActions = KeyboardActions(onNext = { matriculaFocus.requestFocus() }),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = matricula,
            onValueChange = { matricula = it.take(40) },
            label = { Text("Matrícula") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false, imeAction = ImeAction.Go),
            keyboardActions = KeyboardActions(onGo = { submit() }),
            modifier = Modifier.fillMaxWidth().focusRequester(matriculaFocus),
        )
        if (error != null) Banner("Não foi possível entrar", error, Tone.Danger)
        PrimaryButton("Entrar", onClick = ::submit, loading = loading)
        Muted(
            "O acesso é criado pela sua empresa no portal CHECK-ON. Se não conseguir entrar, fale com o seu gestor.",
            Modifier.fillMaxWidth().padding(bottom = 24.dp),
        )
    }
}

@Composable
fun HomeScreen(
    vm: AppViewModel,
    onNewInspection: () -> Unit,
    onVehicle: (String) -> Unit,
    onQueue: () -> Unit,
    onResumeDraft: (vehicleId: String, templateId: String) -> Unit,
) {
    val session by vm.session.collectAsState()
    val bootstrap by vm.bootstrap.collectAsState()
    val queue by vm.queue.collectAsState()
    val online by vm.online.collectAsState()
    val syncing by vm.syncing.collectAsState()
    val loading by vm.loadingBootstrap.collectAsState()
    val bootstrapError by vm.bootstrapError.collectAsState()
    var confirmLogout by remember { mutableStateOf(false) }
    var qrMessage by remember { mutableStateOf<QrNotice?>(null) }
    // Dados atualizados (ex.: puxou a tela para baixo): o aviso antigo do QR Code perde o sentido.
    LaunchedEffect(bootstrap?.downloadedAt) { qrMessage = null }
    val context = androidx.compose.ui.platform.LocalContext.current
    val pending = queue.count { it.state == "PENDING" }
    val rejected = queue.count { it.state == "REJECTED" }
    val user = session?.user
    // Inspeção começada e não concluída: lida sempre que a tela inicial aparece.
    var draft by remember { mutableStateOf<Draft?>(null) }
    LaunchedEffect(user?.id) { draft = vm.repository.readDraft() }
    val draftAvailable = draft?.let { d ->
        bootstrap?.vehicles?.any { it.id == d.vehicleId } == true && bootstrap?.templates?.any { it.id == d.templateId } == true
    } == true

    PullToRefreshBox(isRefreshing = loading, onRefresh = { vm.refreshBootstrap(); vm.syncNow() }, modifier = Modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(ScreenPadding),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Olá, ${user?.name?.substringBefore(' ') ?: ""}", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = Palette.Text)
            Muted(listOfNotNull(user?.tenantName, user?.tenantCode).joinToString(" · "))

            if (!online) Banner("Sem internet", "Você pode fazer inspeções normalmente. Elas ficam guardadas no celular e são enviadas quando a conexão voltar.", Tone.Info)
            if (bootstrap == null) {
                Banner(
                    if (loading) "Baixando os dados..." else "Dados ainda não baixados",
                    bootstrapError ?: "Na primeira vez, o aplicativo precisa de internet para baixar os veículos e os checklists da empresa.",
                    if (bootstrapError != null) Tone.Danger else Tone.Info,
                )
            }
            qrMessage?.let { Banner(it.title, it.text, Tone.Warning, onDismiss = { qrMessage = null }) }

            draft?.takeIf { draftAvailable }?.let { d ->
                AppCard(accent = Palette.Primary, onClick = { onResumeDraft(d.vehicleId, d.templateId) }) {
                    IconRow(Icons.Filled.EditNote, Palette.Primary) {
                        Column {
                            Text("Continuar inspeção", fontWeight = FontWeight.Bold, color = Palette.Text)
                            Muted("${d.vehicleLabel} · ${d.templateName} · ${Rules.plural(d.answers.size, "resposta salva", "respostas salvas")}")
                        }
                    }
                }
            }

            PrimaryButton("Nova inspeção", onClick = onNewInspection, icon = Icons.AutoMirrored.Filled.Assignment, enabled = bootstrap != null)
            SecondaryButton("Ler QR Code do veículo", icon = Icons.Filled.QrCodeScanner, enabled = bootstrap != null, onClick = {
                qrMessage = null
                scanQr(context, onResult = { raw ->
                    val vehicle = Rules.findVehicleByQr(bootstrap?.vehicles ?: emptyList(), raw)
                    if (vehicle != null) {
                        qrMessage = null
                        onVehicle(vehicle.id)
                    } else {
                        qrMessage = QrNotice.notFound("Este QR Code não é de um veículo ativo da sua empresa. Se o veículo for novo, puxe a tela para baixo para atualizar os dados.")
                    }
                }, onError = { qrMessage = QrNotice.scannerError(it) })
            })

            AppCard(onClick = onQueue) {
                IconRow(
                    icon = when {
                        rejected > 0 -> Icons.Filled.ErrorOutline
                        pending > 0 -> Icons.Filled.CloudUpload
                        else -> Icons.Filled.CloudDone
                    },
                    tint = when {
                        rejected > 0 -> Palette.Danger
                        pending > 0 -> Palette.Warning
                        else -> Palette.Primary
                    },
                ) {
                    Column {
                        Text(
                            when {
                                rejected > 0 -> Rules.plural(rejected, "inspeção recusada", "inspeções recusadas")
                                pending > 0 -> Rules.plural(pending, "inspeção aguardando envio", "inspeções aguardando envio")
                                else -> "Tudo enviado"
                            },
                            fontWeight = FontWeight.Bold, color = Palette.Text,
                        )
                        Muted(
                            when {
                                syncing -> "Enviando..."
                                rejected > 0 -> "Toque para ver o motivo."
                                pending > 0 && online -> "Toque para enviar agora."
                                pending > 0 -> "Serão enviadas quando houver internet."
                                else -> "Nenhuma inspeção pendente neste celular."
                            },
                        )
                    }
                }
            }

            bootstrap?.let {
                Muted(
                    "${Rules.plural(it.vehicles.size, "veículo", "veículos")} e ${Rules.plural(it.templates.size, "checklist", "checklists")} no celular.\nAtualizado em ${formatMillis(it.downloadedAt)}. Puxe a tela para baixo para atualizar.",
                    Modifier.fillMaxWidth(),
                )
            }
            TextButton(onClick = { confirmLogout = true }, modifier = Modifier.fillMaxWidth()) {
                androidx.compose.material3.Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = Palette.Text)
                Spacer(Modifier.size(8.dp))
                Text("Sair", color = Palette.Text, fontWeight = FontWeight.SemiBold)
            }
        }
    }

    if (confirmLogout) {
        AlertDialog(
            onDismissRequest = { confirmLogout = false },
            title = { Text("Sair do aplicativo?") },
            text = {
                Text(
                    "Para entrar de novo, use o código da empresa e a sua matrícula." +
                        when {
                            pending == 1 -> "\n\nVocê tem 1 inspeção ainda não enviada. Ela fica guardada neste celular e é enviada quando você entrar de novo."
                            pending > 1 -> "\n\nVocê tem $pending inspeções ainda não enviadas. Elas ficam guardadas neste celular e são enviadas quando você entrar de novo."
                            else -> ""
                        },
                )
            },
            confirmButton = { TextButton(onClick = { confirmLogout = false; vm.logout() }) { Text("Sair", color = Palette.Danger) } },
            dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("Cancelar") } },
        )
    }
}

/** Leitor de QR Code do Google Play Services (não precisa de permissão de câmera no app). */
fun scanQr(context: Context, onResult: (String) -> Unit, onError: (String) -> Unit) {
    val options = GmsBarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).enableAutoZoom().build()
    GmsBarcodeScanning.getClient(context, options).startScan()
        .addOnSuccessListener { barcode -> barcode.rawValue?.let(onResult) }
        .addOnFailureListener { onError("Não foi possível abrir o leitor de QR Code. Escolha o veículo na lista.") }
}

@Composable
fun VehiclesScreen(vm: AppViewModel, onVehicle: (String) -> Unit) {
    val bootstrap by vm.bootstrap.collectAsState()
    var query by rememberSaveable { mutableStateOf("") }
    val context = androidx.compose.ui.platform.LocalContext.current
    var qrMessage by remember { mutableStateOf<QrNotice?>(null) }
    val vehicles: List<Vehicle> = (bootstrap?.vehicles ?: emptyList()).filter { Rules.matchesVehicle(it, query) }
    val ncCount = (bootstrap?.openNcs ?: emptyList()).groupingBy { it.vehicleId }.eachCount()

    androidx.compose.foundation.lazy.LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = ScreenPadding,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Buscar placa, prefixo ou modelo") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            SecondaryButton("Ler QR Code", icon = Icons.Filled.QrCodeScanner, onClick = {
                qrMessage = null
                scanQr(context, onResult = { raw ->
                    val vehicle = Rules.findVehicleByQr(bootstrap?.vehicles ?: emptyList(), raw)
                    if (vehicle != null) onVehicle(vehicle.id) else qrMessage = QrNotice.notFound("Este QR Code não é de um veículo ativo da sua empresa.")
                }, onError = { qrMessage = QrNotice.scannerError(it) })
            })
        }
        qrMessage?.let { notice -> item(key = "qr-notice") { Banner(notice.title, notice.text, Tone.Warning, onDismiss = { qrMessage = null }) } }
        if (vehicles.isEmpty()) {
            item { Muted(if (query.isBlank()) "A empresa ainda não tem veículos ativos." else "Nenhum veículo encontrado.", Modifier.fillMaxWidth().padding(24.dp)) }
        }
        items(vehicles.size, key = { vehicles[it].id }) { index ->
            val vehicle = vehicles[index]
            val ncs = ncCount[vehicle.id] ?: 0
            AppCard(onClick = { onVehicle(vehicle.id) }) {
                Text(vehicle.label, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = Palette.Text)
                Muted((vehicle.description.ifBlank { "Sem modelo" }) + (vehicle.fleet?.let { " · ${it.name}" } ?: ""))
                androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    StatusTag(vehicle.status)
                    if (ncs > 0) Text(Rules.plural(ncs, "NC em aberto", "NCs em aberto"), color = Palette.Warning, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun CenteredMessage(title: String, text: String) {
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Banner(title, text, Tone.Warning)
    }
}
