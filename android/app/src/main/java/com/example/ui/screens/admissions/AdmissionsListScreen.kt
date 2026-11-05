package com.example.ui.screens.admissions

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import com.example.data.remote.model.AdmissionDraftDto
import com.example.ui.common.*
import com.example.ui.navigation.RoleNavManager
import com.example.ui.navigation.UserRole
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdmissionsListScreen(
    onBack: () -> Unit,
    onNewAdmission: () -> Unit,
    onViewAdmission: (id: String) -> Unit
) {
    val repo = MaryRoyalApp.instance.admissionRepository
    val authRepo = MaryRoyalApp.instance.authRepository
    val role = remember { UserRole.fromCode(authRepo.getUserRole()) }
    val coroutineScope = rememberCoroutineScope()

    var state by remember { mutableStateOf<UiState<List<AdmissionDraftDto>>>(UiState.Loading) }
    var selectedStatus by remember { mutableStateOf("ALL") }

    fun loadAdmissions() {
        state = UiState.Loading
        coroutineScope.launch {
            val statusParam = if (selectedStatus == "ALL") null else selectedStatus
            val res = repo.getAdmissions(status = statusParam)
            res.fold(
                onSuccess = { list ->
                    if (list.isEmpty()) state = UiState.Empty
                    else state = UiState.Success(list)
                },
                onFailure = { state = UiState.Error(it.message ?: "Failed to load admissions.") }
            )
        }
    }

    LaunchedEffect(selectedStatus) {
        loadAdmissions()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Admissions Office", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        floatingActionButton = {
            if (RoleNavManager.canHandleAdmissions(role)) {
                ExtendedFloatingActionButton(
                    onClick = onNewAdmission,
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("Start Admission") },
                    containerColor = RoyalBlue,
                    contentColor = Color.White,
                    modifier = Modifier.testTag("start_admission_fab")
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("admissions_list_screen")
        ) {
            val statuses = listOf("ALL", "DRAFT", "SUBMITTED", "ENROLLED")
            ScrollableTabRow(
                selectedTabIndex = statuses.indexOf(selectedStatus).coerceAtLeast(0),
                edgePadding = 16.dp,
                divider = {}
            ) {
                statuses.forEach { s ->
                    Tab(
                        selected = selectedStatus == s,
                        onClick = { selectedStatus = s },
                        text = {
                            Text(
                                text = s,
                                fontWeight = if (selectedStatus == s) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    )
                }
            }

            when (val current = state) {
                is UiState.Loading -> LoadingSkeleton(count = 4)
                is UiState.Empty -> EmptyStateView(
                    title = "No Admission Records",
                    message = "No admissions found under $selectedStatus status.",
                    actionLabel = if (RoleNavManager.canHandleAdmissions(role)) "Start Admission" else null,
                    onAction = onNewAdmission
                )
                is UiState.Error -> ErrorStateView(
                    message = current.message,
                    onRetry = { loadAdmissions() }
                )
                is UiState.Success -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(current.data, key = { it.id }) { draft ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onViewAdmission(draft.id) }
                                    .testTag("admission_item_${draft.admissionNo.lowercase()}"),
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
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = draft.learner?.name ?: "Pending Applicant",
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontWeight = FontWeight.Bold,
                                                color = RoyalBlue
                                            )
                                        )
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            modifier = Modifier.padding(top = 2.dp)
                                        ) {
                                            Text(
                                                text = draft.admissionNo,
                                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold)
                                            )
                                            Text(
                                                text = "• Step ${draft.currentStep} of 7",
                                                style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                                            )
                                            if (draft.documents.isNotEmpty()) {
                                                Text(
                                                    text = "• ${draft.documents.size} Docs",
                                                    style = MaterialTheme.typography.labelSmall.copy(color = RoyalGold)
                                                )
                                            }
                                        }
                                    }

                                    val statusColor = when (draft.status) {
                                        "ENROLLED" -> Color(0xFF059669)
                                        "SUBMITTED" -> Color(0xFF0284C7)
                                        else -> Color(0xFFD97706)
                                    }
                                    Surface(
                                        color = statusColor.copy(alpha = 0.15f),
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            text = draft.status,
                                            color = statusColor,
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 10.sp
                                            ),
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
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
