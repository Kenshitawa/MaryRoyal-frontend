package com.example.data.remote.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class WeakTopicDto(
    @Json(name = "subject") val subject: String,
    @Json(name = "strand") val strand: String? = null
)

@JsonClass(generateAdapter = true)
data class LearningVideoDto(
    @Json(name = "id") val id: String,
    @Json(name = "url") val url: String,
    @Json(name = "title") val title: String? = null,
    @Json(name = "grade") val grade: String,
    @Json(name = "subject") val subject: String,
    @Json(name = "strand") val strand: String,
    @Json(name = "subStrand") val subStrand: String? = null,
    @Json(name = "status") val status: String = "VERIFIED",
    @Json(name = "watched") val watched: Boolean = false,
    @Json(name = "watchedAt") val watchedAt: String? = null,
    @Json(name = "watchCount") val watchCount: Int? = null
)

@JsonClass(generateAdapter = true)
data class LearningVideosResponse(
    @Json(name = "videos") val videos: List<LearningVideoDto> = emptyList(),
    @Json(name = "weakTopics") val weakTopics: List<WeakTopicDto>? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class AddVideoRequest(
    @Json(name = "url") val url: String,
    @Json(name = "grade") val grade: String,
    @Json(name = "subject") val subject: String,
    @Json(name = "strand") val strand: String,
    @Json(name = "subStrand") val subStrand: String? = null
)
