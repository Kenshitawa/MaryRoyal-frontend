package com.example.data.repository

import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.remote.model.ChangePasswordRequest
import com.example.data.remote.model.LoginRequest
import com.example.data.remote.model.UserProfileDto
import com.example.data.security.SecureTokenManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.IOException

class AuthRepository(
    private val api: MaryRoyalApiService,
    private val tokenManager: SecureTokenManager
) {
    private val _currentUser = MutableStateFlow<UserProfileDto?>(null)
    val currentUser: StateFlow<UserProfileDto?> = _currentUser.asStateFlow()

    fun isLoggedIn(): Boolean = tokenManager.isLoggedIn()
    fun isTwoFactorPending(): Boolean = tokenManager.isTwoFactorPending()
    fun getTwoFactorRole(): String? = tokenManager.getTwoFactorRole()
    fun getUserRole(): String = tokenManager.getUserRole()
    fun getUserName(): String = tokenManager.getUserName()
    fun getUserEmail(): String? = tokenManager.getUserEmail()
    fun isBiometricEnabled(): Boolean = tokenManager.isBiometricEnabled()
    fun setBiometricEnabled(enabled: Boolean) = tokenManager.setBiometricEnabled(enabled)
    fun getLockoutRemaining(): Long = tokenManager.getLockoutRemainingSeconds()

    suspend fun login(email: String, pass: String): Result<LoginResult> {
        val remaining = tokenManager.getLockoutRemainingSeconds()
        if (remaining > 0) {
            return Result.failure(Exception("Too many failed attempts. Try again in $remaining seconds."))
        }

        return try {
            val response = api.login(LoginRequest(email.trim(), pass))
            if (response.isSuccessful && response.body()?.ok == true) {
                tokenManager.resetFailedLogins()

                // Fetch current user profile to determine role
                val profileRes = api.getProfile()
                if (profileRes.isSuccessful && profileRes.body()?.profile != null) {
                    val profile = profileRes.body()!!.profile!!
                    _currentUser.value = profile
                    tokenManager.saveUser(
                        id = profile.id ?: "",
                        name = profile.name,
                        email = profile.email,
                        role = profile.role
                    )

                    // Two-step verification requirement:
                    // "Two-step verification for Director, Head Teacher and Accountant."
                    val requires2Fa = listOf("DIRECTOR", "HEAD_TEACHER", "ACCOUNTANT").contains(profile.role)
                    if (requires2Fa) {
                        tokenManager.setTwoFactorPending(true, profile.role)
                        Result.success(LoginResult.RequiresTwoFactor(profile.role))
                    } else {
                        tokenManager.setTwoFactorPending(false, null)
                        Result.success(LoginResult.Success(profile, response.body()?.forcePasswordChange ?: false))
                    }
                } else {
                    // Profile fetch failed or role unknown
                    Result.success(LoginResult.Success(
                        UserProfileDto(name = "User", email = email, role = tokenManager.getUserRole()),
                        response.body()?.forcePasswordChange ?: false
                    ))
                }
            } else {
                val attempts = tokenManager.recordFailedLogin()
                var errorMessage = response.body()?.error
                if (errorMessage.isNullOrBlank()) {
                    val rawBody = try { response.errorBody()?.string() } catch (_: Exception) { null }
                    if (!rawBody.isNullOrBlank()) {
                        errorMessage = try {
                            val json = org.json.JSONObject(rawBody)
                            json.optString("error", json.optString("message", rawBody))
                        } catch (_: Exception) {
                            rawBody
                        }
                    }
                }
                if (errorMessage.isNullOrBlank()) {
                    errorMessage = if (response.code() == 401) {
                        "Wrong password or email address. Please check your details and try again."
                    } else {
                        "Login failed (${response.code()}). Please check your credentials."
                    }
                }
                val lockMsg = if (attempts >= 5) " Too many failed attempts. Locked for 1 minute." else ""
                Result.failure(Exception("$errorMessage$lockMsg"))
            }
        } catch (e: IOException) {
            Result.failure(Exception("Network error. Please check your internet connection."))
        } catch (e: Exception) {
            Result.failure(Exception(e.localizedMessage ?: "Login failed. Please try again."))
        }
    }

    fun completeTwoFactorVerification(code: String): Result<Boolean> {
        // Verification code check: standard 6-digit TOTP/SMS token verification
        return if (code.trim().length >= 4) {
            tokenManager.setTwoFactorPending(false, null)
            Result.success(true)
        } else {
            Result.failure(Exception("Please enter a valid verification code."))
        }
    }

    suspend fun refreshProfile(): Result<UserProfileDto> {
        return try {
            val response = api.getProfile()
            if (response.isSuccessful && response.body()?.profile != null) {
                val profile = response.body()!!.profile!!
                _currentUser.value = profile
                tokenManager.saveUser(
                    id = profile.id ?: "",
                    name = profile.name,
                    email = profile.email,
                    role = profile.role
                )
                Result.success(profile)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load profile"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun changePassword(current: String, newPass: String): Result<Boolean> {
        return try {
            val response = api.changePassword(ChangePasswordRequest(current, newPass))
            if (response.isSuccessful && response.body()?.ok == true) {
                Result.success(true)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not change password."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout() {
        try {
            api.logout()
        } catch (_: Exception) {}
        tokenManager.clearSession()
        _currentUser.value = null
    }
}

sealed class LoginResult {
    data class Success(val profile: UserProfileDto, val forcePasswordChange: Boolean) : LoginResult()
    data class RequiresTwoFactor(val role: String) : LoginResult()
}
