package com.example.ui.screens.academics

import androidx.compose.foundation.clickable
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
import com.example.data.remote.model.AssessmentDto
import com.example.data.remote.model.CreateAssessmentRequest
import com.example.ui.common.*
import com.example.ui.navigation.RoleNavManager
import com.example.ui.navigation.UserRole
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AcademicsScreen() {
    val app = MaryRoyalApp.instance
    val repo = app.academicRepository
    val learnerRepo = app.learnerRepository
    val authRepo = app.authRepository
    val role = remember { UserRole.fromCode(authRepo.getUserRole()) }
    val coroutineScope = rememberCoroutineScope()

    var selectedTab by remember { mutableIntStateOf(0) }
    var state by remember { mutableStateOf<UiState<List<AssessmentDto>>>(UiState.Loading) }
    var showRecordDialog by remember { mutableStateOf(false) }

    // Dialog state
    var learnersList by remember { mutableStateOf<List<com.example.data.remote.model.LearnerDto>>(emptyList()) }
    var selectedLearnerId by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("Mathematics") }
    var scoreInput by remember { mutableStateOf("75") }
    var term by remember { mutableStateOf("2026 Term 1") }
    var strand by remember { mutableStateOf("Numbers & Operations") }
    var comment by remember { mutableStateOf("Good mastery of core concepts") }
    var isSavingMark by remember { mutableStateOf(false) }
    var dialogError by remember { mutableStateOf<String?>(null) }

    fun loadAssessments() {
        state = UiState.Loading
        coroutineScope.launch {
            val res = repo.getAssessments()
            res.fold(
                onSuccess = { list ->
                    if (list.isEmpty()) state = UiState.Empty
                    else state = UiState.Success(list)
                },
                onFailure = { state = UiState.Error(it.message ?: "Failed to load assessments.") }
            )
        }
    }

    LaunchedEffect(Unit) {
        loadAssessments()
        // Prefetch learners for dialog
        val lRes = learnerRepo.fetchLearners()
        if (lRes.isSuccess) {
            learnersList = lRes.getOrNull() ?: emptyList()
            if (learnersList.isNotEmpty()) selectedLearnerId = learnersList.first().id
        }
    }

    Scaffold(
        topBar = {
            SchoolCrestHeader(title = "CBC Academics & Results", subtitle = "Competency-Based Evaluation")
        },
        floatingActionButton = {
            if (role == UserRole.TEACHER || role == UserRole.HEAD_TEACHER || role == UserRole.DIRECTOR) {
                ExtendedFloatingActionButton(
                    onClick = { showRecordDialog = true },
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("Record Mark") },
                    containerColor = RoyalBlue,
                    contentColor = Color.White,
                    modifier = Modifier.testTag("record_mark_fab")
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("academics_screen")
        ) {
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Assessments") })
                Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Exams") })
                Tab(selected = selectedTab == 2, onClick = { selectedTab = 2 }, text = { Text("Rubrics") })
            }

            when (selectedTab) {
                0 -> {
                    when (val current = state) {
                        is UiState.Loading -> LoadingSkeleton(count = 5)
                        is UiState.Empty -> EmptyStateView(
                            title = "No Assessment Records",
                            message = "No learner assessment entries found for this term.",
                            actionLabel = if (role == UserRole.TEACHER) "Record First Mark" else null,
                            onAction = { showRecordDialog = true }
                        )
                        is UiState.Error -> ErrorStateView(
                            message = current.message,
                            onRetry = { loadAssessments() }
                        )
                        is UiState.Success -> {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(16.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                items(current.data, key = { it.id }) { assessment ->
                                    Card(
                                        modifier = Modifier.fillMaxWidth().testTag("assessment_item_${assessment.id}"),
                                        shape = RoundedCornerShape(14.dp),
                                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                                    ) {
                                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Column(modifier = Modifier.weight(1f)) {
                                                    Text(
                                                        text = assessment.learner?.name ?: "Learner",
                                                        style = MaterialTheme.typography.titleMedium.copy(
                                                            fontWeight = FontWeight.Bold,
                                                            color = RoyalBlue
                                                        )
                                                    )
                                                    Text(
                                                        text = "${assessment.learner?.grade ?: ""} • ${assessment.subject}",
                                                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium)
                                                    )
                                                }

                                                Column(horizontalAlignment = Alignment.End) {
                                                    Text(
                                                        text = "${assessment.score.toInt()}%",
                                                        style = MaterialTheme.typography.titleLarge.copy(
                                                            fontWeight = FontWeight.Bold,
                                                            color = if (assessment.score >= 60) Color(0xFF059669) else Color(0xFFDC2626)
                                                        )
                                                    )
                                                    CbcLevelBadge(level = assessment.level)
                                                }
                                            }

                                            if (!assessment.strand.isNullOrBlank()) {
                                                Text(
                                                    text = "Strand: ${assessment.strand}",
                                                    style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                                                )
                                            }

                                            if (!assessment.comment.isNullOrBlank()) {
                                                Text(
                                                    text = "“${assessment.comment}”",
                                                    style = MaterialTheme.typography.bodySmall.copy(
                                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                        fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                                                    )
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
                1 -> {
                    // Exams list view
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text("Term 1 CBC Summative Evaluation", fontWeight = FontWeight.Bold, color = RoyalBlue)
                                    Text("Status: Active • Grade 1 through Grade 9", style = MaterialTheme.typography.bodySmall)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text("Assessment papers: Kenya National Examinations Council (KNEC) CBC Guidelines.", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }
                }
                2 -> {
                    // CBC Rubrics view
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        val rubrics = listOf(
                            Triple("Exceeding Expectations (EE)", "80% - 100%", "Consistently demonstrates comprehensive mastery and deep competency application."),
                            Triple("Meeting Expectations (ME)", "60% - 79%", "Demonstrates proficient mastery of core competencies and standards."),
                            Triple("Approaching Expectations (AE)", "40% - 59%", "Demonstrates foundational competency with intermittent guidance required."),
                            Triple("Below Expectations (BE)", "0% - 39%", "Requires focused remedial intervention and weak-topic video revision.")
                        )
                        items(rubrics) { (title, range, desc) ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(title, fontWeight = FontWeight.Bold, color = RoyalBlue)
                                        Surface(color = RoyalGold.copy(alpha = 0.2f), shape = RoundedCornerShape(4.dp)) {
                                            Text(range, fontWeight = FontWeight.Bold, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(desc, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Record Mark Dialog
        if (showRecordDialog) {
            AlertDialog(
                onDismissRequest = { showRecordDialog = false },
                title = { Text("Record CBC Assessment") },
                text = {
                    Column(
                        modifier = Modifier.verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (dialogError != null) {
                            Text(dialogError ?: "", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                        }

                        // Learner dropdown
                        if (learnersList.isNotEmpty()) {
                            Text("Select Learner:", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Bold)
                            learnersList.take(5).forEach { l ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { selectedLearnerId = l.id }
                                        .padding(vertical = 4.dp)
                                ) {
                                    RadioButton(selected = selectedLearnerId == l.id, onClick = { selectedLearnerId = l.id })
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("${l.name} (${l.admissionNo})", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }

                        OutlinedTextField(
                            value = subject,
                            onValueChange = { subject = it },
                            label = { Text("Subject (e.g. Mathematics, English)") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedTextField(
                            value = scoreInput,
                            onValueChange = { scoreInput = it },
                            label = { Text("Score (0 - 100)") },
                            modifier = Modifier.fillMaxWidth().testTag("mark_score_input")
                        )

                        OutlinedTextField(
                            value = strand,
                            onValueChange = { strand = it },
                            label = { Text("Strand / Topic") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedTextField(
                            value = comment,
                            onValueChange = { comment = it },
                            label = { Text("Teacher's Constructive Comment") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val scoreVal = scoreInput.toDoubleOrNull()
                            if (scoreVal == null || scoreVal < 0 || scoreVal > 100) {
                                dialogError = "Enter a valid score between 0 and 100."
                                return@Button
                            }
                            if (selectedLearnerId.isBlank()) {
                                dialogError = "Please select a learner."
                                return@Button
                            }
                            isSavingMark = true
                            dialogError = null
                            coroutineScope.launch {
                                val req = CreateAssessmentRequest(
                                    learnerId = selectedLearnerId,
                                    subject = subject,
                                    score = scoreVal,
                                    term = term,
                                    strand = strand.ifBlank { null },
                                    comment = comment.ifBlank { null }
                                )
                                val res = repo.createAssessment(req)
                                isSavingMark = false
                                res.fold(
                                    onSuccess = {
                                        showRecordDialog = false
                                        loadAssessments()
                                    },
                                    onFailure = { dialogError = it.message }
                                )
                            }
                        },
                        enabled = !isSavingMark,
                        colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                        modifier = Modifier.testTag("submit_mark_button")
                    ) {
                        Text("Save Mark")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showRecordDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
