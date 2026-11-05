package com.example.data.repository

import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.remote.model.AccountDto
import com.example.data.remote.model.CreateAccountRequest
import com.example.data.remote.model.CreateAccountResponse
import com.example.data.remote.model.PatchAccountRequest

class AccountRepository(
    private val api: MaryRoyalApiService
) {
    suspend fun getAccounts(): Result<List<AccountDto>> {
        return try {
            val response = api.getAccounts()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.accounts)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load user accounts."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createAccount(request: CreateAccountRequest): Result<CreateAccountResponse> {
        return try {
            val response = api.createAccount(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not create user account."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun patchAccount(id: String, action: String): Result<CreateAccountResponse> {
        return try {
            val response = api.patchAccount(PatchAccountRequest(id, action))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Account update failed."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
