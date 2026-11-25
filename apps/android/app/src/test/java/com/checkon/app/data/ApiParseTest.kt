package com.checkon.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/** Resposta que não é da API (Wi-Fi com página de login) não pode fechar o aplicativo. */
class ApiParseTest {
    private fun expectUnexpected(text: String) {
        try {
            Api.parse(PhotoResponse.serializer(), text)
            fail("deveria recusar: $text")
        } catch (e: ApiException) {
            assertTrue("conta como sem conexão: fica na fila", e.offline)
            assertEquals(Api.UNEXPECTED_RESPONSE, e.message)
        }
    }

    @Test fun `resposta certa da API e lida normalmente`() {
        assertEquals("https://api/fotos/x.jpg", Api.parse(PhotoResponse.serializer(), """{"photoUrl":"https://api/fotos/x.jpg","extra":1}""").photoUrl)
    }

    @Test fun `pagina de login do Wi-Fi vira sem conexao em vez de erro de leitura`() {
        expectUnexpected("<!DOCTYPE html><html><head><title>Wi-Fi Posto</title></head><body>Aceite os termos</body></html>")
    }

    @Test fun `resposta vazia, cortada ou com outro formato`() {
        expectUnexpected("")
        expectUnexpected("""{"photoUrl":"https://api/fot""")
        expectUnexpected("""{"outra":"coisa"}""")
        expectUnexpected("[]")
    }
}
