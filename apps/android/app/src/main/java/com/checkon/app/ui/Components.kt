package com.checkon.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.checkon.app.data.Rules

/** Cores do portal CHECK-ON (verde esmeralda + cinza azulado). */
object Palette {
    val Primary = Color(0xFF059669)
    val PrimaryDark = Color(0xFF047857)
    val PrimarySoft = Color(0xFFECFDF5)
    val Text = Color(0xFF0F172A)
    val Muted = Color(0xFF64748B)
    val Border = Color(0xFFE2E8F0)
    val Background = Color(0xFFF8FAFC)
    val Danger = Color(0xFFBE123C)
    val DangerSoft = Color(0xFFFFF1F2)
    val Warning = Color(0xFFB45309)
    val WarningSoft = Color(0xFFFFFBEB)
    val Info = Color(0xFF0369A1)
    val InfoSoft = Color(0xFFF0F9FF)
}

@Composable
fun CheckOnTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Palette.Primary,
            onPrimary = Color.White,
            secondary = Palette.PrimaryDark,
            background = Palette.Background,
            surface = Color.White,
            onSurface = Palette.Text,
            error = Palette.Danger,
        ),
        content = content,
    )
}

@Composable
fun PrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null, loading: Boolean = false, enabled: Boolean = true, danger: Boolean = false) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().heightIn(min = 56.dp),
        shape = RoundedCornerShape(14.dp),
        colors = if (danger) ButtonDefaults.buttonColors(containerColor = Palette.Danger) else ButtonDefaults.buttonColors(),
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(22.dp), color = Color.White, strokeWidth = 2.dp)
        } else {
            if (icon != null) {
                Icon(icon, contentDescription = null)
                Spacer(Modifier.width(8.dp))
            }
            Text(text, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun SecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null, enabled: Boolean = true, loading: Boolean = false) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Palette.Border),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White, contentColor = Palette.Text),
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(22.dp), color = Palette.Primary, strokeWidth = 2.dp)
        } else {
            if (icon != null) {
                Icon(icon, contentDescription = null)
                Spacer(Modifier.width(8.dp))
            }
            Text(text, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun AppCard(modifier: Modifier = Modifier, accent: Color? = null, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    val colors = CardDefaults.cardColors(containerColor = Color.White)
    val border = BorderStroke(if (accent != null) 2.dp else 1.dp, accent ?: Palette.Border)
    val inner: @Composable ColumnScope.() -> Unit = {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp), content = content)
    }
    if (onClick != null) {
        Card(onClick = onClick, modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = colors, border = border, content = inner)
    } else {
        Card(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = colors, border = border, content = inner)
    }
}

enum class Tone(val fg: Color, val bg: Color) {
    Success(Palette.PrimaryDark, Palette.PrimarySoft),
    Danger(Palette.Danger, Palette.DangerSoft),
    Warning(Palette.Warning, Palette.WarningSoft),
    Info(Palette.Info, Palette.InfoSoft),
    Muted(Palette.Muted, Palette.Background),
}

@Composable
fun Tag(text: String, tone: Tone = Tone.Muted) {
    Text(
        text,
        color = tone.fg,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.background(tone.bg, RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 3.dp),
    )
}

@Composable
fun StatusTag(status: String) {
    val tone = when (status) {
        "LIBERADO" -> Tone.Success
        "ATENCAO" -> Tone.Warning
        "BLOQUEADO" -> Tone.Danger
        else -> Tone.Muted
    }
    Tag(Rules.STATUS_LABEL[status] ?: status, tone)
}

@Composable
fun Banner(title: String, text: String?, tone: Tone) {
    Column(
        Modifier.fillMaxWidth().background(tone.bg, RoundedCornerShape(12.dp)).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title, color = tone.fg, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        if (!text.isNullOrBlank()) Text(text, color = Palette.Text, fontSize = 14.sp, lineHeight = 20.sp)
    }
}

@Composable
fun SectionTitle(text: String) {
    Text(
        text.uppercase(),
        color = Palette.Muted,
        fontSize = 13.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.5.sp,
        modifier = Modifier.padding(top = 8.dp),
    )
}

@Composable
fun Muted(text: String, modifier: Modifier = Modifier) {
    Text(text, color = Palette.Muted, fontSize = 14.sp, lineHeight = 20.sp, modifier = modifier)
}

@Composable
fun IconRow(icon: ImageVector, tint: Color, content: @Composable () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(28.dp))
        Spacer(Modifier.width(12.dp))
        content()
    }
}

val ScreenPadding = PaddingValues(16.dp)

/** "dd/MM às HH:mm" a partir de um ISO 8601 ou milissegundos. */
fun formatDateTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return runCatching { formatMillis(java.time.Instant.parse(iso).toEpochMilli()) }.getOrDefault("")
}

fun formatMillis(millis: Long): String {
    if (millis <= 0) return ""
    val formatter = java.time.format.DateTimeFormatter.ofPattern("dd/MM 'às' HH:mm")
    return java.time.Instant.ofEpochMilli(millis).atZone(java.time.ZoneId.systemDefault()).format(formatter)
}
