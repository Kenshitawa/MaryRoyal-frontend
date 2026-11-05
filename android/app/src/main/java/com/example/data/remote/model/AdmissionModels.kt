package com.example.data.remote.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class AdmissionDocumentDto(
    @Json(name = "id") val id: String,
    @Json(name = "category") val category: String,
    @Json(name = "originalName") val originalName: String? = null,
    @Json(name = "contentType") val contentType: String? = null,
    @Json(name = "sizeBytes") val sizeBytes: Long? = null,
    @Json(name = "createdAt") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class AdmissionDraftDto(
    @Json(name = "id") val id: String,
    @Json(name = "admissionNo") val admissionNo: String,
    @Json(name = "currentStep") val currentStep: Int = 1,
    @Json(name = "status") val status: String,
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "updatedAt") val updatedAt: String? = null,
    @Json(name = "submittedAt") val submittedAt: String? = null,
    @Json(name = "createdBy") val createdBy: CreatedByDto? = null,
    @Json(name = "learner") val learner: LearnerDto? = null,
    @Json(name = "documents") val documents: List<AdmissionDocumentDto> = emptyList(),
    @Json(name = "payload") val payload: Map<String, Any?>? = null
)

@JsonClass(generateAdapter = true)
data class CreatedByDto(
    @Json(name = "name") val name: String
)

@JsonClass(generateAdapter = true)
data class AdmissionsResponse(
    @Json(name = "admissions") val admissions: List<AdmissionDraftDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class AdmissionDraftResponse(
    @Json(name = "draft") val draft: AdmissionDraftDto? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateAdmissionRequest(
    @Json(name = "grade") val grade: String? = null
)

@JsonClass(generateAdapter = true)
data class PatchAdmissionRequest(
    @Json(name = "id") val id: String,
    @Json(name = "step") val step: Int,
    @Json(name = "data") val data: Map<String, Any?>
)

@JsonClass(generateAdapter = true)
data class SubmitAdmissionResponse(
    @Json(name = "ok") val ok: Boolean? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "learnerId") val learnerId: String? = null,
    @Json(name = "error") val error: String? = null
)
