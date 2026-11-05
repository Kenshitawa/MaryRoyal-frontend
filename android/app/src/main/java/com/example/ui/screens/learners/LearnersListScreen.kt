package com.example.ui.screens.learners

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
import com.example.MaryRoyalApp
import com.example.data.remote.model.LearnerDto
import com.example.ui.common.*
import com.example.ui.navigation.RoleNavManager
import com.example.ui.navigation.UserRole
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearnersListScreen(
    onLearnerSelected: (learnerId: String) -> Unit,
    onNewAdmission: () -> Unit
) {
    val app = MaryRoyalApp.instance
    val repo = app.learnerRepository
    val authRepo = app.authRepository
    val role = remember { UserRole.fromCode(authRepo.getUserRole()) }
    val coroutineScope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("") }
    var selectedGrade by remember { mutableStateOf("All") }
    var state by remember { mutableStateOf<UiState<List<LearnerDto>>>(UiState.Loading) }
    var isOffline by remember { mutableStateOf(false) }

    fun loadLearners() {
        state = UiState.Loading
        coroutineScope.launch {
            val res = repo.fetchLearners(searchQuery.ifBlank { null })
            res.fold(
                onSuccess = { list ->
                    isOffline = false
                    if (list.isEmpty()) state = UiState.Empty
                    else state = UiState.Success(list)
                },
                onFailure = { err ->
                    isOffline = true
                    // Try room cache
                    repo.cachedLearners.collect { cached ->
                        if (cached.isNotEmpty()) {
                            state = UiState.Success(cached)
                        } else {
                            state = UiState.Error(err.message ?: "Failed to load learners.")
                        }
                    }
                }
            )
        }
    }

    LaunchedEffect(searchQuery) {
        loadLearners()
    }

    Scaffold(
        topBar = {
            SchoolCrestHeader(title = "Learners Register", subtitle = "Mary Royal CBC Enrollment")
        },
        floatingActionButton = {
            if (RoleNavManager.canHandleAdmissions(role)) {
                ExtendedFloatingActionButton(
                    onClick = onNewAdmission,
                    icon = { Icon(Icons.Default.PersonAdd, contentDescription = null) },
                    text = { Text("New Admission") },
                    containerColor = RoyalBlue,
                    contentColor = Color.White,
                    modifier = Modifier.testTag("new_admission_fab")
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("learners_list_screen")
        ) {
            if (isOffline) {
                OfflineBanner()
            }

            // Search Bar & Filter
            Surface(
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 2.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = { Text("Search by name, admission no, or class...") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Clear")
                                }
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().testTag("learner_search_input")
                    )

                    // Grade Filter Chips
                    val grades = listOf("All", "PP1", "PP2", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9")
                    ScrollableTabRow(
                        selectedTabIndex = grades.indexOf(selectedGrade).coerceAtLeast(0),
                        edgePadding = 0.dp,
                        divider = {},
                        containerColor = Color.Transparent
                    ) {
                        grades.forEach { grade ->
                            Tab(
                                selected = selectedGrade == grade,
                                onClick = { selectedGrade = grade },
                                text = {
                                    Text(
                                        grade,
                                        fontWeight = if (selectedGrade == grade) FontWeight.Bold else FontWeight.Normal,
                                        fontSize = 12.sp
                                    )
                                }
                            )
                        }
                    }
                }
            }

            when (val current = state) {
                is UiState.Loading -> LoadingSkeleton(count = 5)
                is UiState.Empty -> EmptyStateView(
                    title = "No Learners Found",
                    message = "No enrolled learners match your search criteria.",
                    actionLabel = if (RoleNavManager.canHandleAdmissions(role)) "Start New Admission" else null,
                    onAction = onNewAdmission
                )
                is UiState.Error -> ErrorStateView(
                    message = current.message,
                    onRetry = { loadLearners() }
                )
                is UiState.Success -> {
                    val filtered = current.data.filter {
                        selectedGrade == "All" || it.grade.equals(selectedGrade, ignoreCase = true)
                    }

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        item {
                            Text(
                                text = "${filtered.size} Learners Displayed",
                                style = MaterialTheme.typography.labelSmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                            )
                        }

                        items(filtered, key = { it.id }) { learner ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onLearnerSelected(learner.id) }
                                    .testTag("learner_item_${learner.admissionNo.lowercase()}"),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(46.dp)
                                            .clip(CircleShape)
                                            .background(RoyalBlue.copy(alpha = 0.12f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.School,
                                            contentDescription = null,
                                            tint = RoyalBlue
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(14.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Text(
                                                text = learner.name,
                                                style = MaterialTheme.typography.titleMedium.copy(
                                                    fontWeight = FontWeight.Bold,
                                                    color = RoyalBlue
                                                ),
                                                maxLines = 1
                                            )
                                        }

                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            modifier = Modifier.padding(top = 2.dp)
                                        ) {
                                            Surface(
                                                color = MaterialTheme.colorScheme.surfaceVariant,
                                                shape = RoundedCornerShape(4.dp)
                                            ) {
                                                Text(
                                                    text = learner.admissionNo,
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        fontWeight = FontWeight.SemiBold
                                                    ),
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }

                                            Text(
                                                text = "• ${learner.grade}",
                                                style = MaterialTheme.typography.bodySmall.copy(
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            )

                                            if (learner.gender != null) {
                                                Text(
                                                    text = "• ${learner.gender}",
                                                    style = MaterialTheme.typography.bodySmall.copy(
                                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                                    )
                                                )
                                            }
                                        }
                                    }

                                    Column(horizontalAlignment = Alignment.End) {
                                        Surface(
                                            color = if (learner.admissionStatus == "APPROVED") Color(0xFFD1FAE5) else Color(0xFFFEF3C7),
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = learner.admissionStatus ?: "APPROVED",
                                                color = if (learner.admissionStatus == "APPROVED") Color(0xFF065F46) else Color(0xFF92400E),
                                                style = MaterialTheme.typography.labelSmall.copy(
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 10.sp
                                                ),
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }

                                        if (learner.hasLearnerLogin) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                modifier = Modifier.padding(top = 4.dp)
                                            ) {
                                                Icon(
                                                    Icons.Default.CheckCircle,
                                                    contentDescription = "Login active",
                                                    tint = Color(0xFF059669),
                                                    modifier = Modifier.size(14.dp)
                                                )
                                                Spacer(modifier = Modifier.width(3.dp))
                                                Text(
                                                    text = "Portal User",
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        fontSize = 10.sp,
                                                        color = Color(0xFF059669)
                                                    )
                                                )
                                            }
                                        }
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
