package com.safepay.escrow.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Credentials(val email: String, val password: String)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val fullName: String,
    val phone: String,
)

@Serializable
data class TokenResponse(val token: String)

@Serializable
data class CreateEscrowRequest(
    val sellerEmail: String,
    val description: String,
    val amountCents: Int,
    val method: String,
    val currency: String = "KES",
)

@Serializable
data class Transaction(
    val id: String,
    val buyerId: String,
    val sellerId: String,
    val description: String,
    val amountCents: Int,
    val currency: String = "KES",
    val method: String,
    val status: String,
    val gatewayRef: String? = null,
    val createdAt: String,
    val events: List<TransactionEvent> = emptyList(),
    val dispute: Dispute? = null,
    val sellerReputation: Reputation? = null,
    val seller: PartySummary? = null,
)

@Serializable
data class PartySummary(
    val id: String,
    val email: String,
    val fullName: String? = null,
)

@Serializable
data class Reputation(
    val average: Double? = null,
    val count: Int = 0,
)

@Serializable
data class TransactionEvent(
    val id: String,
    val fromStatus: String? = null,
    val toStatus: String,
    val note: String? = null,
    val createdAt: String,
)

@Serializable
data class Dispute(
    val id: String,
    val transactionId: String,
    val reason: String,
    val status: String,
    val adminNote: String? = null,
    val evidence: List<Evidence> = emptyList(),
)

@Serializable
data class Evidence(val id: String, val fileUrl: String)

@Serializable
data class OpenDisputeRequest(
    val transactionId: String,
    val reason: String,
    val evidenceUrls: List<String> = emptyList(),
)

@Serializable
data class RateRequest(
    val transactionId: String,
    val score: Int,
    val comment: String? = null,
)

@Serializable
data class Notification(
    val id: String,
    val transactionId: String? = null,
    val message: String,
    val read: Boolean = false,
    val createdAt: String,
)

@Serializable
data class NotificationsResponse(
    val unread: Int = 0,
    val items: List<Notification> = emptyList(),
)

@Serializable
data class ApiError(val error: String? = null, val message: String? = null)

/** Payment methods the API accepts, with display labels. */
enum class PaymentMethod(val api: String, val label: String) {
    MPESA("MPESA", "M-Pesa"),
    PAYPAL("PAYPAL", "PayPal"),
    VISA("VISA", "Visa Card");
}
