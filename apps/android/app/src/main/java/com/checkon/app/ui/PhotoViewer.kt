package com.checkon.app.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

private const val MAX_ZOOM = 5f
private const val DOUBLE_TAP_ZOOM = 2.5f

/**
 * Foto em tela cheia: pinça para ampliar, arrasta para mover e toque duplo para
 * alternar entre a foto inteira e o zoom. A foto já está reduzida e na orientação
 * certa (Photos.finish), então é aberta inteira.
 */
@Composable
fun PhotoViewer(path: String, title: String, onClose: () -> Unit) {
    var bitmap by remember(path) { mutableStateOf<Result<ImageBitmap>?>(null) }
    LaunchedEffect(path) {
        bitmap = withContext(Dispatchers.IO) {
            runCatching {
                BitmapFactory.decodeFile(path)?.asImageBitmap() ?: error("Foto ilegível")
            }
        }
    }
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    var area by remember { mutableStateOf(IntSize.Zero) }

    // Não deixa a foto sair da tela: o deslocamento máximo cresce com o zoom.
    fun clamp(value: Offset, zoom: Float): Offset {
        val maxX = (area.width * (zoom - 1f) / 2f).coerceAtLeast(0f)
        val maxY = (area.height * (zoom - 1f) / 2f).coerceAtLeast(0f)
        return Offset(value.x.coerceIn(-maxX, maxX), value.y.coerceIn(-maxY, maxY))
    }

    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black)
                .onSizeChanged { area = it },
            contentAlignment = Alignment.Center,
        ) {
            when (val result = bitmap) {
                null -> CircularProgressIndicator(color = Color.White)
                else -> result.fold(
                    onSuccess = { image ->
                        Image(
                            image,
                            contentDescription = title,
                            contentScale = ContentScale.Fit,
                            modifier = Modifier
                                .fillMaxSize()
                                .pointerInput(Unit) {
                                    detectTapGestures(onDoubleTap = { tap ->
                                        if (scale > 1f) {
                                            scale = 1f
                                            offset = Offset.Zero
                                        } else {
                                            // Amplia em volta do ponto tocado.
                                            val center = Offset(size.width / 2f, size.height / 2f)
                                            scale = DOUBLE_TAP_ZOOM
                                            offset = clamp((center - tap) * (DOUBLE_TAP_ZOOM - 1f), DOUBLE_TAP_ZOOM)
                                        }
                                    })
                                }
                                .pointerInput(Unit) {
                                    detectTransformGestures { _, pan, zoom, _ ->
                                        val next = (scale * zoom).coerceIn(1f, MAX_ZOOM)
                                        scale = next
                                        offset = if (next == 1f) Offset.Zero else clamp(offset + pan, next)
                                    }
                                }
                                .graphicsLayer {
                                    scaleX = scale
                                    scaleY = scale
                                    translationX = offset.x
                                    translationY = offset.y
                                },
                        )
                    },
                    onFailure = {
                        Text("Não foi possível abrir a foto.", color = Color.White, fontSize = 16.sp)
                    },
                )
            }

            Box(Modifier.fillMaxSize().safeDrawingPadding()) {
                IconButton(
                    onClick = onClose,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .background(Color.Black.copy(alpha = 0.55f), CircleShape),
                ) {
                    Icon(Icons.Filled.Close, contentDescription = "Fechar foto", tint = Color.White)
                }
                Text(
                    title,
                    color = Color.White,
                    fontSize = 14.sp,
                    maxLines = 2,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp)
                        .background(Color.Black.copy(alpha = 0.55f), androidx.compose.foundation.shape.RoundedCornerShape(10.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
        }
    }
}
