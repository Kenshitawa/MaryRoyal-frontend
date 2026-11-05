package com.example.data.repository

import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.remote.model.AddVideoRequest
import com.example.data.remote.model.LearningVideosResponse

class LearningVideoRepository(
    private val api: MaryRoyalApiService
) {
    suspend fun getLearningVideos(): Result<LearningVideosResponse> {
        return try {
            val response = api.getLearningVideos()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load learning videos."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun addVideo(
        url: String,
        grade: String,
        subject: String,
        strand: String,
        subStrand: String? = null
    ): Result<Boolean> {
        return try {
            val response = api.addLearningVideo(
                AddVideoRequest(
                    url = url,
                    grade = grade,
                    subject = subject,
                    strand = strand,
                    subStrand = subStrand
                )
            )
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("Failed to add learning video."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun markVideoWatched(id: String): Result<Boolean> {
        return try {
            val response = api.markVideoWatched(id)
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("Could not mark video as watched."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
