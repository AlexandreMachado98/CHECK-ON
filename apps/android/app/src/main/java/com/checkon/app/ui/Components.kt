package com.checkon.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
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
import androidx.compose.material3.IconButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.checkon.app.data.Rules

/** Conjunto de cores do app; um para o tema claro e outro para o escuro. */
@Immutable
data class CheckOnColors(
    val primary: Color,
    val primaryDark: Color,
    val primarySoft: Color,
    val text: Color,
    val muted: Color,
    val border: Color,
    val background: Color,
    val surface: Color,
    val danger: Color,
    val dangerSoft: Color,
    val warning: Color,
    val warningSoft: Color,
    val info: Color,
    val infoSoft: Color,
    val isDark: Boolean,
)

/** Cores do portal CHECK-ON (verde esmeralda + cinza azulado). */
val LightColors = CheckOnColors(
    primary = Color(0xFF059669),
    primaryDark = Color(0xFF047857),
    primarySoft = Color(0xFFECFDF5),
    text = Color(0xFF0F172A),
    muted = Color(0xFF64748B),
    border = Color(0xFFE2E8F0),
    background = Color(0xFFF8FAFC),
    surface = Color(0xFFFFFFFF),
    danger = Color(0xFFBE123C),
    dangerSoft = Color(0xFFFFF1F2),
    warning = Color(0xFFB45309),
    warningSoft = Color(0xFFFFFBEB),
    info = Color(0xFF0369A1),
    infoSoft = Color(0xFFF0F9FF),
    isDark = false,
)

/**
 * Tema escuro: fundo azul-noite (mesma família do ícone), textos claros e cores de
 * estado mais vivas para manter o contraste. O verde dos botões continua o mesmo.
 */
val DarkColors = CheckOnColors(
    primary = Color(0xFF059669),
    primaryDark = Color(0xFF34D399),
    primarySoft = Color(0xFF0B3B2E),
    text = Color(0xFFE2E8F0),
    muted = Color(0xFF94A3B8),
    border = Color(0xFF334155),
    background = Color(0xFF0B1120),
    surface = Color(0xFF172033),
    danger = Color(0xFFF43F5E),
    dangerSoft = Color(0xFF3F1220),
    warning = Color(0xFFFBBF24),
    warningSoft = Color(0xFF3A2A0C),
    info = Color(0xFF38BDF8),
    infoSoft = Color(0xFF0C2A40),
    isDark = true,
)

val LocalCheckOnColors = staticCompositionLocalOf { LightColors }

/** Atalho para as cores do tema atual (claro ou escuro). */
object Palette {
    val Primary: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.primary
    val PrimaryDark: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.primaryDark
    val PrimarySoft: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.primarySoft
    val Text: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.text
    val Muted: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.muted
    val Border: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.border
    val Background: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.background
    val Surface: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.surface
    val Danger: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.danger
    val DangerSoft: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.dangerSoft
    val Warning: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.warning
    val WarningSoft: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.warningSoft
    val Info: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.info
    val InfoSoft: Color @Composable @ReadOnlyComposable get() = LocalCheckOnColors.current.infoSoft

    /** Texto/ícone legível sobre um fundo [fill]: branco nos fundos escuros, azul-noite nos claros. */
    fun contentOn(fill: Color): Color = if (fill.luminance() > 0.4f) Color(0xFF0B1120) else Color.White
}

/** Segue o modo claro/escuro do celular. */
@Composable
fun CheckOnTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colors = if (dark) DarkColors else LightColors
    val scheme = if (dark) {
        darkColorScheme(
            primary = colors.primary,
            onPrimary = Color.White,
            secondary = colors.primaryDark,
            background = colors.background,
            onBackground = colors.text,
            surface = colors.surface,
            onSurface = colors.text,
            surfaceVariant = colors.surface,
            onSurfaceVariant = colors.muted,
            surfaceContainerLowest = colors.background,
            surfaceContainerLow = colors.surface,
            surfaceContainer = colors.surface,
            surfaceContainerHigh = colors.surface,
            surfaceContainerHighest = colors.border,
            outline = colors.muted,
            outlineVariant = colors.border,
            error = colors.danger,
        )
    } else {
        lightColorScheme(
            primary = colors.primary,
            onPrimary = Color.White,
            secondary = colors.primaryDark,
            background = colors.background,
            surface = colors.surface,
            onSurface = colors.text,
            error = colors.danger,
        )
    }
    CompositionLocalProvider(LocalCheckOnColors provides colors) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
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
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Palette.Surface, contentColor = Palette.Text),
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
    val colors = CardDefaults.cardColors(containerColor = Palette.Surface, contentColor = Palette.Text)
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

enum class Tone {
    Success, Danger, Warning, Info, Muted;

    val fg: Color
        @Composable @ReadOnlyComposable get() = when (this) {
            Success -> Palette.PrimaryDark
            Danger -> Palette.Danger
            Warning -> Palette.Warning
            Info -> Palette.Info
            Muted -> Palette.Muted
        }

    val bg: Color
        @Composable @ReadOnlyComposable get() = when (this) {
            Success -> Palette.PrimarySoft
            Danger -> Palette.DangerSoft
            Warning -> Palette.WarningSoft
            Info -> Palette.InfoSoft
            Muted -> Palette.Background
        }
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

/** Aviso colorido. Com [onDismiss], mostra um "x" e fecha com um toque em qualquer parte do aviso. */
@Composable
fun Banner(title: String, text: String?, tone: Tone, onDismiss: (() -> Unit)? = null) {
    val shape = RoundedCornerShape(12.dp)
    var modifier = Modifier.fillMaxWidth().clip(shape).background(tone.bg)
    if (onDismiss != null) modifier = modifier.clickable(onClickLabel = "Fechar aviso", onClick = onDismiss)
    Row(modifier.padding(start = 12.dp, top = 12.dp, bottom = 12.dp, end = if (onDismiss != null) 4.dp else 12.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = tone.fg, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            if (!text.isNullOrBlank()) Text(text, color = Palette.Text, fontSize = 14.sp, lineHeight = 20.sp)
        }
        if (onDismiss != null) {
            IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Filled.Close, contentDescription = "Fechar aviso", tint = tone.fg, modifier = Modifier.size(18.dp))
            }
        }
    }
}

/** Aviso do leitor de QR Code: título e texto. */
data class QrNotice(val title: String, val text: String) {
    companion object {
        fun notFound(text: String) = QrNotice("QR Code não reconhecido", text)
        fun scannerError(text: String) = QrNotice("Leitor de QR Code indisponível", text)
    }
}

/** Título de seção da inspeção, com "Marcar conformes" quando há itens sem resposta. */
@Composable
fun SectionHeader(name: String, progress: Pair<Int, Int>, pending: Int, onMarkCompliant: () -> Unit) {
    val (answered, total) = progress
    Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            "${name.uppercase()} · $answered/$total",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            modifier = Modifier.weight(1f),
            // Seção completa fica verde.
            color = if (total > 0 && answered == total) Palette.Primary else Palette.Muted,
        )
        if (pending > 0) {
            androidx.compose.material3.TextButton(onClick = onMarkCompliant) {
                Icon(Icons.Filled.DoneAll, contentDescription = null, tint = Palette.Primary, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text("Marcar conformes ($pending)", color = Palette.Primary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
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
