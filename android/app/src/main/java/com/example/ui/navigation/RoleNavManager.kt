package com.example.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

enum class UserRole(val code: String, val displayName: String) {
    DIRECTOR("DIRECTOR", "Director"),
    HEAD_TEACHER("HEAD_TEACHER", "Head Teacher"),
    DEPUTY("DEPUTY", "Deputy Head"),
    ACCOUNTANT("ACCOUNTANT", "Accountant"),
    SECRETARY("SECRETARY", "Secretary"),
    TEACHER("TEACHER", "Teacher"),
    PARENT("PARENT", "Parent / Guardian"),
    LEARNER("LEARNER", "Learner");

    companion object {
        fun fromCode(code: String): UserRole {
            return entries.firstOrNull { it.code.equals(code, ignoreCase = true) } ?: LEARNER
        }
    }
}

data class NavTab(
    val id: String,
    val title: String,
    val icon: ImageVector,
    val testTag: String
)

object RoleNavManager {

    fun getTabsForRole(role: UserRole): List<NavTab> {
        val primaryTabs = when (role) {
            UserRole.DIRECTOR -> listOf(
                NavTab("dashboard", "Overview", Icons.Default.Dashboard, "tab_director_dashboard"),
                NavTab("accounts", "Accounts", Icons.Default.ManageAccounts, "tab_director_accounts"),
                NavTab("finance", "Finance", Icons.Default.AccountBalance, "tab_director_finance"),
                NavTab("learners", "Learners", Icons.Default.School, "tab_director_learners")
            )
            UserRole.HEAD_TEACHER -> listOf(
                NavTab("dashboard", "Overview", Icons.Default.Dashboard, "tab_head_dashboard"),
                NavTab("learners", "Learners", Icons.Default.School, "tab_head_learners"),
                NavTab("academics", "Academics", Icons.Default.MenuBook, "tab_head_academics"),
                NavTab("finance", "Finance", Icons.Default.AccountBalance, "tab_head_finance")
            )
            UserRole.DEPUTY -> listOf(
                NavTab("dashboard", "Overview", Icons.Default.Dashboard, "tab_deputy_dashboard"),
                NavTab("operations", "Timetable", Icons.Default.Schedule, "tab_deputy_operations"),
                NavTab("attendance", "Attendance", Icons.Default.FactCheck, "tab_deputy_attendance"),
                NavTab("learners", "Learners", Icons.Default.School, "tab_deputy_learners")
            )
            UserRole.ACCOUNTANT -> listOf(
                NavTab("dashboard", "Overview", Icons.Default.Dashboard, "tab_accountant_dashboard"),
                NavTab("finance", "Fees", Icons.Default.ReceiptLong, "tab_accountant_fees"),
                NavTab("payments", "Payments", Icons.Default.Paid, "tab_accountant_payments"),
                NavTab("payroll", "Payroll", Icons.Default.Payments, "tab_accountant_payroll")
            )
            UserRole.SECRETARY -> listOf(
                NavTab("dashboard", "Overview", Icons.Default.Dashboard, "tab_secretary_dashboard"),
                NavTab("admissions", "Admissions", Icons.Default.PersonAdd, "tab_secretary_admissions"),
                NavTab("learners", "Learners", Icons.Default.School, "tab_secretary_learners"),
                NavTab("finance", "Fees", Icons.Default.ReceiptLong, "tab_secretary_fees")
            )
            UserRole.TEACHER -> listOf(
                NavTab("dashboard", "Overview", Icons.Default.Dashboard, "tab_teacher_dashboard"),
                NavTab("attendance", "Roll Call", Icons.Default.FactCheck, "tab_teacher_attendance"),
                NavTab("academics", "Marks Entry", Icons.Default.EditNote, "tab_teacher_academics"),
                NavTab("learners", "Learners", Icons.Default.School, "tab_teacher_learners")
            )
            UserRole.PARENT -> listOf(
                NavTab("dashboard", "Portal", Icons.Default.Home, "tab_parent_dashboard"),
                NavTab("learners", "My Children", Icons.Default.FamilyRestroom, "tab_parent_children"),
                NavTab("finance", "Fees", Icons.Default.ReceiptLong, "tab_parent_fees"),
                NavTab("complaints", "Complaints", Icons.Default.QuestionAnswer, "tab_parent_complaints")
            )
            UserRole.LEARNER -> listOf(
                NavTab("dashboard", "Home", Icons.Default.Home, "tab_learner_dashboard"),
                NavTab("academics", "My Results", Icons.Default.EmojiEvents, "tab_learner_academics"),
                NavTab("videos", "Revision", Icons.Default.VideoLibrary, "tab_learner_videos"),
                NavTab("operations", "Timetable", Icons.Default.Schedule, "tab_learner_timetable")
            )
        }

        // Mandatory rule: exactly 4 bottom tabs + "More"
        return primaryTabs.take(4) + NavTab("more", "More", Icons.Default.MoreHoriz, "tab_more")
    }

    fun canEditLearner(role: UserRole): Boolean {
        // "Only Secretary and Head Teacher can edit a learner profile; others view only."
        return role == UserRole.SECRETARY || role == UserRole.HEAD_TEACHER
    }

    fun canManageAccounts(role: UserRole): Boolean {
        // "Director creates accounts."
        return role == UserRole.DIRECTOR
    }

    fun canHandleAdmissions(role: UserRole): Boolean {
        // "Secretary handles admissions and creates learner accounts."
        return role == UserRole.SECRETARY || role == UserRole.DIRECTOR || role == UserRole.HEAD_TEACHER
    }

    fun canCreateLearnerAccount(role: UserRole): Boolean {
        return role == UserRole.SECRETARY || role == UserRole.DIRECTOR
    }

    fun canViewPayroll(role: UserRole): Boolean {
        return role == UserRole.DIRECTOR || role == UserRole.HEAD_TEACHER || role == UserRole.ACCOUNTANT
    }

    fun canAccessComplaints(role: UserRole): Boolean {
        // "Complaints go only from parent to Head Teacher and Director."
        return role == UserRole.PARENT || role == UserRole.HEAD_TEACHER || role == UserRole.DIRECTOR
    }
}
