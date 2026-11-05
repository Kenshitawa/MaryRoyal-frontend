package com.example.data.repository

import com.example.data.local.dao.AssessmentDao
import com.example.data.local.entity.CachedAssessmentEntity
import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.remote.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.IOException

class AcademicRepository(
    private val api: MaryRoyalApiService,
    private val assessmentDao: AssessmentDao
) {
    val cachedAssessments: Flow<List<AssessmentDto>> = assessmentDao.getAllAssessments().map { entities ->
        entities.map {
            AssessmentDto(
                id = it.id,
                learnerId = it.learnerId,
                subject = it.subject,
                score = it.score,
                term = it.term,
                strand = it.strand,
                competency = it.competency,
                comment = it.comment,
                status = it.status,
                level = it.level,
                learner = if (it.learnerName != null) AssessmentLearnerInfo(
                    id = it.learnerId,
                    name = it.learnerName,
                    admissionNo = it.learnerAdmissionNo ?: "",
                    grade = it.learnerGrade ?: ""
                ) else null
            )
        }
    }

    suspend fun getAssessments(term: String? = null): Result<List<AssessmentDto>> {
        return try {
            val response = api.getAssessments(term = term, take = 100)
            if (response.isSuccessful && response.body() != null) {
                val list = response.body()!!.assessments
                // Cache into Room
                val entities = list.map {
                    CachedAssessmentEntity(
                        id = it.id,
                        learnerId = it.learnerId,
                        subject = it.subject,
                        score = it.score,
                        term = it.term,
                        strand = it.strand,
                        competency = it.competency,
                        comment = it.comment,
                        status = it.status,
                        level = it.level,
                        learnerName = it.learner?.name,
                        learnerAdmissionNo = it.learner?.admissionNo,
                        learnerGrade = it.learner?.grade
                    )
                }
                assessmentDao.clearAssessments()
                assessmentDao.insertAssessments(entities)
                Result.success(list)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load assessments."))
            }
        } catch (e: IOException) {
            Result.failure(Exception("Offline: Displaying cached assessments if available."))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createAssessment(request: CreateAssessmentRequest): Result<AssessmentDto> {
        return try {
            val response = api.createAssessment(request)
            if (response.isSuccessful && response.body()?.assessment != null) {
                Result.success(response.body()!!.assessment!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not record marks."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateAssessment(request: UpdateAssessmentRequest): Result<AssessmentDto> {
        return try {
            val response = api.updateAssessment(request)
            if (response.isSuccessful && response.body()?.assessment != null) {
                Result.success(response.body()!!.assessment!!)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not update marks."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getExams(): Result<List<ExamSessionDto>> {
        return try {
            val response = api.getExams()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.sessions)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load exams."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getRubrics(): Result<List<CbcRubricDto>> {
        return try {
            val response = api.getRubrics()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.rubrics)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load rubrics."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
