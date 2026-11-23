package com.checkon.app.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w360dp-h740dp-xhdpi")
class SignatureCardTest {
    @get:Rule val compose = createComposeRule()

    @Test fun `desfazer apaga so o ultimo traco e limpar apaga tudo`() {
        val first = listOf(0.1f, 0.1f, 0.2f, 0.2f)
        val second = listOf(0.5f, 0.5f, 0.6f, 0.6f)
        var latest: List<List<Float>> = emptyList()
        compose.setContent {
            var strokes by remember { mutableStateOf(listOf(first, second)) }
            SignatureCard("Ana Souza", strokes, highlighted = false, onChange = { strokes = it; latest = it })
        }
        compose.onNodeWithText("Desfazer").performClick()
        compose.waitForIdle()
        assertEquals(listOf(first), latest)
        compose.onNodeWithText("Limpar").performClick()
        compose.waitForIdle()
        assertEquals(emptyList<List<Float>>(), latest)
        // Sem traços, os botões somem.
        compose.onNodeWithText("Desfazer").assertDoesNotExist()
    }
}
