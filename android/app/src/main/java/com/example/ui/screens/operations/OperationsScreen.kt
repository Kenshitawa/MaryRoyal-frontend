package com.example.ui.screens.operations

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.MaryRoyalApp
import com.example.data.remote.model.CreateTeachingLogRequest
import com.example.data.remote.model.SchemeOfWorkDto
import com.example.data.remote.model.TeachingLogDto
import com.example.data.remote.model.TimetableDto
import com.example.ui.common.*
import com.example.ui.navigation.UserRole
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OperationsScreen() {
    val app = MaryRoyalApp.instance
    val repo = app.operationsRepository
    val authRepo = app.authRepository
    val role = remember { UserRole.fromCode(authRepo.getUserRole()) }
    val coroutineScope = rememberCoroutineScope()

    var selectedTab by remember { mutableIntStateOf(0) }
    var timetables by remember { mutableStateOf<List<TimetableDto>>(emptyList()) }
    var schemes by remember { mutableStateOf<List<SchemeOfWorkDto>>(emptyList()) }
    var logs by remember { mutableStateOf<List<TeachingLogDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showNewLogDialog by remember { mutableStateOf(false) }

    // New Log Form State
    var logGrade by remember { mutableStateOf("Grade 1") }
    var logSubject by remember { mutableStateOf("English") }
    var logStrand by remember { mutableStateOf("Reading & Comprehension") }
    var logOutcome by remember { mutableStateOf("Learners can identify vowel sounds in short words.") }

    val context = LocalContext.current
    var isOfflineMode by remember { mutableStateOf(false) }

    fun checkIsOnline(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    fun loadData() {
        isLoading = true
        isOfflineMode = !checkIsOnline()
        coroutineScope.launch {
            val tRes = repo.getTimetables()
            if (tRes.isSuccess) timetables = tRes.getOrNull() ?: emptyList()

            val sRes = repo.getSchemes()
            if (sRes.isSuccess) schemes = sRes.getOrNull() ?: emptyList()

            val lRes = repo.getTeachingLogs()
            if (lRes.isSuccess) logs = lRes.getOrNull() ?: emptyList()

            isLoading = false
        }
    }

    LaunchedEffect(Unit) {
        loadData()
    }

    Scaffold(
        topBar = {
            SchoolCrestHeader(title = "School Operations", subtitle = "Timetable, Schemes & Teaching Logs")
        },
        floatingActionButton = {
            if (selectedTab == 2 && (role == UserRole.TEACHER || role == UserRole.HEAD_TEACHER)) {
                ExtendedFloatingActionButton(
                    onClick = { showNewLogDialog = true },
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("New Teaching Log") },
                    containerColor = RoyalBlue,
                    contentColor = Color.White,
                    modifier = Modifier.testTag("new_log_fab")
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("operations_screen")
        ) {
            TabRow(selectedTabIndex = selectedTab, containerColor = MaterialTheme.colorScheme.surface) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Timetable") })
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Schemes") })
                Tab(selected = selectedTab == 2, onClick = { selectedTab = 2 }, text = { Text("Teaching Logs") })
            }

            if (isLoading) {
                LoadingSkeleton(count = 4)
            } else {
                when (selectedTab) {
                    0 -> {
                        // Timetable View
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            if (isOfflineMode) {
                                item {
                                    OfflineBanner(message = "Offline Mode: Displaying timetable from Room database cache.")
                                }
                            }
                            item {
                                Surface(
                                    color = RoyalBlue.copy(alpha = 0.08f),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.Schedule, contentDescription = null, tint = RoyalBlue)
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Column {
                                            Text("Official CBC Master Schedule", fontWeight = FontWeight.Bold, color = RoyalBlue)
                                            Text("Cached locally in Room database for offline access during classroom instruction.", style = MaterialTheme.typography.bodySmall)
                                        }
                                    }
                                }
                            }

                            val days = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday")
                            val sampleSchedule = listOf(
                                Triple("08:00 - 08:40", "Mathematics", "Room 4A"),
                                Triple("08:40 - 09:20", "English Language", "Room 4A"),
                                Triple("09:20 - 10:00", "Kiswahili", "Room 4A"),
                                Triple("10:30 - 11:10", "Science & Technology", "Lab 1"),
                                Triple("11:10 - 11:50", "Creative Arts & Sports", "Playfield"),
                                Triple("12:00 - 12:40", "Social Studies / CRE", "Room 4A")
                            )

                            val realSlots = timetables.flatMap { it.slots }

                            days.forEach { day ->
                                item {
                                    Text(day, fontWeight = FontWeight.Bold, color = RoyalBlue, fontSize = 16.sp, modifier = Modifier.padding(top = 8.dp))
                                }
                                val daySlots = realSlots.filter { it.dayOfWeek.equals(day, ignoreCase = true) }
                                if (daySlots.isNotEmpty()) {
                                    items(daySlots) { slot ->
                                        Card(
                                            modifier = Modifier.fillMaxWidth(),
                                            shape = RoundedCornerShape(10.dp),
                                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                                        ) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column {
                                                    Text(slot.subject, fontWeight = FontWeight.SemiBold)
                                                    val subtext = listOfNotNull(slot.room, slot.teacherName).joinToString(" • ")
                                                    if (subtext.isNotBlank()) {
                                                        Text(subtext, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                                    }
                                                }
                                                Surface(color = RoyalGold.copy(alpha = 0.15f), shape = RoundedCornerShape(6.dp)) {
                                                    Text("${slot.startTime} - ${slot.endTime}", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = Color(0xFF7A5400), modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    items(sampleSchedule) { (time, subj, room) ->
                                        Card(
                                            modifier = Modifier.fillMaxWidth(),
                                            shape = RoundedCornerShape(10.dp),
                                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                                        ) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth().padding(12.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column {
                                                    Text(subj, fontWeight = FontWeight.SemiBold)
                                                    Text(room, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                                }
                                                Surface(color = RoyalGold.copy(alpha = 0.15f), shape = RoundedCornerShape(6.dp)) {
                                                    Text(time, fontWeight = FontWeight.Bold, fontSize = 11.sp, color = Color(0xFF7A5400), modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    1 -> {
                        // Schemes of Work
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(schemes) { scheme ->
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                                ) {
                                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text("${scheme.grade} • ${scheme.subject}", fontWeight = FontWeight.Bold, color = RoyalBlue)
                                            Surface(color = Color(0xFFD1FAE5), shape = RoundedCornerShape(4.dp)) {
                                                Text("Week ${scheme.week}", fontWeight = FontWeight.Bold, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                            }
                                        }
                                        Text("Strand: ${scheme.strand}", style = MaterialTheme.typography.bodyMedium)
                                        Text("Status: ${scheme.status}", style = MaterialTheme.typography.labelSmall, color = Color(0xFF059669))
                                    }
                                }
                            }
                        }
                    }
                    2 -> {
                        // Teaching Logs
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(logs) { log ->
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                                ) {
                                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text("${log.grade} • ${log.subject}", fontWeight = FontWeight.Bold, color = RoyalBlue)
                                            Text(log.lessonDate, style = MaterialTheme.typography.labelSmall)
                                        }
                                        Text("Strand: ${log.strand}", fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium)
                                        Text("Outcome: ${log.learningOutcome ?: ""}", style = MaterialTheme.typography.bodySmall)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // New Teaching Log Dialog
        if (showNewLogDialog) {
            AlertDialog(
                onDismissRequest = { showNewLogDialog = false },
                title = { Text("Log Completed CBC Lesson") },
                text = {
                    Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(value = logGrade, onValueChange = { logGrade = it }, label = { Text("Grade") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = logSubject, onValueChange = { logSubject = it }, label = { Text("Subject") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = logStrand, onValueChange = { logStrand = it }, label = { Text("Strand") }, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = logOutcome, onValueChange = { logOutcome = it }, label = { Text("Learning Outcome & Competencies Achieved") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            coroutineScope.launch {
                                repo.createTeachingLog(CreateTeachingLogRequest(logGrade, logSubject, logStrand, "2026-11-04", logOutcome))
                                showNewLogDialog = false
                                loadData()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue)
                    ) {
                        Text("Save Log")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showNewLogDialog = false }) { Text("Cancel") }
                }
            )
        }
    }
}
