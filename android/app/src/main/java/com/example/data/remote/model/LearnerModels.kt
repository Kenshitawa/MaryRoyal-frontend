package com.example.data.remote.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class LearnerDto(
    @Json(name = "id") val id: String,
    @Json(name = "admissionNo") val admissionNo: String,
    @Json(name = "name") val name: String,
    @Json(name = "grade") val grade: String,
    @Json(name = "gender") val gender: String? = null,
    @Json(name = "admissionStatus") val admissionStatus: String? = "APPROVED",
    @Json(name = "hasLearnerLogin") val hasLearnerLogin: Boolean = false
)

@JsonClass(generateAdapter = true)
data class LearnersResponse(
    @Json(name = "learners") val learners: List<LearnerDto> = emptyList(),
    @Json(name = "nextCursor") val nextCursor: String? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class LearnerProfileData(
    @Json(name = "stream") val stream: String? = null,
    @Json(name = "upiNumber") val upiNumber: String? = null,
    @Json(name = "dateOfBirth") val dateOfBirth: String? = null,
    @Json(name = "nationality") val nationality: String? = "Kenyan",
    @Json(name = "religion") val religion: String? = null,
    @Json(name = "languagesSpoken") val languagesSpoken: String? = null,
    @Json(name = "county") val county: String? = "Kisumu",
    @Json(name = "subCounty") val subCounty: String? = "Kisumu Central",
    @Json(name = "ward") val ward: String? = "Railways / Obunga",
    @Json(name = "village") val village: String? = null,
    @Json(name = "physicalAddress") val physicalAddress: String? = null,
    @Json(name = "knownConditions") val knownConditions: String? = null,
    @Json(name = "allergies") val allergies: String? = null,
    @Json(name = "currentMedication") val currentMedication: String? = null,
    @Json(name = "specialNeeds") val specialNeeds: String? = null,
    @Json(name = "bloodGroup") val bloodGroup: String? = null,
    @Json(name = "doctorOrHospital") val doctorOrHospital: String? = null,
    @Json(name = "healthInsurance") val healthInsurance: String? = null
)

@JsonClass(generateAdapter = true)
data class LearnerDetailDto(
    @Json(name = "id") val id: String,
    @Json(name = "admissionNo") val admissionNo: String,
    @Json(name = "name") val name: String,
    @Json(name = "grade") val grade: String,
    @Json(name = "gender") val gender: String? = null,
    @Json(name = "admissionStatus") val admissionStatus: String = "APPROVED",
    @Json(name = "profile") val profile: LearnerProfileData? = null
)

@JsonClass(generateAdapter = true)
data class LearnerDetailResponse(
    @Json(name = "learner") val learner: LearnerDetailDto? = null,
    @Json(name = "ok") val ok: Boolean? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class LearnerPatchRequest(
    @Json(name = "name") val name: String? = null,
    @Json(name = "grade") val grade: String? = null,
    @Json(name = "gender") val gender: String? = null,
    @Json(name = "admissionStatus") val admissionStatus: String? = null,
    @Json(name = "stream") val stream: String? = null,
    @Json(name = "upiNumber") val upiNumber: String? = null,
    @Json(name = "dateOfBirth") val dateOfBirth: String? = null,
    @Json(name = "nationality") val nationality: String? = null,
    @Json(name = "religion") val religion: String? = null,
    @Json(name = "languagesSpoken") val languagesSpoken: String? = null,
    @Json(name = "county") val county: String? = null,
    @Json(name = "subCounty") val subCounty: String? = null,
    @Json(name = "ward") val ward: String? = null,
    @Json(name = "village") val village: String? = null,
    @Json(name = "physicalAddress") val physicalAddress: String? = null,
    @Json(name = "knownConditions") val knownConditions: String? = null,
    @Json(name = "allergies") val allergies: String? = null,
    @Json(name = "currentMedication") val currentMedication: String? = null,
    @Json(name = "specialNeeds") val specialNeeds: String? = null,
    @Json(name = "bloodGroup") val bloodGroup: String? = null,
    @Json(name = "doctorOrHospital") val doctorOrHospital: String? = null,
    @Json(name = "healthInsurance") val healthInsurance: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateLearnerLoginResponse(
    @Json(name = "account") val account: AccountDto? = null,
    @Json(name = "temporaryPassword") val temporaryPassword: String? = null,
    @Json(name = "error") val error: String? = null
)
