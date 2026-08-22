package br.com.smartchannel.playeradmon.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import br.com.smartchannel.playeradmon.PlayerAdMonApplication
import br.com.smartchannel.playeradmon.ui.screens.LoginScreen
import br.com.smartchannel.playeradmon.ui.screens.MonitorScreen
import br.com.smartchannel.playeradmon.ui.screens.SettingsScreen
import br.com.smartchannel.playeradmon.ui.screens.TotemListScreen
import br.com.smartchannel.playeradmon.ui.theme.PlayerAdMonTheme
import br.com.smartchannel.playeradmon.ui.viewmodel.AppViewModelFactory
import br.com.smartchannel.playeradmon.ui.viewmodel.AuthViewModel
import br.com.smartchannel.playeradmon.ui.viewmodel.MonitorViewModel
import br.com.smartchannel.playeradmon.ui.viewmodel.SettingsViewModel
import br.com.smartchannel.playeradmon.ui.viewmodel.TotemListViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as PlayerAdMonApplication
        setContent {
            PlayerAdMonTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    PlayerAdMonApp(app)
                }
            }
        }
    }
}

@Composable
private fun PlayerAdMonApp(app: PlayerAdMonApplication) {
    val factory = AppViewModelFactory(app.container)
    val authVm: AuthViewModel = viewModel(factory = factory)
    val isAuthenticated by authVm.isAuthenticated.collectAsState()

    if (!isAuthenticated) {
        LoginScreen(viewModel = authVm)
        return
    }

    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = "totems") {
        composable("totems") {
            val listVm: TotemListViewModel = viewModel(factory = factory)
            TotemListScreen(
                viewModel = listVm,
                onOpenTotem = { id -> nav.navigate("monitor/$id") },
                onOpenSettings = { nav.navigate("settings") },
            )
        }
        composable(
            route = "monitor/{totemId}",
            arguments = listOf(navArgument("totemId") { type = NavType.IntType }),
        ) { entry ->
            val totemId = entry.arguments?.getInt("totemId") ?: return@composable
            val monitorVm: MonitorViewModel = viewModel(
                key = "monitor-$totemId",
                factory = factory.forMonitor(totemId),
            )
            MonitorScreen(
                viewModel = monitorVm,
                onBack = { nav.popBackStack() },
            )
        }
        composable("settings") {
            val settingsVm: SettingsViewModel = viewModel(factory = factory)
            SettingsScreen(
                viewModel = settingsVm,
                onBack = { nav.popBackStack() },
                onLogout = {
                    authVm.logout()
                },
            )
        }
    }
}
