package com.checkon.app.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.hasSetTextAction
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w360dp-h740dp-xhdpi")
class OdometerCardTest {
    @get:Rule val compose = createComposeRule()

    @Test fun `mostra o ultimo km, devolve o numero digitado e avisa quando e menor`() {
        var latest: Int? = -1
        compose.setContent { OdometerCard(km = null, lastKm = 50_000, highlighted = false, onChange = { latest = it }) }
        compose.onNodeWithText("Digite o km do painel. Último registro: 50.000 km.").assertExists()
        compose.onNode(hasSetTextAction()).performTextInput("49000")
        compose.waitForIdle()
        assertEquals(49_000, latest)
        compose.onNodeWithText("Atenção: menor que o último registro (50.000 km). Confira o painel.").assertExists()
    }

    @Test fun `sem km ao concluir pede o numero e letras sao ignoradas`() {
        var latest: Int? = -1
        compose.setContent { OdometerCard(km = null, lastKm = 0, highlighted = true, onChange = { latest = it }) }
        compose.onNodeWithText("Informe o km para concluir.").assertExists()
        compose.onNode(hasSetTextAction()).performTextInput("abc")
        compose.waitForIdle()
        assertNull(latest)
    }
}
