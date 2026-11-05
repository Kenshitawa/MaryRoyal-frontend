package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.navigation.compose.*
import com.example.ui.common.MoreOptionsSheet
import com.example.ui.navigation.RoleNavManager
import com.example.ui.navigation.UserRole
import com.example.ui.screens.academics.AcademicsScreen
import com.example.ui.screens.accounts.AccountsScreen
import com.example.ui.screens.admissions.AdmissionsListScreen
import com.example.ui.screens.admissions.NewAdmissionScreen
import com.example.ui.screens.attendance.AttendanceScreen
import com.example.ui.screens.auth.ChangePasswordScreen
import com.example.ui.screens.auth.LoginScreen
import com.example.ui.screens.complaints.ComplaintsScreen
import com.example.ui.screens.dashboard.RoleDashboardScreen
import com.example.ui.screens.finance.FinanceScreen
import com.example.ui.screens.learners.LearnerDetailScreen
import com.example.ui.screens.learners.LearnerEditScreen
import com.example.ui.screens.learners.LearnersListScreen
import com.example.ui.screens.notifications.NotificationsScreen
import com.example.ui.screens.operations.OperationsScreen
import com.example.ui.screens.profile.ProfileScreen
import com.example.ui.screens.videos.LearningVideosScreen
import com.example.ui.theme.MaryRoyalTheme
import com.example.ui.theme.RoyalBlue

class MainActivity : FragmentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            MaryRoyalTheme {
                MainAppHost()
            }
        }
    }
}

