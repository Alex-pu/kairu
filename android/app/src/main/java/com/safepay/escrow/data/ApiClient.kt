package com.safepay.escrow.data

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.safepay.escrow.BuildConfig
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.HttpException
import retrofit2.Retrofit

object ApiClient {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

    fun create(session: Session): ApiService {
        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }

        val client = OkHttpClient.Builder()
            .addInterceptor { chain ->
                val builder = chain.request().newBuilder()
                session.token?.let { builder.header("Authorization", "Bearer $it") }
                chain.proceed(builder.build())
            }
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(ApiService::class.java)
    }

    /** Extracts a human-readable message from an API error, falling back to the throwable. */
    fun errorMessage(t: Throwable): String {
        if (t is HttpException) {
            val body = t.response()?.errorBody()?.string()
            if (!body.isNullOrBlank()) {
                return try {
                    val err = json.decodeFromString(ApiError.serializer(), body)
                    err.error ?: err.message ?: "Request failed (${t.code()})"
                } catch (e: Exception) {
                    "Request failed (${t.code()})"
                }
            }
            return "Request failed (${t.code()})"
        }
        return t.message ?: "Cannot reach the server. Is the backend running?"
    }
}
