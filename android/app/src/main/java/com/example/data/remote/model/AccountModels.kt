package com.example.data.remote.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class AccountDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "email") val email: String,
    @Json(name = "role") val role: String,
    @Json(name = "suspended") val suspended: Boolean = false,
    @Json(name = "forcePasswordChange") val forcePasswordChange: Boolean = false,
    @Json(name = "failedLogins") val failedLogins: Int = 0,
    @Json(name = "createdAt") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class AccountsResponse(
    @Json(name = "accounts") val accounts: List<AccountDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateAccountRequest(
    @Json(name = "name") val name: String,
    @Json(name = "email") val email: String,
    @Json(name = "role") val role: String,
    @Json(name = "staffNumber") val staffNumber: String = "",
    @Json(name = "tscNumber") val tscNumber: String = "",
    @Json(name = "qualifications") val qualifications: String = "",
    @Json(name = "employmentTitle") val employmentTitle: String = ""
)

@JsonClass(generateAdapter = true)
data class CreateAccountResponse(
    @Json(name = "account") val account: AccountDto? = null,
    @Json(name = "temporaryPassword") val temporaryPassword: String? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class PatchAccountRequest(
    @Json(name = "id") val id: String,
    @Json(name = "action") val action: String // "suspend" | "reactivate" | "reset-password" | "unlock"
)
