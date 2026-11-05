package com.example.data.remote.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class NotificationDto(
    @Json(name = "id") val id: String,
    @Json(name = "title") val title: String,
    @Json(name = "body") val body: String,
    @Json(name = "type") val type: String? = null,
    @Json(name = "read") val read: Boolean = false,
    @Json(name = "actionUrl") val actionUrl: String? = null,
    @Json(name = "actionDone") val actionDone: Boolean = false,
    @Json(name = "createdAt") val createdAt: String? = null
)

@JsonClass(generateAdapter = true)
data class NotificationsResponse(
    @Json(name = "notifications") val notifications: List<NotificationDto> = emptyList(),
    @Json(name = "unreadCount") val unreadCount: Int = 0,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class PatchNotificationRequest(
    @Json(name = "id") val id: String? = null,
    @Json(name = "action") val action: String // "read" | "read-all" | "done"
)
