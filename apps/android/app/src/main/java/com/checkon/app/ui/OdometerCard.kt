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
fun OdometerCard(km: Int?, lastKm: Int, highlighted: Boolean, onChange: (Int?) -> Unit) {
    var text by rememberSaveable { mutableStateOf(km?.toString() ?: "") }
    val parsed = Rules.parseKm(text)
    val invalid = text.isNotBlank() && parsed == null
    val warning = Rules.kmWarning(parsed, lastKm)
    val missing = highlighted && parsed == null
    AppCard(accent = if (missing) Palette.Danger else if (warning != null) Palette.Warning else if (parsed != null) Palette.Primary else null) {
        Text("Km do veículo", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Palette.Text)
        Muted(if (lastKm > 0) "Digite o km do painel. Último registro: ${Rules.formatKm(lastKm)}." else "Digite o km que aparece no painel do veículo.")
        OutlinedTextField(
            value = text,
            onValueChange = { typed ->
                val clean = typed.filter { it.isDigit() || it == '.' }.take(9)
                text = clean
                onChange(Rules.parseKm(clean))
            },
            placeholder = { Text("Ex.: 125430") },
            suffix = { Text("km") },
            singleLine = true,
            isError = invalid || missing,
            supportingText = {
                when {
                    invalid -> Text("Digite só números, até 7 dígitos.")
                    missing -> Text("Informe o km para concluir.")
                    warning != null -> Text("Atenção: $warning", color = Palette.Text)
                }
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
