package com.example.ui.screens.attendance

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.compose.ui.platform.LocalContext
import com.example.MaryRoyalApp
import com.example.data.remote.model.AttendanceLearnerDto
import com.example.data.remote.model.AttendanceRecordItem
import com.example.ui.common.*
import com.example.ui.navigation.UserRole
import com.example.ui.theme.RoyalBlue
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceScreen() {
    val app = MaryRoyalApp.instance
    val repo = app.attendanceRepository
    val authRepo = app.authRepository
    val role = remember { UserRole.fromCode(authRepo.getUserRole()) }
    val coroutineScope = rememberCoroutineScope()

    val context = LocalContext.current
    var isOfflineMode by remember { mutableStateOf(false) }

    val todayStr = remember {
        SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
    }

    var selectedGrade by remember { mutableStateOf("Grade 1") }
    var selectedDate by remember { mutableStateOf(todayStr) }
    var state by remember { mutableStateOf<UiState<List<AttendanceLearnerDto>>>(UiState.Loading) }
    val attendanceMap = remember { mutableStateMapOf<String, String>() }
    var isSaving by remember { mutableStateOf(false) }
    var saveSuccessMessage by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun checkIsOnline(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    fun loadAttendance() {
        state = UiState.Loading
        saveSuccessMessage = null
        errorMessage = null
        isOfflineMode = !checkIsOnline()
        coroutineScope.launch {
            val res = repo.getAttendance(selectedGrade, selectedDate)
            res.fold(
                onSuccess = { list ->
                    attendanceMap.clear()
                    list.forEach { attendanceMap[it.id] = it.status }
                    if (list.isEmpty()) state = UiState.Empty
                    else state = UiState.Success(list)
                },
                onFailure = { 
                    isOfflineMode = true
                    state = UiState.Error(it.message ?: "Failed to load attendance.") 
                }
            )
        }
    }

    LaunchedEffect(selectedGrade, selectedDate) {
        loadAttendance()
    }

    Scaffold(
        topBar = {
            SchoolCrestHeader(title = "Attendance Roll Call", subtitle = "Daily CBC Class Tracking")
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("attendance_screen")
        ) {
            if (isOfflineMode) {
                OfflineBanner(message = "Offline Mode: Displaying attendance records from Room database cache.")
            }
            // Filter Bar
            Surface(
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 2.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    val grades = listOf("PP1", "PP2", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9")
                    ScrollableTabRow(
                        selectedTabIndex = grades.indexOf(selectedGrade).coerceAtLeast(0),
                        edgePadding = 0.dp,
                        divider = {}
                    ) {
                        grades.forEach { g ->
                            Tab(
                                selected = selectedGrade == g,
                                onClick = { selectedGrade = g },
                                text = { Text(g, fontWeight = if (selectedGrade == g) FontWeight.Bold else FontWeight.Normal) }
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Date: $selectedDate",
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold)
                        )

                        Button(
                            onClick = {
                                isSaving = true
                                saveSuccessMessage = null
                                errorMessage = null
                                coroutineScope.launch {
                                    val records = attendanceMap.map { AttendanceRecordItem(it.key, it.value) }
                                    val res = repo.recordAttendance(selectedGrade, selectedDate, records)
                                    isSaving = false
                                    res.fold(
                                        onSuccess = { savedCount ->
                                            saveSuccessMessage = "Saved roll call for $savedCount learners"
                                        },
                                        onFailure = { err ->
                                            errorMessage = err.message
                                        }
                                    )
                                }
                            },
                            enabled = !isSaving && state is UiState.Success,
                            colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                            modifier = Modifier.testTag("save_attendance_button")
                        ) {
                            if (isSaving) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp))
                            } else {
                                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Save Roll Call")
                            }
                        }
                    }

                    if (saveSuccessMessage != null) {
                        Surface(
                            color = Color(0xFFD1FAE5),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = saveSuccessMessage ?: "",
                                color = Color(0xFF065F46),
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }
                }
            }

            when (val current = state) {
                is UiState.Loading -> LoadingSkeleton(count = 5)
                is UiState.Empty -> EmptyStateView(
                    title = "No Learners Enrolled",
                    message = "No learners found in $selectedGrade."
                )
                is UiState.Error -> ErrorStateView(
                    message = current.message,
                    onRetry = { loadAttendance() }
                )
                is UiState.Success -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(current.data, key = { it.id }) { learner ->
                            val currentStatus = attendanceMap[learner.id] ?: "PRESENT"

                            Card(
                                modifier = Modifier.fillMaxWidth().testTag("attendance_row_${learner.admissionNo.lowercase()}"),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = learner.name,
                                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
                                        )
                                        Text(
                                            text = learner.admissionNo,
                                            style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        )
                                    }

                                    // Status Toggle Buttons: Present, Absent, Late
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        AttendanceToggleButton(
                                            label = "P",
                                            isSelected = currentStatus == "PRESENT",
                                            activeColor = Color(0xFF059669),
                                            onClick = { attendanceMap[learner.id] = "PRESENT" }
                                        )
                                        AttendanceToggleButton(
                                            label = "A",
                                            isSelected = currentStatus == "ABSENT",
                                            activeColor = Color(0xFFDC2626),
                                            onClick = { attendanceMap[learner.id] = "ABSENT" }
                                        )
                                        AttendanceToggleButton(
                                            label = "L",
                                            isSelected = currentStatus == "LATE",
                                            activeColor = Color(0xFFD97706),
                                            onClick = { attendanceMap[learner.id] = "LATE" }
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                else -> Unit
            }
        }
    }
}

@Composable
private fun AttendanceToggleButton(
    label: String,
    isSelected: Boolean,
    activeColor: Color,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(38.dp)
            .clip(CircleShape)
            .background(if (isSelected) activeColor else MaterialTheme.colorScheme.surfaceVariant)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontWeight = FontWeight.Bold,
            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 14.sp
        )
    }
}
