package com.checkon.app.ui

import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotFocused
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Botões de resposta em celular de 360dp (área útil do cartão: 296dp), com a fonte normal
 * e com a fonte grande do sistema.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w360dp-h740dp-xhdpi")
class AnswerChoicesTest {
    @get:Rule val compose = createComposeRule()

    private fun show(fontScale: Float, failed: Boolean = false, onFailed: () -> Unit = {}) {
        compose.setContent {
            val base = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(base.density, fontScale)) {
                androidx.compose.foundation.layout.Box(Modifier.width(296.dp)) {
                    AnswerChoices(compliant = false, failed = failed, na = false, onCompliant = {}, onFailed = onFailed, onNa = {})
                }
            }
        }
    }

    private fun top(text: String) = compose.onNodeWithText(text).getBoundsInRoot().top
    private fun bottom(text: String) = compose.onNodeWithText(text).getBoundsInRoot().bottom

    @Test fun `fonte normal - tres opcoes lado a lado`() {
        show(fontScale = 1f)
        assertEquals(top("Conforme"), top("Não conforme"))
        assertEquals(top("Conforme"), top("N/A"))
    }

    @Test fun `fonte grande - uma embaixo da outra, sem cortar o texto`() {
        show(fontScale = 1.5f)
        assertTrue(bottom("Conforme") <= top("Não conforme"))
        assertTrue(bottom("Não conforme") <= top("N/A · não se aplica"))
    }

    @Test fun `leitor de tela anuncia a opcao marcada`() {
        var clicked = 0
        show(fontScale = 1f, failed = true, onFailed = { clicked++ })
        compose.onNodeWithText("Não conforme", useUnmergedTree = false)
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Selected, true))
        compose.onNodeWithText("Conforme")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.Selected, false))
        compose.onNodeWithText("Não conforme").performClick()
        assertEquals(1, clicked)
    }

    @Test fun `escolher a resposta tira o foco da observacao (fecha o teclado)`() {
        compose.setContent {
            androidx.compose.foundation.layout.Column(Modifier.width(296.dp)) {
                var text by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf("") }
                androidx.compose.material3.OutlinedTextField(
                    value = text,
                    onValueChange = { text = it },
                    modifier = Modifier.semantics { testTag = "obs" },
                )
                AnswerChoices(compliant = false, failed = false, na = false, onCompliant = {}, onFailed = {}, onNa = {})
            }
        }
        compose.onNodeWithTag("obs").performClick()
        compose.onNodeWithTag("obs").assertIsFocused()
        compose.onNodeWithText("Conforme").performClick()
        compose.onNodeWithTag("obs").assertIsNotFocused()
    }
}
