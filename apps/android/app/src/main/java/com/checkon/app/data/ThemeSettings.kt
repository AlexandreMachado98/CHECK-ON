package com.checkon.app.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Tema escolhido no app. AUTOMATICO segue o modo claro/escuro do celular. */
enum class ThemeMode(val label: String) {
    AUTOMATICO("Automático (igual ao celular)"),
    CLARO("Claro"),
    ESCURO("Escuro");

    /** Se o app deve ficar escuro, dado o modo atual do celular. */
    fun isDark(systemDark: Boolean): Boolean = when (this) {
        AUTOMATICO -> systemDark
        CLARO -> false
        ESCURO -> true
    }

    companion object {
        /** Valor salvo → modo. Valor desconhecido ou ausente volta para AUTOMATICO. */
        fun fromStored(value: String?): ThemeMode = entries.firstOrNull { it.name == value } ?: AUTOMATICO
    }
}

/** Preferência de tema do aparelho (vale para quem usar o celular, mesmo sem login). */
class ThemeSettings(context: Context) {
    private val prefs = context.getSharedPreferences("checkon.settings", Context.MODE_PRIVATE)
    private val state = MutableStateFlow(ThemeMode.fromStored(prefs.getString(KEY, null)))
    val mode: StateFlow<ThemeMode> = state

    fun set(mode: ThemeMode) {
        prefs.edit().putString(KEY, mode.name).apply()
        state.value = mode
    }

    private companion object {
        const val KEY = "themeMode"
    }
}
