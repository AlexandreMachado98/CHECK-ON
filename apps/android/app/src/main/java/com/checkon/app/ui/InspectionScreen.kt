package com.checkon.app.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.location.Location
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.checkon.app.data.Answer
import com.checkon.app.data.Draft
import com.checkon.app.data.QueuedInspection
import com.checkon.app.data.Rules
import com.checkon.app.data.SubmitPayload
import com.checkon.app.data.TemplateItem
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.io.File
import java.time.Instant
import java.util.UUID

@Composable
fun InspectionScreen(vm: AppViewModel, vehicleId: String, templateId: String, onDone: (clientId: String) -> Unit, onDiscarded: () -> Unit) {
    val bootstrap by vm.bootstrap.collectAsState()
    val vehicle = bootstrap?.vehicles?.firstOrNull { it.id == vehicleId }
    val template = bootstrap?.templates?.firstOrNull { it.id == templateId }
    val repository = vm.repository
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var draft by remember { mutableStateOf<Draft?>(null) }
    var highlight by remember { mutableStateOf(setOf<String>()) }
    var pendencies by remember { mutableStateOf<List<String>?>(null) }
    var confirm by remember { mutableStateOf(false) }
    var confirmDiscard by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    // Foto sendo tirada: guardada para sobreviver se o Android fechar o app enquanto a câmera está aberta.
    var photoItemId by rememberSaveable { mutableStateOf<String?>(null) }
    var photoPath by rememberSaveable { mutableStateOf<String?>(null) }
    var processingPhoto by remember { mutableStateOf<String?>(null) }
    val listState = rememberLazyListState()

    // Retoma o rascunho desta inspeção ou começa uma nova.
    LaunchedEffect(vehicle?.id, template?.id) {
        if (vehicle == null || template == null || draft != null) return@LaunchedEffect
        val saved = repository.readDraft()
        draft = if (saved != null && saved.vehicleId == vehicle.id && saved.templateId == template.id) saved else Draft(
            clientId = UUID.randomUUID().toString(),
            vehicleId = vehicle.id,
            vehicleLabel = vehicle.label,
            templateId = template.id,
            templateName = template.name,
            templateVersion = template.version,
            startedAt = Instant.now().toString(),
        )
    }
    // Salva o rascunho a cada mudança, em ordem.
    LaunchedEffect(Unit) {
        snapshotFlow { draft }.filterNotNull().collect { repository.saveDraft(it) }
    }

    fun update(itemId: String, change: (Answer) -> Answer) {
        val current = draft ?: return
        val answer = change(current.answers[itemId] ?: Answer(itemId = itemId))
        draft = current.copy(answers = current.answers + (itemId to answer))
        highlight = highlight - itemId
    }

    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val itemId = photoItemId
        val path = photoPath
        photoItemId = null
        photoPath = null
        if (itemId == null || path == null) return@rememberLauncherForActivityResult
        if (!ok) {
            repository.photos.delete(path)
            return@rememberLauncherForActivityResult
        }
        scope.launch {
            processingPhoto = itemId
            val finished = repository.photos.finish(File(path))
            // Se o app foi reaberto, espera o rascunho carregar antes de aplicar a foto.
            val loaded = snapshotFlow { draft }.filterNotNull().first()
            if (finished != null) {
                repository.photos.delete(loaded.answers[itemId]?.localPhoto)
                update(itemId) { it.copy(localPhoto = finished, photoUrl = null) }
            }
            processingPhoto = null
        }
    }

    fun takePhoto(itemId: String) {
        val (file, uri) = repository.photos.newCaptureTarget()
        photoItemId = itemId
        photoPath = file.path
        try {
            camera.launch(uri)
        } catch (_: Exception) {
            photoItemId = null
            photoPath = null
            file.delete()
            pendencies = listOf("Não foi possível abrir a câmera deste celular.")
        }
    }

    // Localização é "melhor esforço": pede a permissão uma vez; sem ela, a inspeção segue normalmente.
    val locationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }
    LaunchedEffect(Unit) {
        if (!hasLocationPermission(context)) {
            locationPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }
    }

    if (vehicle == null || template == null) {
        CenteredMessage("Checklist indisponível", "O veículo ou o checklist não está mais ativo. Atualize os dados na tela inicial.")
        return
    }
    val current = draft
    if (current == null) {
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = Palette.Primary)
        }
        return
    }

    val ncItemIds = bootstrap?.openNcs?.filter { it.vehicleId == vehicleId }?.map { it.itemId }?.toSet() ?: emptySet()
    val items = template.allItems
    val answered = items.count { Rules.isAnswered(it, current.answers[it.id]) }
    val nonCompliant = items.filter { it.type == "PASS_FAIL" && current.answers[it.id]?.isCompliant == false }
    // Linhas da lista: título da categoria seguido dos itens.
    val rows = template.categories.flatMap { category -> listOf<Any>(category.name) + category.items }

    fun finish() {
        val missing = Rules.pendingItems(template, current.answers)
        if (missing.isNotEmpty()) {
            highlight = missing.map { it.itemId }.toSet()
            pendencies = missing.map { it.message }
            val index = rows.indexOfFirst { it is TemplateItem && it.id == missing.first().itemId }
            if (index >= 0) scope.launch { listState.animateScrollToItem(index + 1) }
            return
        }
        confirm = true
    }

    fun save() {
        saving = true
        scope.launch {
            val location = lastLocation(context)
            val payload = SubmitPayload(
                clientId = current.clientId,
                templateId = current.templateId,
                templateVersion = current.templateVersion,
                vehicleId = current.vehicleId,
                startedAt = current.startedAt,
                completedAt = Instant.now().toString(),
                latitude = location?.latitude,
                longitude = location?.longitude,
                answers = Rules.answersToSend(template, current.answers),
            )
            vm.enqueue(QueuedInspection(current.clientId, payload, current.vehicleLabel, current.templateName))
            repository.saveDraft(null)
            onDone(current.clientId)
        }
    }

    Column(Modifier.fillMaxSize().imePadding()) {
        Column(Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 16.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(template.name, fontWeight = FontWeight.Bold, color = Palette.Text, modifier = Modifier.weight(1f))
                TextButton(onClick = { confirmDiscard = true }) { Text("Descartar", color = Palette.Danger) }
            }
            LinearProgressIndicator(
                progress = { if (items.isEmpty()) 0f else answered.toFloat() / items.size },
                modifier = Modifier.fillMaxWidth().height(8.dp),
                color = Palette.Primary,
                trackColor = Palette.Border,
            )
            Muted("$answered de ${items.size} respondidos" + (if (nonCompliant.isNotEmpty()) " · ${nonCompliant.size} não conforme(s)" else "") + " · salvo no celular")
        }
        LazyColumn(state = listState, modifier = Modifier.weight(1f), contentPadding = ScreenPadding, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                if (vehicle.status == "BLOQUEADO") Banner("Veículo bloqueado", "Registre a inspeção, mas o veículo não deve circular até ser liberado.", Tone.Danger)
            }
            items(rows.size, key = { index -> (rows[index] as? TemplateItem)?.id ?: "cat-$index" }) { index ->
                when (val row = rows[index]) {
                    is String -> SectionTitle(row)
                    is TemplateItem -> ItemCard(
                        item = row,
                        answer = current.answers[row.id],
                        hasOpenNc = row.id in ncItemIds,
                        highlighted = row.id in highlight,
                        processingPhoto = processingPhoto == row.id,
                        onChange = { change -> update(row.id, change) },
                        onPhoto = { takePhoto(row.id) },
                        onRemovePhoto = {
                            repository.photos.delete(current.answers[row.id]?.localPhoto)
                            update(row.id) { it.copy(localPhoto = null, photoUrl = null) }
                        },
                    )
                }
            }
            item {
                Spacer(Modifier.height(8.dp))
                PrimaryButton("Concluir inspeção", onClick = ::finish, loading = saving)
            }
        }
    }

    pendencies?.let { list ->
        AlertDialog(
            onDismissRequest = { pendencies = null },
            title = { Text("Falta pouco") },
            text = { Text(list.take(6).joinToString("\n") { "• $it" } + if (list.size > 6) "\n...e mais ${list.size - 6}." else "") },
            confirmButton = { TextButton(onClick = { pendencies = null }) { Text("Ok") } },
        )
    }
    if (confirm) {
        val critical = nonCompliant.count { it.isCritical }
        AlertDialog(
            onDismissRequest = { confirm = false },
            title = { Text("Concluir inspeção?") },
            text = {
                Text(
                    "${vehicle.label} · ${template.name}\n\n" +
                        if (nonCompliant.isEmpty()) "Todos os itens conformes."
                        else "${nonCompliant.size} item(ns) não conforme(s)" + (if (critical > 0) ", $critical crítico(s)" else "") + ". Vai abrir não conformidade para o gestor.",
                )
            },
            confirmButton = { TextButton(onClick = { confirm = false; save() }) { Text("Concluir") } },
            dismissButton = { TextButton(onClick = { confirm = false }) { Text("Revisar") } },
        )
    }
    if (confirmDiscard) {
        AlertDialog(
            onDismissRequest = { confirmDiscard = false },
            title = { Text("Descartar esta inspeção?") },
            text = { Text("As respostas e fotos desta inspeção serão apagadas do celular.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDiscard = false
                    scope.launch {
                        current.answers.values.forEach { repository.photos.delete(it.localPhoto) }
                        draft = null
                        repository.saveDraft(null)
                        onDiscarded()
                    }
                }) { Text("Descartar", color = Palette.Danger) }
            },
            dismissButton = { TextButton(onClick = { confirmDiscard = false }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun ItemCard(
    item: TemplateItem,
    answer: Answer?,
    hasOpenNc: Boolean,
    highlighted: Boolean,
    processingPhoto: Boolean,
    onChange: ((Answer) -> Answer) -> Unit,
    onPhoto: () -> Unit,
    onRemovePhoto: () -> Unit,
) {
    val failed = answer?.isCompliant == false
    var numberText by rememberSaveable(item.id) { mutableStateOf(answer?.numberValue?.toString()?.removeSuffix(".0")?.replace('.', ',') ?: "") }
    var showNotes by rememberSaveable(item.id) { mutableStateOf(!answer?.observations.isNullOrBlank()) }

    AppCard(accent = if (highlighted) Palette.Danger else null) {
        Text(item.text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Palette.Text)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (item.isCritical) Tag("Crítico", Tone.Danger)
            if (!item.isRequired) Tag("Opcional")
            if (item.photoRequirement == "ALWAYS" && item.type != "PHOTO") Tag("Foto obrigatória", Tone.Info)
            if (hasOpenNc) Tag("NC em aberto", Tone.Warning)
        }

        when (item.type) {
            "TEXT" -> OutlinedTextField(
                value = answer?.textValue ?: "",
                onValueChange = { text -> onChange { it.copy(textValue = text.take(2000)) } },
                placeholder = { Text("Escreva aqui") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )
            "NUMBER" -> {
                val invalid = numberText.isNotBlank() && Rules.parseNumber(numberText) == null
                OutlinedTextField(
                    value = numberText,
                    onValueChange = { text ->
                        numberText = text
                        onChange { it.copy(numberValue = Rules.parseNumber(text)) }
                    },
                    placeholder = { Text("0") },
                    singleLine = true,
                    isError = invalid,
                    supportingText = { if (invalid) Text("Digite só números (ex.: 12,5).") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            "PHOTO" -> Unit
            else -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Choice("Conforme", Icons.Filled.CheckCircle, answer?.isCompliant == true, Palette.Primary, Modifier.weight(1f)) {
                    onChange { it.copy(isCompliant = true) }
                }
                Choice("Não conforme", Icons.Filled.Cancel, failed, Palette.Danger, Modifier.weight(1f)) {
                    onChange { it.copy(isCompliant = false) }
                }
            }
        }

        if (Rules.showsPhoto(item, answer)) {
            val path = answer?.localPhoto
            if (path != null && File(path).exists()) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    PhotoThumb(path)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        SecondaryButton("Tirar outra", onClick = onPhoto, loading = processingPhoto)
                        TextButton(onClick = onRemovePhoto, modifier = Modifier.fillMaxWidth()) { Text("Remover foto", color = Palette.Text) }
                    }
                }
            } else {
                SecondaryButton(if (failed) "Fotografar o problema" else "Tirar foto", onClick = onPhoto, icon = Icons.Filled.CameraAlt, loading = processingPhoto)
            }
        }

        if (failed || showNotes) {
            OutlinedTextField(
                value = answer?.observations ?: "",
                onValueChange = { text -> onChange { it.copy(observations = text.take(2000)) } },
                placeholder = { Text(if (failed) "Descreva o problema (opcional)" else "Observação (opcional)") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )
        } else {
            TextButton(onClick = { showNotes = true }) { Text("+ Observação", color = Palette.Info, fontWeight = FontWeight.SemiBold) }
        }
    }
}

@Composable
private fun Choice(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, active: Boolean, color: Color, modifier: Modifier, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.heightIn(min = 52.dp),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(2.dp, if (active) color else Palette.Border),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = if (active) color else Color.White,
            contentColor = if (active) Color.White else Palette.Text,
        ),
    ) {
        Icon(icon, contentDescription = null, tint = if (active) Color.White else color, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }
}

@Composable
private fun PhotoThumb(path: String) {
    // Miniatura leve (1/8 do tamanho) para não pesar na memória.
    val bitmap = remember(path, File(path).lastModified()) {
        runCatching { BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = 8 })?.asImageBitmap() }.getOrNull()
    }
    if (bitmap != null) {
        Image(bitmap, contentDescription = "Foto do item", contentScale = ContentScale.Crop, modifier = Modifier.size(96.dp).background(Palette.Border, RoundedCornerShape(10.dp)))
    }
}

private fun hasLocationPermission(context: Context) =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

/** Última localização conhecida do celular (até 30 min). Sem permissão ou sem sinal: null. */
@SuppressLint("MissingPermission")
private fun lastLocation(context: Context): Location? {
    if (!hasLocationPermission(context)) return null
    val manager = context.getSystemService(LocationManager::class.java) ?: return null
    val limit = System.currentTimeMillis() - 30 * 60 * 1000
    return runCatching {
        manager.getProviders(true)
            .mapNotNull { manager.getLastKnownLocation(it) }
            .filter { it.time >= limit }
            .maxByOrNull { it.time }
    }.getOrNull()
}
