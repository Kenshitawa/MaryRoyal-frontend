package com.example.data.remote.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class AttendanceLearnerDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "admissionNo") val admissionNo: String,
    @Json(name = "status") val status: String = "PRESENT"
)

@JsonClass(generateAdapter = true)
data class AttendanceQueryResponse(
    @Json(name = "learners") val learners: List<AttendanceLearnerDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class AttendanceRecordItem(
    @Json(name = "learnerId") val learnerId: String,
    @Json(name = "status") val status: String
)

@JsonClass(generateAdapter = true)
data class RecordAttendanceRequest(
    @Json(name = "grade") val grade: String,
    @Json(name = "date") val date: String,
    @Json(name = "records") val records: List<AttendanceRecordItem>
)

@JsonClass(generateAdapter = true)
data class RecordAttendanceResponse(
    @Json(name = "saved") val saved: Int? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class StaffAttendanceDto(
    @Json(name = "id") val id: String,
    @Json(name = "staffName") val staffName: String,
    @Json(name = "role") val role: String,
    @Json(name = "status") val status: String,
    @Json(name = "date") val date: String
)

@JsonClass(generateAdapter = true)
data class StaffAttendanceResponse(
    @Json(name = "attendance") val attendance: List<StaffAttendanceDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)
