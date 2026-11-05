package com.example.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_learners")
data class CachedLearnerEntity(
    @PrimaryKey val id: String,
    val admissionNo: String,
    val name: String,
    val grade: String,
    val gender: String?,
    val admissionStatus: String?,
    val hasLearnerLogin: Boolean
)

@Entity(tableName = "cached_assessments")
data class CachedAssessmentEntity(
    @PrimaryKey val id: String,
    val learnerId: String,
    val subject: String,
    val score: Double,
    val term: String,
    val strand: String?,
    val competency: String?,
    val comment: String?,
    val status: String,
    val level: String?,
    val learnerName: String?,
    val learnerAdmissionNo: String?,
    val learnerGrade: String?
)

@Entity(tableName = "cached_timetable")
data class CachedTimetableEntity(
    @PrimaryKey val id: String,
    val term: String?,
    val grade: String?,
    val status: String,
    val slotsJson: String,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cached_attendance")
data class CachedAttendanceRecordEntity(
    @PrimaryKey val id: String, // composite key: "${grade}_${date}_${learnerId}"
    val grade: String,
    val date: String,
    val learnerId: String,
    val learnerName: String,
    val admissionNo: String,
    val status: String, // PRESENT, ABSENT, LATE, EXCUSED
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cached_notifications")
data class CachedNotificationEntity(
    @PrimaryKey val id: String,
    val title: String,
    val body: String,
    val type: String?,
    val read: Boolean,
    val actionUrl: String?,
    val actionDone: Boolean,
    val createdAt: String?
)

@Entity(tableName = "cached_invoices")
data class CachedInvoiceEntity(
    @PrimaryKey val id: String,
    val learnerId: String,
    val term: String,
    val total: Double,
    val paid: Double,
    val balance: Double,
    val learnerName: String?,
    val learnerAdmissionNo: String?,
    val linesCount: Int
)
