package com.checkon.app.ui

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.sp
import com.checkon.app.data.Rules

/**
 * Km do veículo (hodômetro), pedido pelo modelo do checklist. Mostra o último km registrado para
 * conferência e avisa (sem impedir) quando o número parece errado: menor que o último ou um salto grande.
 */
@Composable
fun OdometerCard(km: Int?, lastKm: Int, required: Boolean, highlighted: Boolean, onChange: (Int?) -> Unit) {
    var text by rememberSaveable { mutableStateOf(km?.toString() ?: "") }
    val parsed = Rules.parseKm(text)
    val warning = Rules.kmWarning(parsed, lastKm)
    val missing = highlighted && parsed == null
    AppCard(accent = if (missing) Palette.Danger else if (warning != null) Palette.Warning else if (parsed != null) Palette.Primary else null) {
        Text(if (required) "KM atual do veículo (obrigatório)" else "KM atual do veículo (opcional)", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Palette.Text)
        Muted(if (lastKm > 0) "Digite o km do painel. Último registro: ${Rules.formatKm(lastKm)}." else "Digite o km que aparece no painel do veículo.")
        OutlinedTextField(
            value = text,
            onValueChange = { typed ->
                val clean = typed.replace(".", "")
                if (clean.length <= 7 && clean.all { it in '0'..'9' }) {
                    text = clean
                    onChange(Rules.parseKm(clean))
                }
            },
            placeholder = { Text("Ex.: 125430") },
            suffix = { Text("km") },
            singleLine = true,
            isError = missing,
            supportingText = {
                when {
                    missing -> Text("Informe o km para concluir.")
                    warning != null -> Text("Atenção: $warning", color = Palette.Text)
                }
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
