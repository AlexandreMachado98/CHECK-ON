package com.checkon.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BrightnessAuto
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.checkon.app.data.ThemeMode
import com.checkon.app.data.ThemeSettings

private val ThemeMode.icon: ImageVector
    get() = when (this) {
        ThemeMode.AUTOMATICO -> Icons.Filled.BrightnessAuto
        ThemeMode.CLARO -> Icons.Filled.LightMode
        ThemeMode.ESCURO -> Icons.Filled.DarkMode
    }

/** Botão de tema (ícone do modo atual). Abre a escolha entre automático, claro e escuro. */
@Composable
fun ThemeButton(settings: ThemeSettings, modifier: Modifier = Modifier) {
    val mode by settings.mode.collectAsState()
    var open by remember { mutableStateOf(false) }
    IconButton(onClick = { open = true }, modifier = modifier) {
        Icon(mode.icon, contentDescription = "Tema: ${mode.label}. Toque para mudar.", tint = Palette.Text)
    }
    if (open) {
        ThemeDialog(current = mode, onSelect = { settings.set(it); open = false }, onDismiss = { open = false })
    }
}

@Composable
private fun ThemeDialog(current: ThemeMode, onSelect: (ThemeMode) -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Tema do aplicativo") },
        text = {
            Column(Modifier.selectableGroup()) {
                ThemeMode.entries.forEach { option ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .selectable(selected = option == current, role = Role.RadioButton, onClick = { onSelect(option) })
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(
                            selected = option == current,
                            onClick = null,
                            colors = RadioButtonDefaults.colors(selectedColor = Palette.Primary, unselectedColor = Palette.Muted),
                        )
                        Icon(option.icon, contentDescription = null, tint = Palette.Muted, modifier = Modifier.padding(start = 12.dp, end = 10.dp))
                        Text(option.label, color = Palette.Text)
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Fechar") } },
    )
}
