package com.checkon.app.data

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import kotlin.math.max
import kotlin.random.Random

/** Foto reduzida logo depois de tirada: tamanho máximo e qualidade do JPEG. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34])
class PhotosTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private val photos = Photos(context)
    /** Arquivo onde a câmera teria gravado a foto (o FileProvider não entra no teste). */
    private fun newFile() = File(context.filesDir, "photos/${java.util.UUID.randomUUID()}.jpg").apply { parentFile?.mkdirs() }

    /** Imagem com textura (como uma foto de verdade), do tamanho de uma câmera de celular. */
    private fun cameraPhoto(width: Int, height: Int): File {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val random = Random(7)
        val pixels = IntArray(width * height) { i ->
            val x = i % width; val y = i / width
            val base = ((x / 40 + y / 40) % 2) * 60
            Color.rgb(90 + base + random.nextInt(40), 110 + random.nextInt(40), 70 + (y * 80 / height) + random.nextInt(30))
        }
        bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
        val file = newFile()
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 92, it) }
        return file
    }

    private fun bounds(path: String) = BitmapFactory.Options().apply { inJustDecodeBounds = true }.also { BitmapFactory.decodeFile(path, it) }

    @Test fun `foto grande da camera fica com no maximo 1280 px e bem menor`() = runBlocking {
        val file = cameraPhoto(4000, 3000)
        val original = file.length()
        val path = photos.finish(file)!!
        val b = bounds(path)
        assertEquals(1280, max(b.outWidth, b.outHeight))
        assertEquals(960, minOf(b.outWidth, b.outHeight)) // mantém a proporção 4:3
        assertTrue("reduzida: ${File(path).length()} de $original bytes", File(path).length() < original / 5)
    }

    @Test fun `1280 px e 60 por cento ocupam bem menos que 1600 px e 70 por cento`() = runBlocking {
        assertEquals(1280, Photos.MAX_SIDE)
        assertEquals(60, Photos.JPEG_QUALITY)
        val source = BitmapFactory.decodeFile(cameraPhoto(1600, 1200).path)
        fun encoded(bitmap: Bitmap, quality: Int) = java.io.ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.JPEG, quality, it) }.size()
        val before = encoded(source, 70)
        val after = encoded(Bitmap.createScaledBitmap(source, 1280, 960, true), 60)
        assertTrue("1280/60: $after bytes vs 1600/70: $before bytes", after < before * 0.7)
    }

    @Test fun `foto pequena nao e ampliada`() = runBlocking {
        val path = photos.finish(cameraPhoto(800, 600))!!
        assertEquals(800, bounds(path).outWidth)
    }

    @Test fun `camera que nao gravou nada`() = runBlocking {
        val empty = newFile().apply { createNewFile() }
        assertNull(photos.finish(empty))
    }

    @Test fun `miniatura nitida no quadro de 96dp em qualquer tela`() = runBlocking {
        // 1280x960 já reduzida pelo app. Quadro de 96dp: 288 px (xxhdpi), 384 px (xxxhdpi), 144 px (mdpi).
        assertEquals(2, Photos.thumbnailSample(1280, 960, 288)) // 640x480: cobre 288 sem perder nitidez
        assertEquals(2, Photos.thumbnailSample(1280, 960, 384))
        assertEquals(4, Photos.thumbnailSample(1280, 960, 144))
        assertEquals(1, Photos.thumbnailSample(200, 150, 288)) // foto pequena: lê inteira
        val path = photos.finish(cameraPhoto(4000, 3000))!!
        val thumb = Photos.decodeThumbnail(path, 288)!!
        assertTrue("lado menor ${thumb.height} cobre o quadro de 288 px", minOf(thumb.width, thumb.height) >= 288)
        assertTrue("leve: ${thumb.width}x${thumb.height}", thumb.width <= 640)
    }

    @Test fun `miniatura de arquivo ilegivel ou ausente`() = runBlocking {
        assertNull(Photos.decodeThumbnail(File(context.filesDir, "nao-existe.jpg").path, 288))
        val junk = newFile().apply { writeText("isto não é uma foto") }
        assertNull(Photos.decodeThumbnail(junk.path, 288))
    }

    @Test fun `camera gravou lixo ou foto pela metade, nada de foto falsa`() = runBlocking {
        val broken = newFile().apply { writeBytes(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()) + ByteArray(500) { 7 }) }
        assertNull(photos.finish(broken))
        assertTrue("apaga o arquivo quebrado", !broken.exists())
        assertTrue("não sobra temporário", File(broken.path + ".tmp").exists().not())
    }

    @Test fun `foto boa nao deixa arquivo temporario`() = runBlocking {
        val path = photos.finish(cameraPhoto(2000, 1500))!!
        assertTrue(File("$path.tmp").exists().not())
        assertEquals(1280, bounds(path).outWidth)
    }
}
