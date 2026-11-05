package com.example.data.remote.api

import com.example.data.security.SecureTokenManager
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

class SessionAuthenticator(
    private val tokenManager: SecureTokenManager,
    private val onAutoLogout: () -> Unit
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        // If we already tried or if there's no session, do not retry
        if (responseCount(response) >= 2) {
            tokenManager.clearSession()
            onAutoLogout()
            return null
        }

        val path = response.request.url.encodedPath
        if (path.contains("api/login") || path.contains("api/session/refresh")) {
            return null
        }

        // Return null to allow AuthInterceptor to trigger session expiration
        return null
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
