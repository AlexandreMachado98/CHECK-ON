package com.checkon.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.checkon.app.data.Rules

/**
 * Assinatura do colaborador no fim da inspeção: desenhada com o dedo numa área 3:1.
 * Os traços ficam no rascunho (x, y de 0 a 1), então a assinatura não se perde se o app fechar.
 */
@Composable
fun SignatureCard(
    signerName: String,
    strokes: List<List<Float>>,
    highlighted: Boolean,
    onChange: (List<List<Float>>) -> Unit,
) {
    val signed = Rules.hasSignature(strokes)
    AppCard(accent = if (highlighted) Palette.Danger else if (signed) Palette.Primary else null) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Assinatura", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Palette.Text, modifier = Modifier.weight(1f))
            if (strokes.isNotEmpty()) {
                // Desfaz só o último traço (ex.: o dedo escorregou), sem apagar a assinatura toda.
                TextButton(onClick = { onChange(strokes.dropLast(1)) }) { Text("Desfazer", color = Palette.Text) }
                TextButton(onClick = { onChange(emptyList()) }) { Text("Limpar", color = Palette.Danger) }
            }
        }
        Muted(if (signed) "Assinado. Toque em \"Desfazer\" para apagar o último traço ou em \"Limpar\" para assinar de novo." else "Assine com o dedo no quadro abaixo para concluir a inspeção.")
        SignatureArea(strokes = strokes, onChange = onChange)
        Text(signerName, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Palette.Text, modifier = Modifier.fillMaxWidth())
        Muted("Ao assinar, confirmo que fiz esta inspeção e que as respostas são verdadeiras.")
    }
}

@Composable
private fun SignatureArea(strokes: List<List<Float>>, onChange: (List<List<Float>>) -> Unit) {
    // Traço sendo desenhado agora (só entra no rascunho quando o dedo sai da tela).
    var current by remember { mutableStateOf<List<Float>>(emptyList()) }
    val latestStrokes by rememberUpdatedState(strokes)
    val latestOnChange by rememberUpdatedState(onChange)
    val ink = Palette.Text
    val shape = RoundedCornerShape(12.dp)

    Box(
        Modifier
            .fillMaxWidth()
            .aspectRatio(3f)
            .clip(shape)
            .background(Palette.Background)
            .border(BorderStroke(1.dp, Palette.Border), shape)
            .semantics { contentDescription = "Área para assinar com o dedo" }
            .pointerInput(Unit) {
                fun point(offset: Offset) = listOf(
                    (offset.x / size.width).coerceIn(0f, 1f),
                    (offset.y / size.height).coerceIn(0f, 1f),
                )
                detectDragGestures(
                    onDragStart = { start -> current = point(start) },
                    onDrag = { change, _ ->
                        change.consume()
                        current = current + point(change.position)
                    },
                    onDragEnd = {
                        if (current.size >= 4) latestOnChange(latestStrokes + listOf(current))
                        current = emptyList()
                    },
                    onDragCancel = { current = emptyList() },
                )
            }
            .pointerInput(Unit) {
                // Toque rápido vira um ponto (ex.: pingo do "i").
                detectTapGestures { offset ->
                    val dot = listOf((offset.x / size.width).coerceIn(0f, 1f), (offset.y / size.height).coerceIn(0f, 1f))
                    latestOnChange(latestStrokes + listOf(dot))
                }
            },
    ) {
        if (strokes.isEmpty() && current.isEmpty()) {
            Text("Assine aqui", color = Palette.Muted, fontSize = 15.sp, modifier = Modifier.align(Alignment.Center))
        }
        Canvas(Modifier.fillMaxSize()) {
            val pen = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
            for (stroke in strokes + listOf(current)) {
                if (stroke.size < 2) continue
                if (stroke.size == 2) {
                    drawCircle(ink, radius = 1.6.dp.toPx(), center = Offset(stroke[0] * size.width, stroke[1] * size.height))
                    continue
                }
                val path = Path()
                path.moveTo(stroke[0] * size.width, stroke[1] * size.height)
                var i = 2
                while (i + 1 < stroke.size) {
                    path.lineTo(stroke[i] * size.width, stroke[i + 1] * size.height)
                    i += 2
                }
                drawPath(path, ink, style = pen)
            }
        }
    }
}
