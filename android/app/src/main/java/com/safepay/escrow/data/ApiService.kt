package com.safepay.escrow.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): TokenResponse

    @POST("auth/login")
    suspend fun login(@Body body: Credentials): TokenResponse

    @GET("transactions")
    suspend fun listTransactions(): List<Transaction>

    @GET("transactions/{id}")
    suspend fun getTransaction(@Path("id") id: String): Transaction

    @POST("transactions")
    suspend fun createEscrow(@Body body: CreateEscrowRequest): Transaction

    @POST("transactions/{id}/ship")
    suspend fun markShipped(@Path("id") id: String): Transaction

    @POST("transactions/{id}/delivered")
    suspend fun markDelivered(@Path("id") id: String): Transaction

    @POST("transactions/{id}/confirm-received")
    suspend fun confirmReceived(@Path("id") id: String): Transaction

    @POST("disputes")
    suspend fun openDispute(@Body body: OpenDisputeRequest): Dispute

    @POST("ratings")
    suspend fun rate(@Body body: RateRequest): retrofit2.Response<Unit>

    @GET("notifications")
    suspend fun notifications(): NotificationsResponse

    @POST("notifications/read-all")
    suspend fun markAllNotificationsRead(): retrofit2.Response<Unit>
}
