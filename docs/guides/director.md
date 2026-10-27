# Director guide

## Sign in
Use `director@maryroyal.ac.ke` with the temporary local password in README. On first sign-in, choose a new password of at least 12 characters.

## Create an account
Open **Accounts** in the desktop sidebar. Enter the person's name, email and role, then select **Create**. Copy the temporary password shown once and share it privately. The new account must change it at first sign-in. Account list shows whether each account is active and whether it still needs a password change.

Use **Suspend** to block sign-in, **Reactivate** to restore access, **Reset password** to issue a new one-time credential, or **Unlock** after repeated failed logins. Each action is audit recorded. Account profile edits, deletion/archive and bulk imports are not implemented.

## Add a learner
Open **Learners**, choose **Admit learner**, enter the learner name, grade and gender, and save. The system assigns the next sequential admission number in the `MR-01`, `MR-02`, `MR-03` format and shows it in the confirmation. Search by learner name, admission number or grade. Learners are archived rather than deleted once records are attached.

This prototype does not yet capture guardians, UPI/NEMIS, DOB, prior school, medical data or full admission details. Use demo records only.

## Link a family account
In **Accounts**, use **Parent and learner links** to associate a Parent or Learner account with a learner. Remove a link to immediately remove that account’s access to the learner portal records. Link changes are written to the audit log.

## Reports and audit
Open **Reports** to see current register/result/invoice totals or download the learner-register CSV. Exports are audited. **Audit log** lets the Director filter recent events by action. The report currently contains learner identity fields only; detailed academic and finance reports remain on the roadmap.

## Schoolwide oversight
The Director dashboard summarizes enrollment, daily attendance, released results, fees collected, outstanding fee balances by class, and this month’s staff payroll with paid and pending totals. Teachers own mark entry, the Head Teacher approves submitted marks, and the Director releases approved results. The Director has no create/edit permission for marks. The Head Teacher prepares payroll and the Director authorizes payment; dashboard totals are available for oversight. Seeded payroll amounts are sample data for local testing.

## Account security and activity
Select your avatar in the header to open **Profile & security**. Update your profile photo or change your password; a current password is required. The eye icon beside the theme control opens the Director-only audit view. Filter for `LOGIN` to see successful and failed sign-ins, or search for an action such as `PAYMENT` or `ASSESSMENT` to review recorded changes. The audit stores event type and affected record, never passwords or other secret values. All sessions automatically expire after 10 minutes of inactivity.
