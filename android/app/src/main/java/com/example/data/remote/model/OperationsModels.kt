package com.example.data.remote.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class TimetableUserDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String
)

@JsonClass(generateAdapter = true)
data class TimetableSlotDto(
    @Json(name = "day") val day: String,
    @Json(name = "time") val time: String,
    @Json(name = "grade") val grade: String,
    @Json(name = "subject") val subject: String,
    @Json(name = "teacher") val teacher: String? = null,
    @Json(name = "room") val room: String? = null
)

@JsonClass(generateAdapter = true)
data class TimetableDto(
    @Json(name = "id") val id: String,
    @Json(name = "term") val term: String? = "Term 1",
    @Json(name = "status") val status: String = "PUBLISHED",
    @Json(name = "grade") val grade: String? = null,
    @Json(name = "slots") val slots: List<TimetableSlotDto> = emptyList(),
    @Json(name = "createdBy") val createdBy: TimetableUserDto? = null,
    @Json(name = "createdAt") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class TimetablesResponse(
    @Json(name = "timetables") val timetables: List<TimetableDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class SchemeOfWorkDto(
    @Json(name = "id") val id: String,
    @Json(name = "grade") val grade: String,
    @Json(name = "subject") val subject: String,
    @Json(name = "term") val term: String,
    @Json(name = "week") val week: Int = 1,
    @Json(name = "strand") val strand: String,
    @Json(name = "subStrand") val subStrand: String? = null,
    @Json(name = "status") val status: String = "VERIFIED"
)

@JsonClass(generateAdapter = true)
data class SchemesResponse(
    @Json(name = "schemes") val schemes: List<SchemeOfWorkDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class TeachingLogDto(
    @Json(name = "id") val id: String,
    @Json(name = "grade") val grade: String,
    @Json(name = "subject") val subject: String,
    @Json(name = "strand") val strand: String,
    @Json(name = "lessonDate") val lessonDate: String,
    @Json(name = "learningOutcome") val learningOutcome: String? = null,
    @Json(name = "reflection") val reflection: String? = null,
    @Json(name = "status") val status: String = "DRAFT"
)

@JsonClass(generateAdapter = true)
data class TeachingLogsResponse(
    @Json(name = "logs") val logs: List<TeachingLogDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateTeachingLogRequest(
    @Json(name = "grade") val grade: String,
    @Json(name = "subject") val subject: String,
    @Json(name = "strand") val strand: String,
    @Json(name = "lessonDate") val lessonDate: String,
    @Json(name = "learningOutcome") val learningOutcome: String,
    @Json(name = "reflection") val reflection: String? = null
)
