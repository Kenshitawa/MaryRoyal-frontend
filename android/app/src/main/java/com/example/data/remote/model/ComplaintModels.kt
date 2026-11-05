package com.example.data.remote.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ComplaintAuthorDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "role") val role: String
)

@JsonClass(generateAdapter = true)
data class ComplaintReplyDto(
    @Json(name = "id") val id: String,
    @Json(name = "message") val message: String,
    @Json(name = "author") val author: ComplaintAuthorDto,
    @Json(name = "createdAt") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class ComplaintDto(
    @Json(name = "id") val id: String,
    @Json(name = "subject") val subject: String,
    @Json(name = "category") val category: String = "OTHER",
    @Json(name = "message") val message: String,
    @Json(name = "status") val status: String = "OPEN",
    @Json(name = "openedBy") val openedBy: ComplaintAuthorDto? = null,
    @Json(name = "assignedTo") val assignedTo: ComplaintAuthorDto? = null,
    @Json(name = "replies") val replies: List<ComplaintReplyDto> = emptyList(),
    @Json(name = "createdAt") val createdAt: String? = null,
    @Json(name = "updatedAt") val updatedAt: String? = null
)

@JsonClass(generateAdapter = true)
data class ComplaintsResponse(
    @Json(name = "complaints") val complaints: List<ComplaintDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateComplaintRequest(
    @Json(name = "subject") val subject: String,
    @Json(name = "category") val category: String,
    @Json(name = "message") val message: String,
    @Json(name = "recipientRole") val recipientRole: String, // "HEAD_TEACHER", "DIRECTOR", "BOTH"
    @Json(name = "learnerId") val learnerId: String
)

@JsonClass(generateAdapter = true)
data class AddComplaintReplyRequest(
    @Json(name = "message") val message: String
)
