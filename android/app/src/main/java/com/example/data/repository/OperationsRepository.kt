package com.example.data.repository

import com.example.data.local.dao.TimetableDao
import com.example.data.local.entity.CachedTimetableEntity
import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.remote.model.*
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.io.IOException

class OperationsRepository(
    private val api: MaryRoyalApiService,
    private val timetableDao: TimetableDao
) {
    private val moshi = Moshi.Builder().build()
    private val slotsListType = Types.newParameterizedType(List::class.java, TimetableSlotDto::class.java)
    private val slotsAdapter = moshi.adapter<List<TimetableSlotDto>>(slotsListType)

    val cachedTimetable: Flow<TimetableDto?> = timetableDao.getTimetable().map { entity ->
        if (entity != null) {
            val slots = try {
                slotsAdapter.fromJson(entity.slotsJson) ?: emptyList()
            } catch (_: Exception) {
                emptyList()
            }
            TimetableDto(
                id = entity.id,
                term = entity.term,
                grade = entity.grade,
                status = entity.status,
                slots = slots
            )
        } else null
    }

    val allCachedTimetables: Flow<List<TimetableDto>> = timetableDao.getAllTimetablesFlow().map { list ->
        list.map { entity ->
            val slots = try {
                slotsAdapter.fromJson(entity.slotsJson) ?: emptyList()
            } catch (_: Exception) {
                emptyList()
            }
            TimetableDto(
                id = entity.id,
                term = entity.term,
                grade = entity.grade,
                status = entity.status,
                slots = slots
            )
        }
    }

    suspend fun getTimetables(): Result<List<TimetableDto>> {
        return try {
            val response = api.getTimetables()
            if (response.isSuccessful && response.body() != null) {
                val list = response.body()!!.timetables
                if (list.isNotEmpty()) {
                    val entities = list.map { item ->
                        CachedTimetableEntity(
                            id = item.id,
                            term = item.term,
                            grade = item.grade,
                            status = item.status,
                            slotsJson = slotsAdapter.toJson(item.slots)
                        )
                    }
                    timetableDao.clearTimetable()
                    timetableDao.insertTimetables(entities)
                }
                Result.success(list)
            } else {
                val cached = timetableDao.getAllTimetables()
                if (cached.isNotEmpty()) {
                    Result.success(cached.map { entity ->
                        val slots = try { slotsAdapter.fromJson(entity.slotsJson) ?: emptyList() } catch (_: Exception) { emptyList() }
                        TimetableDto(
                            id = entity.id,
                            term = entity.term,
                            grade = entity.grade,
                            status = entity.status,
                            slots = slots
                        )
                    })
                } else {
                    Result.failure(Exception(response.body()?.error ?: "Could not load timetables."))
                }
            }
        } catch (e: Exception) {
            val cached = try { timetableDao.getAllTimetables() } catch (_: Exception) { emptyList() }
            if (cached.isNotEmpty()) {
                Result.success(cached.map { entity ->
                    val slots = try { slotsAdapter.fromJson(entity.slotsJson) ?: emptyList() } catch (_: Exception) { emptyList() }
                    TimetableDto(
                        id = entity.id,
                        term = entity.term,
                        grade = entity.grade,
                        status = entity.status,
                        slots = slots
                    )
                })
            } else {
                Result.failure(e)
            }
        }
    }

    suspend fun getSchemes(): Result<List<SchemeOfWorkDto>> {
        return try {
            val response = api.getSchemes()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.schemes)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load schemes of work."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTeachingLogs(): Result<List<TeachingLogDto>> {
        return try {
            val response = api.getTeachingLogs()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.logs)
            } else {
                Result.failure(Exception(response.body()?.error ?: "Could not load teaching logs."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createTeachingLog(request: CreateTeachingLogRequest): Result<Boolean> {
        return try {
            val response = api.createTeachingLog(request)
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("Failed to save teaching log."))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
