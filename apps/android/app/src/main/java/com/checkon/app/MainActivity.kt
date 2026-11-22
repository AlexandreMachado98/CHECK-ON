@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.checkon.app

import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.LocalOnBackPressedDispatcherOwner
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.compose.ui.text.font.FontWeight
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.checkon.app.ui.AppViewModel
import com.checkon.app.ui.CheckOnTheme
import com.checkon.app.ui.DoneScreen
import com.checkon.app.ui.HomeScreen
import com.checkon.app.ui.InspectionScreen
import com.checkon.app.ui.LoginScreen
import com.checkon.app.ui.Palette
import com.checkon.app.ui.QueueScreen
import com.checkon.app.ui.ThemeButton
import com.checkon.app.ui.VehicleScreen
import com.checkon.app.ui.VehiclesScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        // Antes do super.onCreate: mostra a tela de abertura e depois troca para o tema do app.
        installSplashScreen()
        super.onCreate(savedInstanceState)
        // Ao voltar para o app: atualiza os dados e envia a fila.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) { vm.catchUp() }
        }
        setContent {
            val themeMode by vm.themeSettings.mode.collectAsState()
            val dark = themeMode.isDark(isSystemInDarkTheme())
            CheckOnTheme(dark = dark) {
                SystemBars(dark)
                val session by vm.session.collectAsState()
                if (session == null) LoginScreen(vm) else AppNavigation(vm)
            }
        }
    }
}

private val TITLES = mapOf(
    "home" to "CHECK-ON",
    "vehicles" to "Escolher veículo",
    "vehicle/{id}" to "Veículo",
    "inspection/{vehicleId}/{templateId}" to "Inspeção",
    "done/{clientId}" to "Inspeção concluída",
    "queue" to "Envios",
)

@Composable
private fun AppNavigation(vm: AppViewModel) {
    val nav = rememberNavController()
    val backDispatcher = LocalOnBackPressedDispatcherOwner.current?.onBackPressedDispatcher
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val canGoBack = route != null && route != "home" && !route.startsWith("done")

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(TITLES[route] ?: "CHECK-ON", fontWeight = FontWeight.Bold) },
                actions = {
                    if (route == "home") ThemeButton(vm.themeSettings)
                },
                navigationIcon = {
                    if (canGoBack) {
                        // Passa pelo mesmo caminho do "voltar" do celular, para a tela poder interceptar (ex.: inspeção).
                        IconButton(onClick = { backDispatcher?.onBackPressed() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar") }
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = Palette.Surface),
            )
        },
        containerColor = Palette.Background,
    ) { padding ->
        // consumeWindowInsets: o imePadding das telas não soma de novo a barra de navegação.
        Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
            NavHost(nav, startDestination = "home") {
                composable("home") {
                    HomeScreen(
                        vm,
                        onNewInspection = { nav.navigate("vehicles") },
                        onVehicle = { nav.navigate("vehicle/$it") },
                        onQueue = { nav.navigate("queue") },
                        onResumeDraft = { v, t -> nav.navigate("inspection/$v/$t") },
                    )
                }
                composable("vehicles") { VehiclesScreen(vm, onVehicle = { nav.navigate("vehicle/$it") }) }
                composable("vehicle/{id}") { back ->
                    VehicleScreen(vm, back.arguments?.getString("id") ?: "", onStart = { v, t -> nav.navigate("inspection/$v/$t") })
                }
                composable("inspection/{vehicleId}/{templateId}") { back ->
                    InspectionScreen(
                        vm,
                        vehicleId = back.arguments?.getString("vehicleId") ?: "",
                        templateId = back.arguments?.getString("templateId") ?: "",
                        onDone = { clientId -> nav.goHomeThen("done/$clientId") },
                        onDiscarded = { nav.popBackStack() },
                        onLeave = { nav.popBackStack() },
                    )
                }
                composable("done/{clientId}") { back ->
                    DoneScreen(
                        vm,
                        clientId = back.arguments?.getString("clientId") ?: "",
                        onNew = { nav.goHomeThen("vehicles") },
                        onHome = { nav.popBackStack("home", inclusive = false) },
                    )
                }
                composable("queue") { QueueScreen(vm) }
            }
        }
    }
}

/**
 * Barra de status e de navegação com as cores do tema escolhido no app
 * (o tema do sistema em values-night só acompanha o modo do celular).
 */
@Suppress("DEPRECATION")
@Composable
private fun ComponentActivity.SystemBars(dark: Boolean) {
    val statusBar = Palette.Surface.toArgb()
    val navigationBar = Palette.Background.toArgb()
    SideEffect {
        window.statusBarColor = statusBar
        window.navigationBarColor = navigationBar
        window.setBackgroundDrawable(ColorDrawable(navigationBar))
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !dark
            isAppearanceLightNavigationBars = !dark
        }
    }
}

/** Volta para o início e abre a tela pedida (o "voltar" do celular leva ao início). */
private fun NavHostController.goHomeThen(route: String) {
    navigate(route) { popUpTo("home") { inclusive = false } }
}
