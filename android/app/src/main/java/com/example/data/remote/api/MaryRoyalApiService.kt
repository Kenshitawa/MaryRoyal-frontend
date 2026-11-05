package com.example.data.remote.api

import com.example.data.remote.model.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface MaryRoyalApiService {

    // --- Authentication & Profile ---
    @POST("api/login")
    suspend fun login(@Body body: LoginRequest): Response<LoginResponse>

    @POST("api/logout")
    suspend fun logout(): Response<GenericResponse>

    @POST("api/session/refresh")
    suspend fun refreshSession(): Response<GenericResponse>

    @POST("api/change-password")
    suspend fun changePassword(@Body body: ChangePasswordRequest): Response<GenericResponse>

    @GET("api/profile")
    suspend fun getProfile(): Response<ProfileResponse>

    @Multipart
    @POST("api/profile")
    suspend fun uploadAvatar(@Part photo: MultipartBody.Part): Response<Map<String, Any?>>

    // --- Learners ---
    @GET("api/learners")
    suspend fun getLearners(
        @Query("q") query: String? = null,
        @Query("take") take: Int? = 50,
        @Query("cursor") cursor: String? = null
    ): Response<LearnersResponse>

    @GET("api/learners/{id}")
    suspend fun getLearnerDetail(@Path("id") id: String): Response<LearnerDetailResponse>

    @PATCH("api/learners/{id}")
    suspend fun patchLearner(
        @Path("id") id: String,
        @Body body: LearnerPatchRequest
    ): Response<LearnerDetailResponse>

    @POST("api/learners/{id}/login")
    suspend fun createLearnerLogin(
        @Path("id") id: String,
        @Body body: Map<String, String> = emptyMap()
    ): Response<CreateLearnerLoginResponse>

    // --- Admissions ---
    @GET("api/admissions")
    suspend fun getAdmissions(
        @Query("q") q: String? = null,
        @Query("status") status: String? = null,
        @Query("take") take: Int? = 50
    ): Response<AdmissionsResponse>

    @POST("api/admissions")
    suspend fun createAdmissionDraft(
        @Body body: Map<String, String> = emptyMap()
    ): Response<AdmissionDraftResponse>

    @GET("api/admissions/{id}")
    suspend fun getAdmissionDraft(@Path("id") id: String): Response<AdmissionDraftResponse>

    @PATCH("api/admissions")
    suspend fun patchAdmissionDraft(@Body body: PatchAdmissionRequest): Response<AdmissionDraftResponse>

    @POST("api/admissions/{id}/submit")
    suspend fun submitAdmissionDraft(@Path("id") id: String): Response<SubmitAdmissionResponse>

    @Multipart
    @POST("api/admissions/{id}/documents")
    suspend fun uploadAdmissionDocument(
        @Path("id") id: String,
        @Part("category") category: RequestBody,
        @Part file: MultipartBody.Part
    ): Response<AdmissionDocumentDto>

    @POST("api/admissions/{id}/guardian-login")
    suspend fun createGuardianLogin(
        @Path("id") id: String,
        @Body body: Map<String, Int>
    ): Response<CreateAccountResponse>

    // --- Attendance ---
    @GET("api/attendance")
    suspend fun getAttendance(
        @Query("grade") grade: String,
        @Query("date") date: String
    ): Response<AttendanceQueryResponse>

    @POST("api/attendance")
    suspend fun recordAttendance(@Body body: RecordAttendanceRequest): Response<RecordAttendanceResponse>

    @GET("api/attendance/staff")
    suspend fun getStaffAttendance(@Query("date") date: String? = null): Response<StaffAttendanceResponse>

    // --- Assessments & Academics ---
    @GET("api/assessments")
    suspend fun getAssessments(
        @Query("term") term: String? = null,
        @Query("take") take: Int? = 100
    ): Response<AssessmentsResponse>

    @POST("api/assessments")
    suspend fun createAssessment(@Body body: CreateAssessmentRequest): Response<AssessmentResponse>

    @PATCH("api/assessments")
    suspend fun updateAssessment(@Body body: UpdateAssessmentRequest): Response<AssessmentResponse>

    @GET("api/exams")
    suspend fun getExams(): Response<ExamSessionsResponse>

    @GET("api/rubrics")
    suspend fun getRubrics(): Response<RubricsResponse>

    // --- Finance & Fees ---
    @GET("api/finance/invoices")
    suspend fun getInvoices(): Response<InvoicesResponse>

    @POST("api/finance/invoices")
    suspend fun createInvoice(@Body body: CreateInvoiceRequest): Response<Map<String, Any?>>

    @POST("api/finance/payments")
    suspend fun recordPayment(@Body body: RecordPaymentRequest): Response<PaymentResponse>

    @GET("api/finance/structures")
    suspend fun getFeeStructures(): Response<FeeStructuresResponse>

    @GET("api/finance/payroll")
    suspend fun getPayroll(): Response<PayrollResponse>

    @POST("api/finance/payroll")
    suspend fun createPayroll(@Body body: CreatePayrollRequest): Response<Map<String, Any?>>

    // --- Complaints ---
    @GET("api/complaints")
    suspend fun getComplaints(): Response<ComplaintsResponse>

    @POST("api/complaints")
    suspend fun createComplaint(@Body body: CreateComplaintRequest): Response<Map<String, Any?>>

    @POST("api/complaints/{id}/replies")
    suspend fun addComplaintReply(
        @Path("id") id: String,
        @Body body: AddComplaintReplyRequest
    ): Response<Map<String, Any?>>

    // --- Learning Videos ---
    @GET("api/learning-videos")
    suspend fun getLearningVideos(): Response<LearningVideosResponse>

    @POST("api/learning-videos")
    suspend fun addLearningVideo(@Body body: AddVideoRequest): Response<Map<String, Any?>>

    @POST("api/learning-videos/{id}/watch")
    suspend fun markVideoWatched(@Path("id") id: String): Response<GenericResponse>

    // --- Timetable & Schemes ---
    @GET("api/timetable")
    suspend fun getTimetables(): Response<TimetablesResponse>

    @GET("api/schemes")
    suspend fun getSchemes(): Response<SchemesResponse>

    @GET("api/teaching-logs")
    suspend fun getTeachingLogs(): Response<TeachingLogsResponse>

    @POST("api/teaching-logs")
    suspend fun createTeachingLog(@Body body: CreateTeachingLogRequest): Response<Map<String, Any?>>

    // --- Director Accounts Management ---
    @GET("api/accounts")
    suspend fun getAccounts(): Response<AccountsResponse>

    @POST("api/accounts")
    suspend fun createAccount(@Body body: CreateAccountRequest): Response<CreateAccountResponse>

    @PATCH("api/accounts")
    suspend fun patchAccount(@Body body: PatchAccountRequest): Response<CreateAccountResponse>

    // --- Notifications ---
    @GET("api/notifications")
    suspend fun getNotifications(): Response<NotificationsResponse>

    @PATCH("api/notifications")
    suspend fun patchNotification(@Body body: PatchNotificationRequest): Response<GenericResponse>
}
