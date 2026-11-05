package com.example.data.local.dao

import androidx.room.*
import com.example.data.local.entity.*
import kotlinx.coroutines.flow.Flow

@Dao
interface LearnerDao {
    @Query("SELECT * FROM cached_learners ORDER BY admissionNo ASC")
    fun getAllLearners(): Flow<List<CachedLearnerEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLearners(learners: List<CachedLearnerEntity>)

    @Query("DELETE FROM cached_learners")
    suspend fun clearLearners()
}

@Dao
interface AssessmentDao {
    @Query("SELECT * FROM cached_assessments ORDER BY term DESC, subject ASC")
    fun getAllAssessments(): Flow<List<CachedAssessmentEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAssessments(assessments: List<CachedAssessmentEntity>)

    @Query("DELETE FROM cached_assessments")
    suspend fun clearAssessments()
}

@Dao
interface TimetableDao {
    @Query("SELECT * FROM cached_timetable ORDER BY grade ASC")
    fun getAllTimetablesFlow(): Flow<List<CachedTimetableEntity>>

    @Query("SELECT * FROM cached_timetable ORDER BY grade ASC")
    suspend fun getAllTimetables(): List<CachedTimetableEntity>

    @Query("SELECT * FROM cached_timetable WHERE grade = :grade LIMIT 1")
    suspend fun getTimetableForGrade(grade: String): CachedTimetableEntity?

    @Query("SELECT * FROM cached_timetable LIMIT 1")
    fun getTimetable(): Flow<CachedTimetableEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTimetables(timetables: List<CachedTimetableEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTimetable(timetable: CachedTimetableEntity)

    @Query("DELETE FROM cached_timetable")
    suspend fun clearTimetable()
}

@Dao
interface AttendanceDao {
    @Query("SELECT * FROM cached_attendance WHERE grade = :grade AND date = :date ORDER BY learnerName ASC")
    fun getAttendanceForGradeAndDate(grade: String, date: String): Flow<List<CachedAttendanceRecordEntity>>

    @Query("SELECT * FROM cached_attendance WHERE grade = :grade AND date = :date ORDER BY learnerName ASC")
    suspend fun getAttendanceList(grade: String, date: String): List<CachedAttendanceRecordEntity>

    @Query("SELECT * FROM cached_attendance ORDER BY date DESC, grade ASC")
    fun getAllCachedAttendance(): Flow<List<CachedAttendanceRecordEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttendance(records: List<CachedAttendanceRecordEntity>)

    @Query("UPDATE cached_attendance SET status = :status, updatedAt = :updatedAt WHERE learnerId = :learnerId AND date = :date")
    suspend fun updateStatus(learnerId: String, date: String, status: String, updatedAt: Long = System.currentTimeMillis())

    @Query("DELETE FROM cached_attendance WHERE grade = :grade AND date = :date")
    suspend fun clearAttendanceForGradeAndDate(grade: String, date: String)

    @Query("DELETE FROM cached_attendance")
    suspend fun clearAll()
}

@Dao
interface NotificationDao {
    @Query("SELECT * FROM cached_notifications ORDER BY createdAt DESC")
    fun getAllNotifications(): Flow<List<CachedNotificationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNotifications(notifications: List<CachedNotificationEntity>)

    @Query("UPDATE cached_notifications SET read = 1 WHERE id = :id")
    suspend fun markAsRead(id: String)

    @Query("DELETE FROM cached_notifications")
    suspend fun clearNotifications()
}

@Dao
interface InvoiceDao {
    @Query("SELECT * FROM cached_invoices ORDER BY term DESC")
    fun getAllInvoices(): Flow<List<CachedInvoiceEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertInvoices(invoices: List<CachedInvoiceEntity>)

    @Query("DELETE FROM cached_invoices")
    suspend fun clearInvoices()
}
