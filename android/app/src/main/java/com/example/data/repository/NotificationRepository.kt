package com.example.data.repository

import com.example.data.local.dao.NotificationDao
import com.example.data.local.entity.CachedNotificationEntity
import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.remote.model.NotificationDto
import com.example.data.remote.model.NotificationsResponse
import com.example.data.remote.model.PatchNotificationRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.IOException

class NotificationRepository(
    private val api: MaryRoyalApiService,
    private val notificationDao: NotificationDao
) {
    val cachedNotifications: Flow<List<NotificationDto>> = notificationDao.getAllNotifications().map { entities ->
        entities.map {
            NotificationDto(
                id = it.id,
                title = it.title,
                body = it.body,
                type = it.type,
                read = it.read,
                actionUrl = it.actionUrl,
                actionDone = it.actionDone,
                createdAt = it.createdAt
            )
        }
    }

    suspend fun getNotifications(): Result<NotificationsResponse> {
        return try {
            val response = api.getNotifications()
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!
                val entities = data.notifications.map {
                    CachedNotificationEntity(
                        id = it.id,
                        title = it.title,
                        body = it.body,
                        type = it.type,
                        read = it.read,
                        actionUrl = it.actionUrl,
                        actionDone = it.actionDone,
                        createdAt = it.createdAt
                    )
                }
                notificationDao.clearNotifications()
                notificationDao.insertNotifications(entities)
                Result.success(data)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load notifications."))
            }
        } catch (e: IOException) {
            Result.failure(Exception("Offline: Showing cached notifications."))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun markAsRead(id: String): Result<Boolean> {
        notificationDao.markAsRead(id)
        return try {
            val response = api.patchNotification(PatchNotificationRequest(id = id, action = "read"))
            Result.success(response.isSuccessful)
        } catch (_: Exception) {
            Result.success(true)
        }
    }

    suspend fun markAllAsRead(): Result<Boolean> {
        return try {
            val response = api.patchNotification(PatchNotificationRequest(action = "read-all"))
            Result.success(response.isSuccessful)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
