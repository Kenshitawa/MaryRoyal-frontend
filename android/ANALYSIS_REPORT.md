# Mary Royal School - Architecture & Source Repositories Analysis Report
"Nurturing Excellence Through CBC" — Obunga, Kisumu, Kenya

## 1. Overview & Repositories
- **Frontend Repository**: https://github.com/Kenshitawa/MaryRoyal-frontend
- **Backend Repository**: https://github.com/Kenshitawa/MaryRoyal-Baclend
- **Domain & Deployment**: Mary Royal Primary & Junior School, Obunga Informal Settlement (Breweries Area), Kisumu, Kenya.

---

## 2. Technology Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, Jose (JWT), Radix UI.
- **Backend**: Next.js 15 Serverless Routes, Node.js runtime, Prisma ORM (SQLite for local development / PostgreSQL for production deployment), Jose (JWT signatures), Bcrypt.js, Zod schema validation.
- **Android Native Client**: Kotlin, Jetpack Compose (Material 3), Navigation Compose, Retrofit 2 + Moshi + OkHttp, Room Database (Offline Cache), Android Keystore + EncryptedSharedPreferences (AES-256 GCM + SIV), BiometricPrompt (AndroidX Biometric).

---

## 3. Authentication & Security Mechanism
1. **Credentials & Session**:
   - `POST /api/login`: Accepts `{ email, password }`. Checks Bcrypt hash, active status, failed logins counter.
   - Dual-Cookie Tokens:
     - `mary_session`: HS256 JWT containing `{ sub: userId, role, forcePasswordChange }`, valid for 8 hours.
     - `mary_activity`: HS256 JWT idle tracker `{ sub: userId, kind: "idle" }`, valid for 10 minutes.
   - Android Client Storage: Stored exclusively via `EncryptedSharedPreferences` backed by `MasterKey` in Android Keystore.
2. **Rate Limiting & Lockout**:
   - In-memory rate limiting bucket (12 requests/minute per IP) returning `429 Too Many Requests`.
   - User account level: 8 failed attempts locks account (`failedLogins >= 8`). Director can unlock via `PATCH /api/accounts`.
3. **Two-Step Verification**:
   - Mandatory for elevated operational roles: `DIRECTOR`, `HEAD_TEACHER`, `ACCOUNTANT`.
4. **Network & Display Security**:
   - Network Security Config: Prohibits cleartext HTTP traffic (`cleartextTrafficPermitted="false"`).
   - Display Protection: `FLAG_SECURE` enabled on sensitive screens showing financial fee structures, balances, payments, payroll, and statutory identifiers (KRA PIN, NSSF, SHA).

---

## 4. User Roles & Access Control Matrix
| Role | Primary Functions | Navigation & Capabilities |
| :--- | :--- | :--- |
| **DIRECTOR** | School governance, system administration | Creates accounts, approves payroll & marks, full financial & audit visibility |
| **HEAD_TEACHER** | Academic administration, institutional admissions | Approves admissions, reviews & approves CBC assessments, edits learner profiles, resolves parent complaints |
| **DEPUTY** | Operations, discipline, timetables | Creates & publishes timetables, verifies schemes of work, logs teacher attendance |
| **ACCOUNTANT** | Bursar, fee invoicing, payroll entries | Generates invoices, records fee receipts & M-Pesa payments, drafts payroll |
| **SECRETARY** | Front office, pupil registration | Handles CBC admissions workflow (Steps 1–7), uploads documents, generates learner login accounts, edits learner profiles |
| **TEACHER** | Classroom instruction, CBC marks | Daily class attendance roll-call, enters competency assessment scores, accesses schemes & weak-topic videos |
| **PARENT** | Guardian oversight | Views child's profile, monitors fee balances & invoices, direct complaint line to Head Teacher and Director |
| **LEARNER** | Student portal | Views CBC evaluation levels (EE, ME, AE, BE), accesses curated revision videos tailored to weak topics (< 60%) |

---

