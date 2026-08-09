package com.safepay.escrow

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.viewmodel.compose.viewModel
import com.safepay.escrow.ui.AppRoot
import com.safepay.escrow.ui.AppViewModel

private val EscrowColors = darkColorScheme(
    primary = Color(0xFF22C55E),
    onPrimary = Color(0xFF06210F),
    background = Color(0xFF0E1116),
    surface = Color(0xFF171B22),
    surfaceVariant = Color(0xFF1E242D),
    error = Color(0xFFEF4444),
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { SafePayApp() }
    }
}

@Composable
fun SafePayApp() {
    MaterialTheme(colorScheme = EscrowColors) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            val vm: AppViewModel = viewModel()
            AppRoot(vm)
        }
    }
}
