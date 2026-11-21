package com.checkon.app.ui

import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.View

/** Tipo de toque ao marcar uma resposta. */
enum class AnswerFeel { Confirm, Reject, Neutral }

/**
 * Vibração curta ao marcar a resposta, para o motorista sentir que registrou sem
 * olhar a tela. Usa o retorno tátil do sistema: respeita o ajuste "vibrar ao tocar"
 * do celular e não precisa de permissão.
 * Android 11+: "confirmar" e "recusar" têm toques diferentes; antes disso, toque simples.
 */
fun View.answerHaptic(feel: AnswerFeel) {
    val constant = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        when (feel) {
            AnswerFeel.Confirm -> HapticFeedbackConstants.CONFIRM
            AnswerFeel.Reject -> HapticFeedbackConstants.REJECT
            AnswerFeel.Neutral -> HapticFeedbackConstants.VIRTUAL_KEY
        }
    } else {
        when (feel) {
            AnswerFeel.Reject -> HapticFeedbackConstants.LONG_PRESS
            else -> HapticFeedbackConstants.VIRTUAL_KEY
        }
    }
    performHapticFeedback(constant)
}
