package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.example.data.local.dao.*
import com.example.data.local.entity.*

@Database(
    entities = [
        CachedLearnerEntity::class,
        CachedAssessmentEntity::class,
        CachedTimetableEntity::class,
        CachedAttendanceRecordEntity::class,
        CachedNotificationEntity::class,
        CachedInvoiceEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class MaryRoyalDatabase : RoomDatabase() {

    abstract fun learnerDao(): LearnerDao
    abstract fun assessmentDao(): AssessmentDao
    abstract fun timetableDao(): TimetableDao
    abstract fun attendanceDao(): AttendanceDao
    abstract fun notificationDao(): NotificationDao
    abstract fun invoiceDao(): InvoiceDao

    companion object {
        @Volatile
        private var INSTANCE: MaryRoyalDatabase? = null

        fun getDatabase(context: Context): MaryRoyalDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    MaryRoyalDatabase::class.java,
                    "mary_royal_portal.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
