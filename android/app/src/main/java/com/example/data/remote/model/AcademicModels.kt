package com.example.data.remote.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class AssessmentLearnerInfo(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "admissionNo") val admissionNo: String,
    @Json(name = "grade") val grade: String
)

@JsonClass(generateAdapter = true)
data class AssessmentDto(
    @Json(name = "id") val id: String,
    @Json(name = "learnerId") val learnerId: String,
    @Json(name = "subject") val subject: String,
    @Json(name = "score") val score: Double,
    @Json(name = "term") val term: String,
    @Json(name = "strand") val strand: String? = null,
    @Json(name = "competency") val competency: String? = null,
    @Json(name = "comment") val comment: String? = null,
    @Json(name = "status") val status: String,
    @Json(name = "version") val version: Int = 1,
    @Json(name = "level") val level: String? = null,
    @Json(name = "learner") val learner: AssessmentLearnerInfo? = null
)

@JsonClass(generateAdapter = true)
data class AssessmentsResponse(
    @Json(name = "assessments") val assessments: List<AssessmentDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class CreateAssessmentRequest(
    @Json(name = "learnerId") val learnerId: String,
    @Json(name = "subject") val subject: String,
    @Json(name = "score") val score: Double,
    @Json(name = "term") val term: String,
    @Json(name = "strand") val strand: String? = null,
    @Json(name = "competency") val competency: String? = null,
    @Json(name = "comment") val comment: String? = null
)

@JsonClass(generateAdapter = true)
data class UpdateAssessmentRequest(
    @Json(name = "id") val id: String,
    @Json(name = "score") val score: Double,
    @Json(name = "strand") val strand: String? = null,
    @Json(name = "competency") val competency: String? = null,
    @Json(name = "comment") val comment: String? = null
)

@JsonClass(generateAdapter = true)
data class AssessmentResponse(
    @Json(name = "assessment") val assessment: AssessmentDto? = null,
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class ExamSessionDto(
    @Json(name = "id") val id: String,
    @Json(name = "title") val title: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "term") val term: String,
    @Json(name = "grade") val grade: String? = null,
    @Json(name = "status") val status: String = "ACTIVE"
)

@JsonClass(generateAdapter = true)
data class ExamSessionsResponse(
    @Json(name = "sessions") val sessions: List<ExamSessionDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)

@JsonClass(generateAdapter = true)
data class CbcRubricDto(
    @Json(name = "id") val id: String,
    @Json(name = "grade") val grade: String,
    @Json(name = "subject") val subject: String,
    @Json(name = "strand") val strand: String,
    @Json(name = "subStrand") val subStrand: String? = null,
    @Json(name = "eeCriteria") val eeCriteria: String? = null,
    @Json(name = "meCriteria") val meCriteria: String? = null,
    @Json(name = "aeCriteria") val aeCriteria: String? = null,
    @Json(name = "beCriteria") val beCriteria: String? = null
)

@JsonClass(generateAdapter = true)
data class RubricsResponse(
    @Json(name = "rubrics") val rubrics: List<CbcRubricDto> = emptyList(),
    @Json(name = "error") val error: String? = null
)
