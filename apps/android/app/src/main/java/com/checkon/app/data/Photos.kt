package com.checkon.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.net.Uri
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID
import kotlin.math.max

/** Fotos da inspeção: ficam na área privada do app até serem enviadas. */
class Photos(private val context: Context) {
    private val dir get() = File(context.filesDir, "photos").apply { mkdirs() }

    /** Arquivo vazio para a câmera do sistema gravar a foto, e a Uri para entregar a ela. */
    fun newCaptureTarget(): Pair<File, Uri> {
        val file = File(dir, "${UUID.randomUUID()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
        return file to uri
    }

    /**
     * Reduz a foto para no máximo 1600 px e JPEG 70% (a API aceita até 4 MB),
     * já na orientação certa. Devolve o caminho, ou null se a câmera não gravou nada.
     */
    suspend fun finish(file: File): String? = withContext(Dispatchers.IO) {
        if (!file.exists() || file.length() == 0L) {
            file.delete()
            return@withContext null
        }
        runCatching {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.path, bounds)
            var sample = 1
            while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SIDE) sample *= 2
            val decoded = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
                ?: return@runCatching
            val scale = MAX_SIDE.toFloat() / max(decoded.width, decoded.height)
            val rotation = when (ExifInterface(file.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
            val matrix = Matrix().apply {
                if (scale < 1f) postScale(scale, scale)
                if (rotation != 0f) postRotate(rotation)
            }
            val output = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
            file.outputStream().use { output.compress(Bitmap.CompressFormat.JPEG, 70, it) }
            if (output !== decoded) output.recycle()
            decoded.recycle()
        }
        file.path
    }

    /**
     * Imagem PNG da assinatura (traço escuro sobre branco, sempre igual no tema claro ou escuro).
     * [strokes]: traços com x, y de 0 a 1, como guardados no rascunho. Devolve o caminho do arquivo.
     */
    suspend fun saveSignature(strokes: List<List<Float>>): String = withContext(Dispatchers.IO) {
        val width = SIGNATURE_WIDTH
        val height = SIGNATURE_HEIGHT
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(15, 23, 42)
            style = Paint.Style.STROKE
            strokeWidth = 7f
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        for (stroke in strokes) {
            if (stroke.size < 2) continue
            val path = Path()
            path.moveTo(stroke[0] * width, stroke[1] * height)
            var i = 2
            while (i + 1 < stroke.size) {
                path.lineTo(stroke[i] * width, stroke[i + 1] * height)
                i += 2
            }
            if (stroke.size == 2) path.lineTo(stroke[0] * width + 0.5f, stroke[1] * height)
            canvas.drawPath(path, paint)
        }
        val file = File(dir, "assinatura-${UUID.randomUUID()}.png")
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
        file.path
    }

    fun delete(path: String?) {
        if (path != null) runCatching { File(path).delete() }
    }

    /** Apaga fotos que não estão em nenhuma inspeção guardada (foto refeita, rascunho descartado). */
    fun cleanOrphans(inUse: Collection<String>) {
        val keep = inUse.map { File(it).name }.toSet()
        // Não mexe em fotos recentes: pode ser uma foto sendo tirada agora.
        val limit = System.currentTimeMillis() - 30 * 60 * 1000
        dir.listFiles()?.forEach { if (it.name !in keep && it.lastModified() < limit) it.delete() }
    }

    companion object {
        private const val MAX_SIDE = 1600
        /** Tamanho da imagem da assinatura (mesma proporção 3:1 da área de assinar). */
        const val SIGNATURE_WIDTH = 900
        const val SIGNATURE_HEIGHT = 300
    }
}
