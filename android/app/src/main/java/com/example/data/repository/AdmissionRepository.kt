package com.example.data.repository

import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.remote.model.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

class AdmissionRepository(
    private val api: MaryRoyalApiService
) {
    suspend fun getAdmissions(query: String? = null, status: String? = null): Result<List<AdmissionDraftDto>> {
        return try {
            val response = api.getAdmissions(q = query, status = status)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.admissions)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load admissions."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createAdmission(): Result<AdmissionDraftDto> {
        return try {
            val response = api.createAdmissionDraft()
            if (response.isSuccessful && response.body()?.draft != null) {
                Result.success(response.body()!!.draft!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not start new admission."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getAdmission(id: String): Result<AdmissionDraftDto> {
        return try {
            val response = api.getAdmissionDraft(id)
            if (response.isSuccessful && response.body()?.draft != null) {
                Result.success(response.body()!!.draft!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Admission not found."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun patchAdmission(id: String, step: Int, data: Map<String, Any?>): Result<AdmissionDraftDto> {
        return try {
            val response = api.patchAdmissionDraft(PatchAdmissionRequest(id, step, data))
            if (response.isSuccessful && response.body()?.draft != null) {
                Result.success(response.body()!!.draft!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not save step data."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun submitAdmission(id: String): Result<SubmitAdmissionResponse> {
        return try {
            val response = api.submitAdmissionDraft(id)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not submit admission."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadDocument(id: String, category: String, file: File, mimeType: String): Result<AdmissionDocumentDto> {
        return try {
            val categoryPart = category.toRequestBody("text/plain".toMediaTypeOrNull())
            val filePart = MultipartBody.Part.createFormData(
                "file",
                file.name,
                file.asRequestBody(mimeType.toMediaTypeOrNull())
            )
            val response = api.uploadAdmissionDocument(id, categoryPart, filePart)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to upload document."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createGuardianLogin(id: String, guardianIndex: Int): Result<String> {
        return try {
            val response = api.createGuardianLogin(id, mapOf("guardianIndex" to guardianIndex))
            if (response.isSuccessful && response.body()?.temporaryPassword != null) {
                Result.success(response.body()!!.temporaryPassword!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not create guardian login."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
