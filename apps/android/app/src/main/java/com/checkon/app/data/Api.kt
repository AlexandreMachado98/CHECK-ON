package com.checkon.app.data

import com.checkon.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

val AppJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false // campos nulos não vão para a API (ela recusa campos desconhecidos)
    encodeDefaults = true
}

/** Cliente da API do CHECK-ON. Renova o token sozinho quando ele vence. */
class Api(private val sessions: SessionStore, private val deviceInfo: String) {
    private val baseUrl = BuildConfig.API_URL.trimEnd('/')
    private val json = "application/json".toMediaType()
    private val refreshLock = Mutex()
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(40, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    /** Login do aplicativo: código da empresa + matrícula. */
    suspend fun appLogin(companyCode: String, matricula: String): Session {
        val body = AppJson.encodeToString(
            JsonObject.serializer(),
            JsonObject(mapOf("companyCode" to JsonPrimitive(companyCode), "matricula" to JsonPrimitive(matricula))),
        )
        val (code, text) = call(Request.Builder().url("$baseUrl/auth/app-login").post(body.toRequestBody(json)).build())
        if (code !in 200..299) throw errorFrom(code, text)
        val session = AppJson.decodeFromString(TokenResponse.serializer(), text).toSession()
        sessions.save(session)
        return session
    }

    /** Sai do aplicativo. Avisar o servidor é melhor esforço: sem internet, o token só expira sozinho. */
    suspend fun logout() {
        val current = sessions.current() ?: return
        sessions.save(null)
        runCatching {
            val body = """{"refreshToken":${JsonPrimitive(current.refreshToken)}}"""
            call(
                Request.Builder().url("$baseUrl/auth/logout")
                    .header("Authorization", "Bearer ${current.accessToken}")
                    .post(body.toRequestBody(json)).build(),
            )
        }
    }

    suspend fun bootstrap(): Bootstrap =
        AppJson.decodeFromString(Bootstrap.serializer(), authorized { it.url("$baseUrl/mobile/bootstrap").get() })

    suspend fun vehicleNcs(vehicleId: String): List<OpenNc> =
        AppJson.decodeFromString(
            kotlinx.serialization.builtins.ListSerializer(OpenNc.serializer()),
            authorized { it.url("$baseUrl/mobile/vehicles/$vehicleId/ncs").get() },
        )

    suspend fun uploadPhoto(file: File): String {
        val text = authorized {
            val body: RequestBody = MultipartBody.Builder().setType(MultipartBody.FORM)
                .addFormDataPart("file", "foto.jpg", file.asRequestBody("image/jpeg".toMediaType()))
                .build()
            it.url("$baseUrl/checklists/photos").post(body)
        }
        return AppJson.decodeFromString(PhotoResponse.serializer(), text).photoUrl
    }

    suspend fun sync(payloads: List<SubmitPayload>): List<SyncResult> {
        val body = AppJson.encodeToString(SyncRequest.serializer(), SyncRequest(payloads))
        val text = authorized { it.url("$baseUrl/checklists/sync").post(body.toRequestBody(json)) }
        return AppJson.decodeFromString(SyncResponse.serializer(), text).results
    }

    /** Chamada com o token; se ele venceu, renova e tenta de novo uma vez. */
    private suspend fun authorized(build: (Request.Builder) -> Request.Builder): String {
        suspend fun send(): Pair<Int, String> {
            val session = sessions.current() ?: throw SessionEndedException("Entre no aplicativo.")
            val request = build(Request.Builder())
                .header("Authorization", "Bearer ${session.accessToken}")
                .header("X-Device-Info", deviceInfo)
                .header("Accept", "application/json")
                .build()
            return call(request)
        }
        var (code, text) = send()
        if (code == 401) {
            refresh()
            val retry = send()
            code = retry.first
            text = retry.second
        }
        if (code == 401) {
            sessions.save(null)
            throw SessionEndedException(messageFrom(text, "Sua sessão terminou. Entre de novo."))
        }
        if (code !in 200..299) throw errorFrom(code, text)
        return text
    }

    /** Uma renovação por vez: o servidor encerra a sessão se o mesmo refresh token for usado duas vezes. */
    private suspend fun refresh() {
        val before = sessions.current() ?: throw SessionEndedException("Entre no aplicativo.")
        refreshLock.withLock {
            val current = sessions.current() ?: throw SessionEndedException("Entre no aplicativo.")
            if (current.accessToken != before.accessToken) return // outra chamada já renovou
            val body = """{"refreshToken":${JsonPrimitive(current.refreshToken)}}"""
            val (code, text) = call(Request.Builder().url("$baseUrl/auth/refresh").post(body.toRequestBody(json)).build())
            if (code == 401 || code == 403) {
                sessions.save(null)
                throw SessionEndedException(messageFrom(text, "Sua sessão terminou. Entre de novo."))
            }
            if (code !in 200..299) throw errorFrom(code, text)
            sessions.save(AppJson.decodeFromString(TokenResponse.serializer(), text).toSession())
        }
    }

    private suspend fun call(request: Request): Pair<Int, String> = withContext(Dispatchers.IO) {
        try {
            client.newCall(request).execute().use { response: Response -> response.code to (response.body?.string() ?: "") }
        } catch (e: IOException) {
            throw ApiException("Sem conexão com o servidor. Confira a internet e tente de novo.", 0, offline = true)
        }
    }

    private fun errorFrom(code: Int, text: String): ApiException = when {
        // Servidor com problema: trata como "sem conexão" para a inspeção ficar na fila e ser reenviada.
        code >= 500 -> ApiException("O servidor está com instabilidade. Tente de novo em instantes.", code, offline = true)
        code == 429 -> ApiException(messageFrom(text, "Muitas tentativas. Aguarde alguns minutos."), code)
        else -> ApiException(messageFrom(text, "Erro $code."), code)
    }

    companion object {
        /** Mensagem de erro da API (NestJS devolve texto ou lista em "message"). */
        fun messageFrom(text: String, fallback: String): String = try {
            when (val message = (AppJson.parseToJsonElement(text) as? JsonObject)?.get("message")) {
                is JsonArray -> message.mapNotNull { it.jsonPrimitive.contentOrNull?.takeIf(String::isNotBlank) }
                    .joinToString("\n").ifBlank { fallback }
                is JsonPrimitive -> message.contentOrNull?.takeIf(String::isNotBlank) ?: fallback
                else -> fallback
            }
        } catch (_: Exception) {
            fallback
        }

        private fun TokenResponse.toSession() = Session(accessToken, refreshToken, user)
    }
}
