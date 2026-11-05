# Mary Royal School - Android Mobile Portal
**"Nurturing Excellence Through CBC"** — Obunga, Kisumu, Kenya

Official native Android application for Mary Royal Primary & Junior School, built with **Kotlin, Jetpack Compose, Material 3, Clean Architecture, and Android Keystore Security**.

---

## 1. Project Setup & Configuration

### Prerequisites
- Android Studio Ladybug / Meerkat or newer
- JDK 17 or JDK 21 (Target compatibility: Java 11 / Kotlin 2.2)
- Android SDK 36 (Minimum SDK: 24, Android 7.0+)

### Setting the Backend BASE_URL
The backend API URL is managed through Gradle build configurations and `.env` properties:
1. In `app/build.gradle.kts`:
   ```kotlin
   defaultConfig {
       buildConfigField("String", "BASE_URL", "\"https://maryroyal.onrender.com\"")
   }
   ```
2. Or create a `.env` file in the root workspace directory:
   ```env
   BASE_URL=https://maryroyal.onrender.com
   ```
   At compile time, `BuildConfig.BASE_URL` is injected into the Retrofit `ApiClient` with trailing slash validation.

---

## 2. Building APKs & App Bundles (AAB)

### Building Debug APK
Run the following Gradle task from your terminal:
```bash
gradle :app:assembleDebug
```
The output APK will be generated at:
`app/build/outputs/apk/debug/app-debug.apk`

### Building Signed Release APK
Run:
```bash
gradle :app:assembleRelease
```
The output signed APK will be generated at:
`app/build/outputs/apk/release/app-release.apk`

### Building Signed Android App Bundle (AAB for Google Play)
```bash
gradle :app:bundleRelease
```
The release bundle will be generated at:
`app/build/outputs/bundle/release/app-release.aab`

---

## 3. Test Checklist for Each Role

### Director
- [ ] **Account Creation**: Navigate to *Accounts*, provision a new staff account, and verify that the 18-character temporary password is displayed.
- [ ] **Two-Step Verification**: Log in with a Director account; verify that the mandatory 2FA security prompt appears.
- [ ] **Account Governance**: Suspend and unlock a user account after failed login lockout.
- [ ] **Full Financial Ledger**: Verify *Finance* tab shows fee collections, balances, and payroll entries with `FLAG_SECURE` active.

### Head Teacher
- [ ] **Admissions Review**: Access *Admissions Office*, filter by `SUBMITTED`, and review documents (passport photo & birth certificate).
- [ ] **Learner Profile Edit**: Tap any learner, click the Edit icon, update class or stream, and save changes.
- [ ] **Assessment Review**: Inspect CBC grades and verify level badges (EE, ME, AE, BE).
- [ ] **Parent Complaints**: View incoming parent complaints and post a direct administrative reply.

### Deputy Head
- [ ] **Master Timetable**: View published weekly CBC timetables (Monday through Friday) cached in Room for offline access.
- [ ] **Teacher Roll Call**: View staff attendance summaries.
- [ ] **Learners Directory**: Browse enrolled pupils.

### Accountant
- [ ] **Fee Invoices**: View learner term balances, invoiced amounts, and credit applied.
- [ ] **Record Payment**: Enter an M-Pesa receipt with a 10-character transaction code (e.g., `SJA81920XX`), submit, and verify receipt generation.
- [ ] **Payroll & Statutory Details**: Verify display of staff gross pay, deductions, net salary, and statutory numbers (KRA PIN, NSSF, SHA).

### Secretary
- [ ] **CBC Admissions Wizard**: Complete Steps 1 through 7 of a new learner admission (Learner Bio, Residence, Parents, Emergency, Health, Fees, Documents).
- [ ] **Generate Learner Login**: On an approved learner profile, click *Generate Learner Portal Login* and verify creation of `@learners.maryroyal.ac.ke` account.
- [ ] **Profile Updates**: Edit learner biographical and contact details.

### Teacher
- [ ] **Daily Roll Call**: Select grade and date, tap P/A/L status pills for learners, and submit *Save Roll Call*.
- [ ] **CBC Marks Entry**: Tap *Record Mark*, select learner, input numerical score (0–100), and verify automatic calculation of CBC Level (e.g. 85 -> EE, 65 -> ME).
- [ ] **Lesson Logs**: Save a completed CBC teaching log with learning outcome and competencies achieved.

### Parent
- [ ] **Linked Children**: Verify that only children linked to the parent account appear in the dashboard.
- [ ] **Fee Balances**: View current term invoices, payment receipts, and balance due.
- [ ] **Direct Complaint Channel**: Submit an inquiry addressed to the Head Teacher or Director and view threaded responses.

### Learner
- [ ] **CBC Performance Levels**: View report cards with colored CBC performance badges.
- [ ] **Weak-Topic Revision**: For subjects with scores below 60%, verify that curated revision video recommendations appear.
- [ ] **Watch Lesson**: Tap *Watch Lesson*, verify the video intent launches, and verify the *Completed* status badge updates.

---

## 4. Backend Gaps & Insecurities Found with Suggested Fixes

1. **Gap: Server-Side Component vs REST API Divergence**:
   - *Observation*: Several Next.js pages directly query the Prisma database on the server rather than exposing a clean REST endpoint (e.g. `GET /api/learners/[id]`).
   - *Fix*: Expose standard GET endpoints for individual learner details and document downloads in the backend route handlers.
2. **Security: In-Memory Rate Limiting Reset on Cold Starts**:
   - *Observation*: In `src/app/api/login/route.ts`, `loginBuckets` is stored on `globalThis`. When deployed to serverless containers (like Render or Vercel), container spin-ups reset the memory bucket.
   - *Fix*: Implement Redis or database-backed IP rate limiting (`Upstash` or Postgres-backed tokens) to prevent brute-force attacks across distributed instances.
3. **Session Cookie SameSite Settings**:
   - *Observation*: The cookies use `sameSite: "lax"`, which can cause issues with mobile webviews and third-party credential sync.
   - *Fix*: For native app integration, standardize an `Authorization: Bearer <JWT>` header alongside the cookie flow for robust mobile API token verification.
4. **M-Pesa Daraja Callback Webhook**:
   - *Observation*: M-Pesa payments are currently recorded manually by the accountant typing the M-Pesa transaction code.
   - *Fix*: Integrate Safaricom Daraja STK Push (`/api/finance/mpesa/stkpush`) and instant C2B payment validation webhook (`/api/finance/mpesa/callback`) for automated receipt reconciliation.
