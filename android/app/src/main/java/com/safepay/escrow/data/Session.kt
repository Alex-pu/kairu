package com.safepay.escrow.data

import android.content.Context
import android.util.Base64
import org.json.JSONObject

/** Persists the JWT and exposes decoded claims (userId, role, expiry). */
class Session(context: Context) {
    private val prefs = context.getSharedPreferences("safepay", Context.MODE_PRIVATE)

    var token: String?
        get() = prefs.getString("token", null)?.takeIf { it.isNotBlank() }
        set(value) = prefs.edit().apply {
            if (value == null) remove("token") else putString("token", value)
        }.apply()

    private val claims: JSONObject?
        get() {
            val t = token ?: return null
            return try {
                val parts = t.split(".")
                if (parts.size < 2) return null
                val json = String(Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP))
                val obj = JSONObject(json)
                val exp = obj.optLong("exp", 0L)
                if (exp > 0 && exp * 1000 < System.currentTimeMillis()) { token = null; return null }
                obj
            } catch (e: Exception) {
                null
            }
        }

    val isLoggedIn: Boolean get() = claims != null
    val userId: String? get() = claims?.optString("sub")
    val isAdmin: Boolean get() = claims?.optString("role") == "ADMIN"

    fun logout() { token = null }
}