@Composable
fun MainAppHost() {
    val app = MaryRoyalApp.instance
    val authRepo = app.authRepository
    val navController = rememberNavController()

    var isLoggedIn by remember { mutableStateOf(authRepo.isLoggedIn()) }
    var userRole by remember { mutableStateOf(UserRole.fromCode(authRepo.getUserRole())) }

    // Listen for global session expiry (auto-logout)
    LaunchedEffect(Unit) {
        app.sessionExpiredEvent.collect {
            isLoggedIn = false
            navController.navigate("login") {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    if (!isLoggedIn) {
        NavHost(navController = navController, startDestination = "login") {
            composable("login") {
                LoginScreen(
                    onLoginSuccess = { forcePasswordChange ->
                        userRole = UserRole.fromCode(authRepo.getUserRole())
                        isLoggedIn = true
                        if (forcePasswordChange) {
                            navController.navigate("change_password") {
                                popUpTo("login") { inclusive = true }
                            }
                        } else {
                            navController.navigate("portal") {
                                popUpTo("login") { inclusive = true }
                            }
                        }
                    }
                )
            }
            composable("change_password") {
                ChangePasswordScreen(
                    onPasswordChanged = {
                        navController.navigate("portal") {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
        }
    } else {
        PortalScaffold(
            userRole = userRole,
            onLogout = {
                isLoggedIn = false
                navController.navigate("login") {
                    popUpTo(0) { inclusive = true }
                }
            }
        )
    }
}

@Composable
fun PortalScaffold(
    userRole: UserRole,
    onLogout: () -> Unit
) {
    var currentTabId by remember { mutableStateOf("dashboard") }
    var showMoreSheet by remember { mutableStateOf(false) }

    // Secondary sub-screen navigation state
    var selectedLearnerId by remember { mutableStateOf<String?>(null) }
    var editingLearnerId by remember { mutableStateOf<String?>(null) }
    var isCreatingAdmission by remember { mutableStateOf(false) }
    var isChangingPassword by remember { mutableStateOf(false) }

    val bottomTabs = remember(userRole) { RoleNavManager.getTabsForRole(userRole) }

    // Back button handling
    BackHandler(
        enabled = editingLearnerId != null || selectedLearnerId != null || isCreatingAdmission || isChangingPassword || currentTabId != "dashboard"
    ) {
        when {
            editingLearnerId != null -> editingLearnerId = null
            selectedLearnerId != null -> selectedLearnerId = null
            isCreatingAdmission -> isCreatingAdmission = false
            isChangingPassword -> isChangingPassword = false
            currentTabId != "dashboard" -> currentTabId = "dashboard"
        }
    }

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 6.dp,
                modifier = Modifier.testTag("portal_bottom_nav")
            ) {
                bottomTabs.forEach { tab ->
                    val isSelected = currentTabId == tab.id
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = {
                            if (tab.id == "more") {
                                showMoreSheet = true
                            } else {
                                currentTabId = tab.id
                                selectedLearnerId = null
                                editingLearnerId = null
                                isCreatingAdmission = false
                                isChangingPassword = false
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = tab.title) },
                        label = { Text(tab.title) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = RoyalBlue,
                            selectedTextColor = RoyalBlue,
                            indicatorColor = RoyalBlue.copy(alpha = 0.12f)
                        ),
                        modifier = Modifier.testTag(tab.testTag)
                    )
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                isChangingPassword -> {
                    ChangePasswordScreen(onPasswordChanged = { isChangingPassword = false })
                }
                editingLearnerId != null -> {
                    LearnerEditScreen(
                        learnerId = editingLearnerId!!,
                        onBack = { editingLearnerId = null },
                        onSaved = { editingLearnerId = null }
                    )
                }
                selectedLearnerId != null -> {
                    LearnerDetailScreen(
                        learnerId = selectedLearnerId!!,
                        onBack = { selectedLearnerId = null },
                        onEditLearner = { editingLearnerId = it }
                    )
                }
                isCreatingAdmission -> {
                    NewAdmissionScreen(
                        onBack = { isCreatingAdmission = false },
                        onAdmissionComplete = { isCreatingAdmission = false }
                    )
                }
                else -> {
                    when (currentTabId) {
                        "dashboard" -> RoleDashboardScreen(
                            onNavigate = { target ->
                                when (target) {
                                    "learners" -> currentTabId = "learners"
                                    "finance" -> currentTabId = "finance"
                                    "academics" -> currentTabId = "academics"
                                    "attendance" -> currentTabId = "attendance"
                                    "operations" -> currentTabId = "operations"
                                    "admissions" -> isCreatingAdmission = true
                                    "accounts" -> currentTabId = "accounts"
                                    "complaints" -> currentTabId = "complaints"
                                    "videos" -> currentTabId = "videos"
                                    "notifications" -> currentTabId = "notifications"
                                    "payroll" -> currentTabId = "payroll"
                                    else -> currentTabId = target
                                }
                            }
                        )
                        "learners" -> LearnersListScreen(
                            onLearnerSelected = { selectedLearnerId = it },
                            onNewAdmission = { isCreatingAdmission = true }
                        )
                        "admissions" -> AdmissionsListScreen(
                            onBack = { currentTabId = "dashboard" },
                            onNewAdmission = { isCreatingAdmission = true },
                            onViewAdmission = { /* view draft */ }
                        )
                        "attendance" -> AttendanceScreen()
                        "academics" -> AcademicsScreen()
                        "finance", "payments" -> FinanceScreen()
                        "payroll" -> FinanceScreen()
                        "complaints" -> ComplaintsScreen()
                        "videos" -> LearningVideosScreen()
                        "operations" -> OperationsScreen()
                        "accounts" -> AccountsScreen()
                        "notifications" -> NotificationsScreen()
                        "profile" -> ProfileScreen(
                            onChangePassword = { isChangingPassword = true },
                            onLogout = onLogout
                        )
                        else -> RoleDashboardScreen(onNavigate = { currentTabId = it })
                    }
                }
            }

            if (showMoreSheet) {
                MoreOptionsSheet(
                    role = userRole,
                    onDismiss = { showMoreSheet = false },
                    onNavigate = { destination ->
                        when (destination) {
                            "admissions" -> currentTabId = "admissions"
                            "attendance" -> currentTabId = "attendance"
                            "academics" -> currentTabId = "academics"
                            "videos" -> currentTabId = "videos"
                            "payroll" -> currentTabId = "payroll"
                            "complaints" -> currentTabId = "complaints"
                            "accounts" -> currentTabId = "accounts"
                            "operations" -> currentTabId = "operations"
                            "notifications" -> currentTabId = "notifications"
                            "profile" -> currentTabId = "profile"
                            else -> currentTabId = destination
                        }
                    }
                )
            }
        }
    }
}
