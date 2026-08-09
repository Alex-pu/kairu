package com.safepay.escrow.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.safepay.escrow.data.ApiClient
import com.safepay.escrow.data.ApiService
import com.safepay.escrow.data.CreateEscrowRequest
import com.safepay.escrow.data.OpenDisputeRequest
import com.safepay.escrow.data.RateRequest
import com.safepay.escrow.data.Session
import com.safepay.escrow.data.Transaction
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface Screen {
    data object Login : Screen
    data object Register : Screen
    data object Dashboard : Screen
    data object NewEscrow : Screen
    data object Notifications : Screen
    data class Detail(val id: String) : Screen
}

data class UiState(
    val screen: Screen = Screen.Login,
    val loading: Boolean = false,
    val transactions: List<Transaction> = emptyList(),
    val detail: Transaction? = null,
    val toast: String? = null,
    val isAdmin: Boolean = false,
    val currentUserId: String? = null,
    val notifications: List<com.safepay.escrow.data.Notification> = emptyList(),
    val unreadCount: Int = 0,
)

class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val session = Session(app)
    private val api: ApiService = ApiClient.create(session)

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    init {
        if (session.isLoggedIn) {
            syncSessionFlags()
            navigate(Screen.Dashboard)
            loadTransactions()
        }
    }

    private fun syncSessionFlags() {
        _state.value = _state.value.copy(isAdmin = session.isAdmin, currentUserId = session.userId)
    }

    fun navigate(screen: Screen) {
        _state.value = _state.value.copy(screen = screen)
        when (screen) {
            is Screen.Dashboard -> { loadTransactions(); refreshUnread() }
            is Screen.Detail -> loadDetail(screen.id)
            is Screen.Notifications -> loadNotifications()
            else -> {}
        }
    }

    fun consumeToast() { _state.value = _state.value.copy(toast = null) }
    private fun toast(msg: String) { _state.value = _state.value.copy(toast = msg) }

    private inline fun launchGuarded(crossinline block: suspend () -> Unit) {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true)
            try {
                block()
            } catch (t: Throwable) {
                toast(ApiClient.errorMessage(t))
            } finally {
                _state.value = _state.value.copy(loading = false)
            }
        }
    }

    fun authenticate(email: String, password: String, register: Boolean, fullName: String = "", phone: String = "") = launchGuarded {
        val res = if (register) {
            api.register(com.safepay.escrow.data.RegisterRequest(email.trim(), password, fullName.trim(), phone.trim()))
        } else {
            api.login(com.safepay.escrow.data.Credentials(email.trim(), password))
        }
        session.token = res.token
        syncSessionFlags()
        toast(if (register) "Account created" else "Logged in")
        navigate(Screen.Dashboard)
    }

    fun logout() {
        session.logout()
        _state.value = UiState(screen = Screen.Login)
    }

    fun loadTransactions() = launchGuarded {
        _state.value = _state.value.copy(transactions = api.listTransactions())
    }

    fun loadDetail(id: String) = launchGuarded {
        _state.value = _state.value.copy(detail = api.getTransaction(id))
    }

    fun createEscrow(sellerEmail: String, description: String, amountCents: Int, method: String, currency: String) =
        launchGuarded {
            val tx = api.createEscrow(CreateEscrowRequest(sellerEmail.trim(), description.trim(), amountCents, method, currency))
            toast("Funds deposited and held in escrow")
            navigate(Screen.Detail(tx.id))
        }

    fun markShipped(id: String) = launchGuarded {
        api.markShipped(id)
        toast("Marked as shipped — buyer notified")
        loadDetail(id)
    }

    fun markDelivered(id: String) = launchGuarded {
        api.markDelivered(id)
        toast("Marked as delivered — buyer notified")
        loadDetail(id)
    }

    fun confirmReceived(id: String) = launchGuarded {
        api.confirmReceived(id)
        toast("Funds released to seller")
        loadDetail(id)
    }

    fun openDispute(id: String, reason: String, evidenceUrl: String?) = launchGuarded {
        api.openDispute(OpenDisputeRequest(id, reason.trim(), evidenceUrl?.takeIf { it.isNotBlank() }?.let { listOf(it) } ?: emptyList()))
        toast("Dispute opened")
        loadDetail(id)
    }

    fun rate(id: String, score: Int, comment: String?) = launchGuarded {
        api.rate(RateRequest(id, score, comment?.takeIf { it.isNotBlank() }))
        toast("Thanks for rating")
        loadDetail(id)
    }

    fun loadNotifications() = launchGuarded {
        val res = api.notifications()
        _state.value = _state.value.copy(notifications = res.items, unreadCount = res.unread)
        // Opening the list marks everything read.
        api.markAllNotificationsRead()
        _state.value = _state.value.copy(unreadCount = 0)
    }

    /** Refreshes just the unread badge without navigating. */
    fun refreshUnread() {
        viewModelScope.launch {
            try {
                val res = api.notifications()
                _state.value = _state.value.copy(unreadCount = res.unread)
            } catch (_: Throwable) { /* badge is best-effort */ }
        }
    }
}
