package com.example.data.repository

import com.example.data.local.dao.AttendanceDao
import com.example.data.local.entity.CachedAttendanceRecordEntity
import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.remote.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.IOException

class AttendanceRepository(
    private val api: MaryRoyalApiService,
    private val attendanceDao: AttendanceDao
) {
    fun getCachedAttendanceFlow(grade: String, date: String): Flow<List<AttendanceLearnerDto>> {
        return attendanceDao.getAttendanceForGradeAndDate(grade, date).map { entities ->
            entities.map {
                AttendanceLearnerDto(
                    id = it.learnerId,
                    name = it.learnerName,
                    admissionNo = it.admissionNo,
                    status = it.status
                )
            }
        }
    }

    suspend fun getAttendance(grade: String, date: String): Result<List<AttendanceLearnerDto>> {
        return try {
            val response = api.getAttendance(grade, date)
            if (response.isSuccessful && response.body() != null) {
                val list = response.body()!!.learners
                if (list.isNotEmpty()) {
                    val entities = list.map {
                        CachedAttendanceRecordEntity(
                            id = "${grade}_${date}_${it.id}",
                            grade = grade,
                            date = date,
                            learnerId = it.id,
                            learnerName = it.name,
                            admissionNo = it.admissionNo,
                            status = it.status
                        )
                    }
                    attendanceDao.clearAttendanceForGradeAndDate(grade, date)
                    attendanceDao.insertAttendance(entities)
                }
                Result.success(list)
            } else {
                val cached = attendanceDao.getAttendanceList(grade, date)
                if (cached.isNotEmpty()) {
                    Result.success(cached.map {
                        AttendanceLearnerDto(
                            id = it.learnerId,
                            name = it.learnerName,
                            admissionNo = it.admissionNo,
                            status = it.status
                        )
                    })
                } else {
                    Result.failure(Exception(response.body()?.error ?: "Could not load attendance."))
                }
            }
        } catch (e: Exception) {
            // Check Room offline cache on network / connection failure
            val cached = try { attendanceDao.getAttendanceList(grade, date) } catch (_: Exception) { emptyList() }
            if (cached.isNotEmpty()) {
                Result.success(cached.map {
                    AttendanceLearnerDto(
                        id = it.learnerId,
                        name = it.learnerName,
                        admissionNo = it.admissionNo,
                        status = it.status
                    )
                })
            } else {
                Result.failure(e)
            }
        }
    }

    suspend fun recordAttendance(grade: String, date: String, records: List<AttendanceRecordItem>): Result<Int> {
        // Optimistically update local Room database cache
        try {
            records.forEach { record ->
                attendanceDao.updateStatus(record.learnerId, date, record.status)
            }
        } catch (_: Exception) {}

        return try {
            val response = api.recordAttendance(RecordAttendanceRequest(grade, date, records))
            if (response.isSuccessful && response.body()?.saved != null) {
                Result.success(response.body()!!.saved!!)
            } else {
                // If backend returned error, local cache is still preserved
                Result.success(records.size)
            }
        } catch (e: IOException) {
            // Offline - saved to Room cache
            Result.success(records.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getStaffAttendance(date: String? = null): Result<List<StaffAttendanceDto>> {
        return try {
            val response = api.getStaffAttendance(date)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.attendance)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load staff attendance."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

