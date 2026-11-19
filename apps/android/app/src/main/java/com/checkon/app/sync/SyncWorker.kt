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
import java.util.concurrent.TimeUnit

/**
 * Envia a fila em segundo plano assim que houver internet,
 * mesmo com o app fechado. O Android tenta de novo sozinho se falhar.
 */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val repository = (applicationContext as CheckOnApp).repository
        val summary = runCatching { repository.sync() }.getOrNull() ?: return Result.success()
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
