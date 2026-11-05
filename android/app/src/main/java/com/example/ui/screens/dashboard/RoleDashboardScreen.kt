package com.example.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.MaryRoyalApp
import com.example.ui.common.*
import com.example.ui.navigation.UserRole
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@Composable
fun RoleDashboardScreen(
    onNavigate: (String) -> Unit
) {
    val app = MaryRoyalApp.instance
    val authRepo = app.authRepository
    val learnerRepo = app.learnerRepository
    val financeRepo = app.financeRepository
    val academicRepo = app.academicRepository
    val operationsRepo = app.operationsRepository

    val coroutineScope = rememberCoroutineScope()
    val roleStr = authRepo.getUserRole()
    val role = remember(roleStr) { UserRole.fromCode(roleStr) }
    val userName = authRepo.getUserName()

    var isRefreshing by remember { mutableStateOf(false) }
    var learnerCount by remember { mutableIntStateOf(0) }
    var invoiceCount by remember { mutableIntStateOf(0) }
    var assessmentCount by remember { mutableIntStateOf(0) }
    var isOffline by remember { mutableStateOf(false) }

    fun refreshData() {
        isRefreshing = true
        coroutineScope.launch {
            val lRes = learnerRepo.fetchLearners()
            if (lRes.isSuccess) learnerCount = lRes.getOrNull()?.size ?: 0
            else isOffline = true

            val fRes = financeRepo.getInvoices()
            if (fRes.isSuccess) invoiceCount = fRes.getOrNull()?.size ?: 0

            val aRes = academicRepo.getAssessments()
            if (aRes.isSuccess) assessmentCount = aRes.getOrNull()?.size ?: 0

            isRefreshing = false
        }
    }

    LaunchedEffect(Unit) {
        refreshData()
    }

    Scaffold(
        topBar = {
            SchoolCrestHeader(
                title = "Mary Royal Portal",
                subtitle = "Welcome back, $userName"
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("dashboard_screen"),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (isOffline) {
                item {
                    OfflineBanner()
                }
            }

            // Role Badge & CBC Banner
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = RoyalBlue.copy(alpha = 0.08f)
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                text = "Authenticated Role",
                                style = MaterialTheme.typography.labelSmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                            )
                            Text(
                                text = role.displayName,
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = RoyalBlue
                                )
                            )
                        }

                        Surface(
                            color = RoyalGold,
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                text = "CBC Standard",
                                color = Color(0xFF332000),
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }
            }

            // Role-Specific Metrics Grid
            item {
                Text(
                    text = "Key Operational Indicators",
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                )
            }

            when (role) {
                UserRole.DIRECTOR -> {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "Enrolled Learners",
                                    value = "$learnerCount",
                                    icon = Icons.Default.School,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("learners") }
                                )
                                MetricCard(
                                    title = "Fee Invoices",
                                    value = "$invoiceCount",
                                    icon = Icons.Default.ReceiptLong,
                                    modifier = Modifier.weight(1f),
                                    accentColor = Color(0xFF0284C7),
                                    onClick = { onNavigate("finance") }
                                )
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "User Accounts",
                                    value = "Manage",
                                    icon = Icons.Default.ManageAccounts,
                                    modifier = Modifier.weight(1f),
                                    accentColor = Color(0xFF059669),
                                    onClick = { onNavigate("accounts") }
                                )
                                MetricCard(
                                    title = "Staff Payroll",
                                    value = "Active",
                                    icon = Icons.Default.Payments,
                                    modifier = Modifier.weight(1f),
                                    accentColor = RoyalGold,
                                    onClick = { onNavigate("payroll") }
                                )
                            }
                        }
                    }
                }
                UserRole.HEAD_TEACHER -> {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "Admissions Review",
                                    value = "Open",
                                    icon = Icons.Default.PersonAdd,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("admissions") }
                                )
                                MetricCard(
                                    title = "CBC Assessments",
                                    value = "$assessmentCount Entries",
                                    icon = Icons.Default.MenuBook,
                                    modifier = Modifier.weight(1f),
                                    accentColor = Color(0xFF059669),
                                    onClick = { onNavigate("academics") }
                                )
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "Parent Complaints",
                                    value = "Review",
                                    icon = Icons.Default.QuestionAnswer,
                                    modifier = Modifier.weight(1f),
                                    accentColor = Color(0xFFD97706),
                                    onClick = { onNavigate("complaints") }
                                )
                                MetricCard(
                                    title = "Fee Summary",
                                    value = "View Balances",
                                    icon = Icons.Default.AccountBalance,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("finance") }
                                )
                            }
                        }
                    }
                }
                UserRole.SECRETARY -> {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "New Admission",
                                    value = "+ Register",
                                    icon = Icons.Default.PersonAdd,
                                    modifier = Modifier.weight(1f),
                                    accentColor = Color(0xFF059669),
                                    onClick = { onNavigate("admissions") }
                                )
                                MetricCard(
                                    title = "Learner Register",
                                    value = "$learnerCount Pupils",
                                    icon = Icons.Default.School,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("learners") }
                                )
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "Fee Invoices",
                                    value = "Lookup",
                                    icon = Icons.Default.ReceiptLong,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("finance") }
                                )
                                MetricCard(
                                    title = "Class Timetable",
                                    value = "Timetable",
                                    icon = Icons.Default.Schedule,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("operations") }
                                )
                            }
                        }
                    }
                }
                UserRole.ACCOUNTANT -> {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "Active Invoices",
                                    value = "$invoiceCount",
                                    icon = Icons.Default.ReceiptLong,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("finance") }
                                )
                                MetricCard(
                                    title = "Record Payment",
                                    value = "M-Pesa / Cash",
                                    icon = Icons.Default.Paid,
                                    modifier = Modifier.weight(1f),
                                    accentColor = Color(0xFF059669),
                                    onClick = { onNavigate("payments") }
                                )
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "Monthly Payroll",
                                    value = "Ledger",
                                    icon = Icons.Default.Payments,
                                    modifier = Modifier.weight(1f),
                                    accentColor = RoyalGold,
                                    onClick = { onNavigate("payroll") }
                                )
                                MetricCard(
                                    title = "Learner Directory",
                                    value = "Verify IDs",
                                    icon = Icons.Default.Badge,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("learners") }
                                )
                            }
                        }
                    }
                }
                UserRole.TEACHER -> {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "Class Roll Call",
                                    value = "Take Attendance",
                                    icon = Icons.Default.FactCheck,
                                    modifier = Modifier.weight(1f),
                                    accentColor = Color(0xFF059669),
                                    onClick = { onNavigate("attendance") }
                                )
                                MetricCard(
                                    title = "CBC Marks Entry",
                                    value = "$assessmentCount Graded",
                                    icon = Icons.Default.EditNote,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("academics") }
                                )
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "Lesson Timetable",
                                    value = "View Schedule",
                                    icon = Icons.Default.Schedule,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("operations") }
                                )
                                MetricCard(
                                    title = "Weak Topic Videos",
                                    value = "Revision",
                                    icon = Icons.Default.VideoLibrary,
                                    modifier = Modifier.weight(1f),
                                    accentColor = Color(0xFFD97706),
                                    onClick = { onNavigate("videos") }
                                )
                            }
                        }
                    }
                }
                UserRole.PARENT -> {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "My Children",
                                    value = "View Profile",
                                    icon = Icons.Default.FamilyRestroom,
                                    modifier = Modifier.weight(1f),
                                    accentColor = RoyalBlue,
                                    onClick = { onNavigate("learners") }
                                )
                                MetricCard(
                                    title = "Term Fees",
                                    value = "Balances & Receipts",
                                    icon = Icons.Default.ReceiptLong,
                                    modifier = Modifier.weight(1f),
                                    accentColor = Color(0xFF059669),
                                    onClick = { onNavigate("finance") }
                                )
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "Head Teacher Direct",
                                    value = "Send Complaint",
                                    icon = Icons.Default.QuestionAnswer,
                                    modifier = Modifier.weight(1f),
                                    accentColor = Color(0xFFD97706),
                                    onClick = { onNavigate("complaints") }
                                )
                                MetricCard(
                                    title = "Weak Topics",
                                    value = "CBC Revision",
                                    icon = Icons.Default.VideoLibrary,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("videos") }
                                )
                            }
                        }
                    }
                }
                else -> {
                    // Learner / Deputy
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "My Assessment",
                                    value = "View Marks",
                                    icon = Icons.Default.EmojiEvents,
                                    modifier = Modifier.weight(1f),
                                    accentColor = Color(0xFF059669),
                                    onClick = { onNavigate("academics") }
                                )
                                MetricCard(
                                    title = "Weak Topic Videos",
                                    value = "Curated Lessons",
                                    icon = Icons.Default.VideoLibrary,
                                    modifier = Modifier.weight(1f),
                                    accentColor = RoyalGold,
                                    onClick = { onNavigate("videos") }
                                )
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                MetricCard(
                                    title = "Weekly Timetable",
                                    value = "Class Schedule",
                                    icon = Icons.Default.Schedule,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("operations") }
                                )
                                MetricCard(
                                    title = "School Notifications",
                                    value = "Announcements",
                                    icon = Icons.Default.Notifications,
                                    modifier = Modifier.weight(1f),
                                    onClick = { onNavigate("notifications") }
                                )
                            }
                        }
                    }
                }
            }

            // Quick Actions Horizontal Row
            item {
                Text(
                    text = "Quick Portals",
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                )
            }

            item {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item {
                        AssistChip(
                            onClick = { onNavigate("learners") },
                            label = { Text("Learner Profiles") },
                            leadingIcon = { Icon(Icons.Default.School, contentDescription = null) }
                        )
                    }
                    item {
                        AssistChip(
                            onClick = { onNavigate("finance") },
                            label = { Text("Fees & Balances") },
                            leadingIcon = { Icon(Icons.Default.ReceiptLong, contentDescription = null) }
                        )
                    }
                    item {
                        AssistChip(
                            onClick = { onNavigate("academics") },
                            label = { Text("CBC Results") },
                            leadingIcon = { Icon(Icons.Default.Grade, contentDescription = null) }
                        )
                    }
                    item {
                        AssistChip(
                            onClick = { onNavigate("operations") },
                            label = { Text("Timetable") },
                            leadingIcon = { Icon(Icons.Default.Schedule, contentDescription = null) }
                        )
                    }
                    item {
                        AssistChip(
                            onClick = { onNavigate("notifications") },
                            label = { Text("Announcements") },
                            leadingIcon = { Icon(Icons.Default.Notifications, contentDescription = null) }
                        )
                    }
                }
            }
        }
    }
}
