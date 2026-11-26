package com.checkon.app.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.checkon.app.CheckOnApp
import com.checkon.app.data.SessionEndedException
import java.util.concurrent.TimeUnit

/**
 * Envia a fila em segundo plano assim que houver internet,
 * mesmo com o app fechado. O Android tenta de novo sozinho se falhar.
 */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val repository = (applicationContext as CheckOnApp).repository
        val summary = try {
            repository.sync() ?: return Result.success() // ninguém logado: nada a enviar
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (e: SessionEndedException) {
            return Result.success() // envia quando a pessoa entrar de novo (o app chama o envio ao entrar)
        } catch (e: Exception) {
            return Result.retry() // erro inesperado: tenta de novo mais tarde em vez de desistir
        }
        return if (summary.offline || summary.pending > 0) Result.retry() else Result.success()
    }

    companion object {
        fun schedule(context: Context) {
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork("checkon-sync", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
        }
    }
}
