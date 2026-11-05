package com.example.data.repository

import com.example.data.local.dao.LearnerDao
import com.example.data.local.entity.CachedLearnerEntity
import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.remote.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.IOException

class LearnerRepository(
    private val api: MaryRoyalApiService,
    private val learnerDao: LearnerDao
) {
    val cachedLearners: Flow<List<LearnerDto>> = learnerDao.getAllLearners().map { entities ->
        entities.map {
            LearnerDto(
                id = it.id,
                admissionNo = it.admissionNo,
                name = it.name,
                grade = it.grade,
                gender = it.gender,
                admissionStatus = it.admissionStatus,
                hasLearnerLogin = it.hasLearnerLogin
            )
        }
    }

    suspend fun fetchLearners(query: String? = null): Result<List<LearnerDto>> {
        return try {
            val response = api.getLearners(query = query, take = 100)
            if (response.isSuccessful && response.body() != null) {
                val list = response.body()!!.learners
                // Cache into Room
                if (query.isNullOrBlank()) {
                    val entities = list.map {
                        CachedLearnerEntity(
                            id = it.id,
                            admissionNo = it.admissionNo,
                            name = it.name,
                            grade = it.grade,
                            gender = it.gender,
                            admissionStatus = it.admissionStatus,
                            hasLearnerLogin = it.hasLearnerLogin
                        )
                    }
                    learnerDao.clearLearners()
                    learnerDao.insertLearners(entities)
                }
                Result.success(list)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load learners."))
            }
        } catch (e: IOException) {
            // Offline fallback
            Result.failure(Exception("Offline: Displaying cached learners if available."))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getLearnerDetail(id: String): Result<LearnerDetailDto> {
        return try {
            val response = api.getLearnerDetail(id)
            if (response.isSuccessful && response.body()?.learner != null) {
                Result.success(response.body()!!.learner!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Learner not found."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun patchLearner(id: String, patch: LearnerPatchRequest): Result<LearnerDetailDto> {
        return try {
            val response = api.patchLearner(id, patch)
            if (response.isSuccessful && response.body()?.learner != null) {
                Result.success(response.body()!!.learner!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Failed to update learner."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createLearnerLogin(id: String): Result<String> {
        return try {
            val response = api.createLearnerLogin(id)
            if (response.isSuccessful && response.body()?.temporaryPassword != null) {
                Result.success(response.body()!!.temporaryPassword!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not create learner account."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