## 5. Comprehensive API Endpoints Inventory
| Method | Path | Request Body / Params | Response / Action |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/login` | `{ email, password }` | `{ ok, forcePasswordChange }` + sets `mary_session` & `mary_activity` |
| **POST** | `/api/logout` | None | `{ ok: true }` + clears session cookies |
| **POST** | `/api/session/refresh` | None (reads cookies) | `{ ok: true }` (renews 10m idle activity token) |
| **POST** | `/api/change-password` | `{ currentPassword, newPassword }` | `{ ok: true }` |
| **GET** | `/api/profile` | None | `{ profile: { name, email, role, avatarUrl } }` |
| **POST** | `/api/profile` | `multipart/form-data` (`photo`) | `{ avatarUrl }` |
| **GET** | `/api/learners` | `?q=...&take=...&cursor=...` | `{ learners: [ LearnerDto ], nextCursor }` |
| **GET** | `/api/learners/{id}` | Path `{id}` | `{ learner: LearnerDetailDto }` |
| **PATCH** | `/api/learners/{id}` | `{ name, grade, stream, physicalAddress, ... }` | `{ ok: true, learner }` (Head Teacher & Secretary only) |
| **POST** | `/api/learners/{id}/login` | None | `{ account, temporaryPassword }` |
| **GET** | `/api/admissions` | `?q=...&status=...&take=...` | `{ admissions: [ AdmissionDraftDto ] }` |
| **POST** | `/api/admissions` | Empty JSON | `{ draft: { id, admissionNo, currentStep, status } }` |
| **GET** | `/api/admissions/{id}` | Path `{id}` | `{ draft: AdmissionDraftDetail }` |
| **PATCH** | `/api/admissions` | `{ id, step, data }` | Updates step draft payload |
| **POST** | `/api/admissions/{id}/submit` | Path `{id}` | Enrolls applicant into active learner roster |
| **POST** | `/api/admissions/{id}/documents` | `multipart/form-data` (`category`, `file`) | `{ id, category, originalName, sizeBytes }` |
| **POST** | `/api/admissions/{id}/guardian-login` | `{ guardianIndex }` | `{ account, temporaryPassword }` |
| **GET** | `/api/attendance` | `?grade=...&date=YYYY-MM-DD` | `{ learners: [ { id, name, admissionNo, status } ] }` |
| **POST** | `/api/attendance` | `{ grade, date, records: [ { learnerId, status } ] }` | `{ saved: count }` |
| **GET** | `/api/attendance/staff` | `?date=YYYY-MM-DD` | `{ attendance: [ StaffAttendanceDto ] }` |
| **GET** | `/api/assessments` | `?term=...&take=...` | `{ assessments: [ AssessmentDto with CBC level ] }` |
| **POST** | `/api/assessments` | `{ learnerId, subject, score, term, strand, comment }` | `{ assessment: AssessmentDto }` |
| **PATCH** | `/api/assessments` | `{ id, score, strand, competency, comment }` | `{ assessment: UpdatedAssessmentDto }` |
| **GET** | `/api/exams` | None | `{ sessions: [ ExamSessionDto ] }` |
| **GET** | `/api/rubrics` | None | `{ rubrics: [ CbcRubricDto ] }` |
| **GET** | `/api/finance/invoices` | None | `{ invoices: [ InvoiceDto with balances ] }` |
| **POST** | `/api/finance/invoices` | `{ learnerId, term, items }` | `{ invoice: InvoiceDto }` |
| **POST** | `/api/finance/payments` | `{ invoiceId, amount, method, mpesaCode, reference }` | `{ payment: FeePaymentDto, creditAmount }` |
| **GET** | `/api/finance/structures` | None | `{ structures: [ FeeStructureDto ] }` |
| **GET** | `/api/finance/payroll` | None | `{ entries: [ PayrollEntryDto ], staff: [ StaffDto ] }` |
| **POST** | `/api/finance/payroll` | `{ staffId, period, grossAmount, deductions }` | `{ entry: PayrollEntryDto }` |
| **GET** | `/api/complaints` | None | `{ complaints: [ ComplaintDto with replies ] }` |
| **POST** | `/api/complaints` | `{ subject, category, message, recipientRole, learnerId }` | `{ ok: true }` |
| **POST** | `/api/complaints/{id}/replies` | `{ message }` | `{ ok: true }` |
| **GET** | `/api/learning-videos` | None | `{ videos: [ LearningVideoDto ], weakTopics: [ WeakTopicDto ] }` |
| **POST** | `/api/learning-videos` | `{ url, grade, subject, strand, subStrand }` | `{ ok: true }` |
| **POST** | `/api/learning-videos/{id}/watch` | Path `{id}` | `{ ok: true }` |
| **GET** | `/api/timetable` | None | `{ timetables: [ TimetableDto ] }` |
| **GET** | `/api/schemes` | None | `{ schemes: [ SchemeOfWorkDto ] }` |
| **GET** | `/api/teaching-logs` | None | `{ logs: [ TeachingLogDto ] }` |
| **POST** | `/api/teaching-logs` | `{ grade, subject, strand, lessonDate, learningOutcome }` | `{ ok: true }` |
| **GET** | `/api/accounts` | None (Director only) | `{ accounts: [ AccountDto ] }` |
| **POST** | `/api/accounts` | `{ name, email, role, staffNumber, tscNumber }` | `{ account, temporaryPassword }` |
| **PATCH** | `/api/accounts` | `{ id, action: suspend / reactivate / reset-password / unlock }` | `{ account, temporaryPassword }` |
| **GET** | `/api/notifications` | None | `{ notifications: [ NotificationDto ], unreadCount }` |
| **PATCH** | `/api/notifications` | `{ id, action: "read" / "read-all" / "done" }` | `{ ok: true }` |

---

## 6. Frontend Pages Inventory (Mapped 1:1 to Android Native UI)
- `/` (Home & Login) -> `LoginScreen.kt`
- `/change-password` -> `ChangePasswordScreen.kt`
- `/(portal)/dashboard` -> `RoleDashboardScreen.kt`
- `/(portal)/learners` -> `LearnersListScreen.kt`
- `/(portal)/learners/[id]` -> `LearnerDetailScreen.kt`
- `/(portal)/learners/[id]/edit` -> `LearnerEditScreen.kt`
- `/(portal)/admissions` -> `AdmissionsListScreen.kt`
- `/(portal)/admissions/new` -> `NewAdmissionScreen.kt`
- `/(portal)/attendance` -> `AttendanceScreen.kt`
- `/(portal)/assessments` & `/assessments/rubrics` & `/assessments/exams` -> `AcademicsScreen.kt`
- `/(portal)/finance` & `/finance/structures` -> `FinanceScreen.kt`
- `/(portal)/complaints` -> `ComplaintsScreen.kt`
- `/(portal)/learning-videos` & `/learning` -> `LearningVideosScreen.kt`
- `/(portal)/timetable` & `/schemes` & `/teaching-log` -> `OperationsScreen.kt`
- `/(portal)/accounts` -> `AccountsScreen.kt`
- `/(portal)/profile` -> `ProfileScreen.kt`
- Notifications Drawer -> `NotificationsScreen.kt`
