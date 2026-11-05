package com.example.data.remote.api

import com.example.data.security.SecureTokenManager
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Intercepts outgoing requests to attach active session and activity cookies,
 * and intercepts incoming responses to persist refreshed cookies.
 */
class AuthInterceptor(
    private val tokenManager: SecureTokenManager,
    private val onSessionExpired: () -> Unit
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val requestBuilder = originalRequest.newBuilder()

        val sessionToken = tokenManager.getSessionToken()
        val activityToken = tokenManager.getActivityToken()

        if (!sessionToken.isNullOrBlank()) {
            val cookieValue = buildString {
                append("mary_session=").append(sessionToken)
                if (!activityToken.isNullOrBlank()) {
                    append("; mary_activity=").append(activityToken)
                }
            }
            requestBuilder.header("Cookie", cookieValue)
        }

        // Standard user agent & accept headers
        requestBuilder.header("Accept", "application/json")

        val response = chain.proceed(requestBuilder.build())

        // Extract cookies from Set-Cookie headers
        val setCookieHeaders = response.headers("Set-Cookie")
        var newSessionToken: String? = null
        var newActivityToken: String? = null

        for (header in setCookieHeaders) {
            val parts = header.split(";")
            for (part in parts) {
                val trimmed = part.trim()
                if (trimmed.startsWith("mary_session=")) {
                    val value = trimmed.substring("mary_session=".length)
                    if (value.isNotBlank()) newSessionToken = value
                } else if (trimmed.startsWith("mary_activity=")) {
                    val value = trimmed.substring("mary_activity=".length)
                    if (value.isNotBlank()) newActivityToken = value
                }
            }
        }

        if (newSessionToken != null || newActivityToken != null) {
            tokenManager.saveSession(newSessionToken, newActivityToken)
        }

        // Global check: if server returns 401 for an authenticated request
        val path = originalRequest.url.encodedPath
        if (response.code == 401 && !path.contains("api/login")) {
            tokenManager.clearSession()
            onSessionExpired()
        }

        return response
    }
}
