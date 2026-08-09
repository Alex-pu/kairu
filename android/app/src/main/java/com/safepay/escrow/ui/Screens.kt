package com.safepay.escrow.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.safepay.escrow.data.PaymentMethod
import com.safepay.escrow.data.Transaction

private fun money(cents: Int, currency: String) =
    "$currency ${"%,.2f".format(cents / 100.0)}"

@Composable
fun AppRoot(vm: AppViewModel) {
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    LaunchedEffect(state.toast) {
        state.toast?.let {
            snackbar.showSnackbar(it)
            vm.consumeToast()
        }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { pad ->
        Box(Modifier.padding(pad).fillMaxSize()) {
            when (val s = state.screen) {
                is Screen.Login -> AuthScreen(vm, register = false)
                is Screen.Register -> AuthScreen(vm, register = true)
                is Screen.Dashboard -> DashboardScreen(vm, state)
                is Screen.NewEscrow -> NewEscrowScreen(vm)
                is Screen.Notifications -> NotificationsScreen(vm, state)
                is Screen.Detail -> DetailScreen(vm, state)
            }
            if (state.loading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
        }
    }
}

@Composable
private fun AuthScreen(vm: AppViewModel, register: Boolean) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }

    Column(
        Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.Center
    ) {
        Text("🛡️ SafePay Escrow", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text(
            if (register) "Create an account to buy and sell safely." else "Log in to manage your escrow transactions.",
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(24.dp))
        if (register) {
            OutlinedTextField(
                value = fullName, onValueChange = { fullName = it },
                label = { Text("Full name") }, singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))
        }
        OutlinedTextField(
            value = email, onValueChange = { email = it },
            label = { Text("Email") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth()
        )
        if (register) {
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = phone, onValueChange = { phone = it },
                label = { Text("M-Pesa phone number") }, singleLine = true,
                supportingText = { Text("Where your money is sent when a deal completes.") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth()
            )
        }
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            label = { Text("Password") }, singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = { vm.authenticate(email, password, register, fullName, phone) },
            enabled = email.isNotBlank() && password.length >= 8 &&
                (!register || (fullName.trim().length >= 2 && phone.trim().length >= 10)),
            modifier = Modifier.fillMaxWidth()
        ) { Text(if (register) "Sign up" else "Log in") }
        Spacer(Modifier.height(8.dp))
        TextButton(
            onClick = { vm.navigate(if (register) Screen.Login else Screen.Register) },
            modifier = Modifier.fillMaxWidth()
        ) { Text(if (register) "Already have an account? Log in" else "No account? Sign up") }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DashboardScreen(vm: AppViewModel, state: UiState) {
    Scaffold(topBar = {
        TopAppBar(
            title = { Text("My Escrows") },
            actions = {
                BadgedBox(badge = {
                    if (state.unreadCount > 0) Badge { Text(state.unreadCount.toString()) }
                }) {
                    IconButton(onClick = { vm.navigate(Screen.Notifications) }) {
                        Icon(Icons.Default.Notifications, contentDescription = "Notifications")
                    }
                }
                TextButton(onClick = { vm.logout() }) { Text("Log out") }
            }
        )
    }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize().padding(16.dp)) {
            Button(onClick = { vm.navigate(Screen.NewEscrow) }, modifier = Modifier.fillMaxWidth()) {
                Text("+ New Escrow")
            }
            Spacer(Modifier.height(16.dp))
            if (state.transactions.isEmpty()) {
                Text("No transactions yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    state.transactions.forEach { tx ->
                        TransactionCard(tx, isBuyer = tx.buyerId == state.currentUserId) {
                            vm.navigate(Screen.Detail(tx.id))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TransactionCard(tx: Transaction, isBuyer: Boolean, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth().padding(vertical = 6.dp).clickable(onClick = onClick)) {
        Column(Modifier.padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(tx.description, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                StatusBadge(tx.status)
            }
            Spacer(Modifier.height(6.dp))
            Text(money(tx.amountCents, tx.currency), style = MaterialTheme.typography.titleMedium)
            Text(
                "${if (isBuyer) "Buyer" else "Seller"} • ${tx.method}",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun StatusBadge(status: String) {
    Text(
        status,
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.Bold,
        style = MaterialTheme.typography.labelMedium
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotificationsScreen(vm: AppViewModel, state: UiState) {
    Scaffold(topBar = {
        TopAppBar(
            title = { Text("Notifications") },
            navigationIcon = {
                IconButton(onClick = { vm.navigate(Screen.Dashboard) }) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                }
            }
        )
    }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState())) {
            if (state.notifications.isEmpty()) {
                Text("No notifications yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                state.notifications.forEach { n ->
                    Card(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                        Column(Modifier.padding(14.dp)) {
                            Text(n.message)
                            Spacer(Modifier.height(4.dp))
                            Text(n.createdAt, style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewEscrowScreen(vm: AppViewModel) {
    var sellerEmail by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var currency by remember { mutableStateOf("KES") }
    var method by remember { mutableStateOf(PaymentMethod.MPESA) }
    var menuOpen by remember { mutableStateOf(false) }

    Scaffold(topBar = {
        TopAppBar(
            title = { Text("New Escrow") },
            navigationIcon = {
                IconButton(onClick = { vm.navigate(Screen.Dashboard) }) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                }
            }
        )
    }) { pad ->
        Column(Modifier.padding(pad).fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState())) {
            Text(
                "You deposit funds now; they stay locked until you confirm you received the goods.",
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(sellerEmail, { sellerEmail = it }, label = { Text("Seller's email") },
                singleLine = true, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(description, { description = it }, label = { Text("What are you buying?") },
                modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
            Row {
                OutlinedTextField(amount, { amount = it }, label = { Text("Amount") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true, modifier = Modifier.weight(2f))
                Spacer(Modifier.height(0.dp))
                OutlinedTextField(currency, { currency = it.uppercase().take(3) }, label = { Text("Cur") },
                    singleLine = true, modifier = Modifier.weight(1f).padding(start = 8.dp))
            }
            Spacer(Modifier.height(12.dp))
            Box {
                OutlinedButton(onClick = { menuOpen = true }, modifier = Modifier.fillMaxWidth()) {
                    Text("Payment: ${method.label}")
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    PaymentMethod.values().forEach { m ->
                        DropdownMenuItem(text = { Text(m.label) }, onClick = { method = m; menuOpen = false })
                    }
                }
            }
            Spacer(Modifier.height(20.dp))
            Button(
                onClick = {
                    val cents = ((amount.toDoubleOrNull() ?: 0.0) * 100).toInt()
                    vm.createEscrow(sellerEmail, description, cents, method.api, currency.ifBlank { "KES" })
                },
                enabled = sellerEmail.isNotBlank() && description.length >= 3 && (amount.toDoubleOrNull() ?: 0.0) > 0,
                modifier = Modifier.fillMaxWidth()
            ) { Text("Deposit into escrow") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailScreen(vm: AppViewModel, state: UiState) {
    val tx = state.detail
    var disputeReason by remember { mutableStateOf("") }
    var evidenceUrl by remember { mutableStateOf("") }
    var showDispute by remember { mutableStateOf(false) }
    var showRate by remember { mutableStateOf(false) }
    var rateComment by remember { mutableStateOf("") }
    var rateScore by remember { mutableStateOf(5) }

    Scaffold(topBar = {
        TopAppBar(
            title = { Text("Transaction") },
            navigationIcon = {
                IconButton(onClick = { vm.navigate(Screen.Dashboard) }) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                }
            }
        )
    }) { pad ->
        if (tx == null) {
            Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) { Text("Loading…") }
            return@Scaffold
        }
        val isBuyer = tx.buyerId == state.currentUserId
        Column(Modifier.padding(pad).fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState())) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(tx.description, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                StatusBadge(tx.status)
            }
            Spacer(Modifier.height(8.dp))
            Text(money(tx.amountCents, tx.currency), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("${if (isBuyer) "You are the buyer" else "You are the seller"} • ${tx.method}",
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            (tx.seller?.fullName ?: tx.seller?.email)?.let { name ->
                Text("Seller: $name", style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            tx.sellerReputation?.let { rep ->
                val repText = if (rep.count > 0)
                    "Seller reputation: ★ ${rep.average} · ${rep.count} review${if (rep.count == 1) "" else "s"}"
                else "Seller reputation: no reviews yet"
                Text(repText, style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Spacer(Modifier.height(20.dp))

            // Actions by status. Funds are locked in escrow while HELD, SHIPPED or DELIVERED.
            val heldStates = setOf("HELD", "SHIPPED", "DELIVERED")
            when {
                tx.status in heldStates -> {
                    if (!isBuyer && tx.status == "HELD") {
                        Button(onClick = { vm.markShipped(tx.id) }, modifier = Modifier.fillMaxWidth()) {
                            Text("Mark as shipped")
                        }
                        Spacer(Modifier.height(8.dp))
                    }
                    if (!isBuyer && tx.status == "SHIPPED") {
                        Button(onClick = { vm.markDelivered(tx.id) }, modifier = Modifier.fillMaxWidth()) {
                            Text("Mark as delivered")
                        }
                        Spacer(Modifier.height(8.dp))
                    }
                    if (isBuyer) {
                        Button(onClick = { vm.confirmReceived(tx.id) }, modifier = Modifier.fillMaxWidth()) {
                            Text("Confirm received — release funds")
                        }
                        Spacer(Modifier.height(8.dp))
                    }
                    OutlinedButton(onClick = { showDispute = !showDispute }, modifier = Modifier.fillMaxWidth()) {
                        Text("Open a dispute")
                    }
                    if (showDispute) {
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(disputeReason, { disputeReason = it },
                            label = { Text("Why are you disputing?") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(evidenceUrl, { evidenceUrl = it },
                            label = { Text("Evidence URL (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        Button(
                            onClick = { vm.openDispute(tx.id, disputeReason, evidenceUrl); showDispute = false },
                            enabled = disputeReason.length >= 3, modifier = Modifier.fillMaxWidth()
                        ) { Text("Submit dispute") }
                    }
                }
                tx.status == "RELEASED" -> {
                    OutlinedButton(onClick = { showRate = !showRate }, modifier = Modifier.fillMaxWidth()) {
                        Text("Rate the other party")
                    }
                    if (showRate) {
                        Spacer(Modifier.height(8.dp))
                        Row {
                            (1..5).forEach { s ->
                                TextButton(onClick = { rateScore = s }) {
                                    Text(if (s <= rateScore) "★" else "☆", style = MaterialTheme.typography.titleLarge)
                                }
                            }
                        }
                        OutlinedTextField(rateComment, { rateComment = it }, label = { Text("Comment (optional)") },
                            modifier = Modifier.fillMaxWidth())
                        Button(onClick = { vm.rate(tx.id, rateScore, rateComment); showRate = false },
                            modifier = Modifier.fillMaxWidth()) { Text("Submit rating") }
                    }
                }
                else -> Text("No actions available.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            tx.dispute?.let { d ->
                Spacer(Modifier.height(20.dp))
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Dispute — ${d.status}", fontWeight = FontWeight.Bold)
                        Text(d.reason)
                        d.adminNote?.let { Text("Admin note: $it", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            Text("Timeline", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            tx.events.forEach { ev ->
                Column(Modifier.padding(vertical = 4.dp)) {
                    Text(
                        buildString {
                            ev.fromStatus?.let { append("$it → ") }
                            append(ev.toStatus)
                            ev.note?.let { append(" — $it") }
                        },
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(ev.createdAt, style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
