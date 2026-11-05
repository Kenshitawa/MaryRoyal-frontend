package com.example

import android.app.Application
import com.example.data.local.MaryRoyalDatabase
import com.example.data.remote.api.ApiClient
import com.example.data.remote.api.MaryRoyalApiService
import com.example.data.repository.*
import com.example.data.security.SecureTokenManager
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

class MaryRoyalApp : Application() {

    lateinit var tokenManager: SecureTokenManager
        private set

    lateinit var database: MaryRoyalDatabase
        private set

    lateinit var apiService: MaryRoyalApiService
        private set

    // Repositories
    lateinit var authRepository: AuthRepository
        private set
    lateinit var learnerRepository: LearnerRepository
        private set
    lateinit var admissionRepository: AdmissionRepository
        private set
    lateinit var attendanceRepository: AttendanceRepository
        private set
    lateinit var academicRepository: AcademicRepository
        private set
    lateinit var financeRepository: FinanceRepository
        private set
    lateinit var complaintRepository: ComplaintRepository
        private set
    lateinit var learningVideoRepository: LearningVideoRepository
        private set
    lateinit var operationsRepository: OperationsRepository
        private set
    lateinit var accountRepository: AccountRepository
        private set
    lateinit var notificationRepository: NotificationRepository
        private set

    private val _sessionExpiredEvent = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val sessionExpiredEvent: SharedFlow<Unit> = _sessionExpiredEvent.asSharedFlow()

    override fun onCreate() {
        super.onCreate()
        instance = this

        tokenManager = SecureTokenManager(this)
        database = MaryRoyalDatabase.getDatabase(this)

        apiService = ApiClient.create(
            tokenManager = tokenManager,
            onSessionExpired = {
                _sessionExpiredEvent.tryEmit(Unit)
            }
        )

        authRepository = AuthRepository(apiService, tokenManager)
        learnerRepository = LearnerRepository(apiService, database.learnerDao())
        admissionRepository = AdmissionRepository(apiService)
        attendanceRepository = AttendanceRepository(apiService, database.attendanceDao())
        academicRepository = AcademicRepository(apiService, database.assessmentDao())
        financeRepository = FinanceRepository(apiService, database.invoiceDao())
        complaintRepository = ComplaintRepository(apiService)
        learningVideoRepository = LearningVideoRepository(apiService)
        operationsRepository = OperationsRepository(apiService, database.timetableDao())
        accountRepository = AccountRepository(apiService)
        notificationRepository = NotificationRepository(apiService, database.notificationDao())
    }

    companion object {
        lateinit var instance: MaryRoyalApp
            private set
    }
}
