package com.example

import com.example.ui.navigation.RoleNavManager
import com.example.ui.navigation.UserRole
import org.junit.Assert.*
import org.junit.Test

class RoleNavManagerTest {

    @Test
    fun testEveryRoleHasFourTabsPlusMore() {
        UserRole.entries.forEach { role ->
            val tabs = RoleNavManager.getTabsForRole(role)
            assertEquals("Role $role must have exactly 5 navigation items", 5, tabs.size)
            assertEquals("The 5th item must always be More", "more", tabs.last().id)
        }
    }

    @Test
    fun testLearnerEditPermissions() {
        // "Only Secretary and Head Teacher can edit a learner profile; others view only."
        assertTrue(RoleNavManager.canEditLearner(UserRole.SECRETARY))
        assertTrue(RoleNavManager.canEditLearner(UserRole.HEAD_TEACHER))
        assertFalse(RoleNavManager.canEditLearner(UserRole.DIRECTOR))
        assertFalse(RoleNavManager.canEditLearner(UserRole.DEPUTY))
        assertFalse(RoleNavManager.canEditLearner(UserRole.ACCOUNTANT))
        assertFalse(RoleNavManager.canEditLearner(UserRole.TEACHER))
        assertFalse(RoleNavManager.canEditLearner(UserRole.PARENT))
        assertFalse(RoleNavManager.canEditLearner(UserRole.LEARNER))
    }

    @Test
    fun testAccountCreationPermissions() {
        // "Director creates accounts."
        assertTrue(RoleNavManager.canManageAccounts(UserRole.DIRECTOR))
        assertFalse(RoleNavManager.canManageAccounts(UserRole.HEAD_TEACHER))
        assertFalse(RoleNavManager.canManageAccounts(UserRole.SECRETARY))
    }

    @Test
    fun testComplaintsAccessPermissions() {
        // "Complaints go only from parent to Head Teacher and Director."
        assertTrue(RoleNavManager.canAccessComplaints(UserRole.PARENT))
        assertTrue(RoleNavManager.canAccessComplaints(UserRole.HEAD_TEACHER))
        assertTrue(RoleNavManager.canAccessComplaints(UserRole.DIRECTOR))
        assertFalse(RoleNavManager.canAccessComplaints(UserRole.TEACHER))
        assertFalse(RoleNavManager.canAccessComplaints(UserRole.ACCOUNTANT))
        assertFalse(RoleNavManager.canAccessComplaints(UserRole.DEPUTY))
        assertFalse(RoleNavManager.canAccessComplaints(UserRole.LEARNER))
    }
}
