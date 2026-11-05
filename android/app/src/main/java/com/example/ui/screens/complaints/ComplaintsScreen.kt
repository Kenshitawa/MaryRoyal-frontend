package com.example.ui.screens.complaints

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
import com.example.data.remote.model.ComplaintDto
import com.example.ui.common.*
import com.example.ui.navigation.RoleNavManager
import com.example.ui.navigation.UserRole
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ComplaintsScreen() {
    val app = MaryRoyalApp.instance
    val repo = app.complaintRepository
    val learnerRepo = app.learnerRepository
    val authRepo = app.authRepository
    val role = remember { UserRole.fromCode(authRepo.getUserRole()) }
    val coroutineScope = rememberCoroutineScope()

    var state by remember { mutableStateOf<UiState<List<ComplaintDto>>>(UiState.Loading) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var selectedComplaint by remember { mutableStateOf<ComplaintDto?>(null) }

    // Dialog state
    var subject by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("ACADEMIC") }
    var message by remember { mutableStateOf("") }
    var recipientRole by remember { mutableStateOf("HEAD_TEACHER") } // "HEAD_TEACHER", "DIRECTOR", "BOTH"
    var learnerId by remember { mutableStateOf("") }
    var learnersList by remember { mutableStateOf<List<com.example.data.remote.model.LearnerDto>>(emptyList()) }
    var isSubmitting by remember { mutableStateOf(false) }
    var formError by remember { mutableStateOf<String?>(null) }

    // Reply state
    var replyText by remember { mutableStateOf("") }
    var isSendingReply by remember { mutableStateOf(false) }

    fun loadComplaints() {
        state = UiState.Loading
        coroutineScope.launch {
            val res = repo.getComplaints()
            res.fold(
                onSuccess = { list ->
                    if (list.isEmpty()) state = UiState.Empty
                    else state = UiState.Success(list)
                },
                onFailure = { state = UiState.Error(it.message ?: "Failed to load complaints.") }
            )
        }
    }

    LaunchedEffect(Unit) {
        loadComplaints()
        if (role == UserRole.PARENT) {
            val lRes = learnerRepo.fetchLearners()
            if (lRes.isSuccess) {
                learnersList = lRes.getOrNull() ?: emptyList()
                if (learnersList.isNotEmpty()) learnerId = learnersList.first().id
            }
        }
    }

    Scaffold(
        topBar = {
            SchoolCrestHeader(
                title = "Complaints & Inquiries",
                subtitle = "Confidential Channel to School Leadership"
            )
        },
        floatingActionButton = {
            if (role == UserRole.PARENT) {
                ExtendedFloatingActionButton(
                    onClick = { showCreateDialog = true },
                    icon = { Icon(Icons.Default.Add, contentDescription = null) },
                    text = { Text("New Inquiry / Complaint") },
                    containerColor = RoyalBlue,
                    contentColor = Color.White,
                    modifier = Modifier.testTag("new_complaint_fab")
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("complaints_screen")
        ) {
            // Notice: Complaints go only between Parent and Head Teacher / Director
            Surface(
                color = RoyalGold.copy(alpha = 0.1f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Security, contentDescription = null, tint = RoyalBlue, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Encrypted Line: Accessible exclusively to Parents, Head Teacher, and Director.",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium)
                    )
                }
            }

            when (val current = state) {
                is UiState.Loading -> LoadingSkeleton(count = 4)
                is UiState.Empty -> EmptyStateView(
                    title = "No Complaints Logged",
                    message = "No active inquiries or complaints found.",
                    actionLabel = if (role == UserRole.PARENT) "Open Inquiry" else null,
                    onAction = { showCreateDialog = true }
                )
                is UiState.Error -> ErrorStateView(message = current.message, onRetry = { loadComplaints() })
                is UiState.Success -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(current.data, key = { it.id }) { complaint ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedComplaint = complaint }
                                    .testTag("complaint_card_${complaint.id}"),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                            ) {
                                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = complaint.subject,
                                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = RoyalBlue),
                                            modifier = Modifier.weight(1f)
                                        )
                                        Surface(
                                            color = when (complaint.status) {
                                                "RESOLVED" -> Color(0xFFD1FAE5)
                                                "IN_PROGRESS" -> Color(0xFFDBEAFE)
                                                else -> Color(0xFFFEF3C7)
                                            },
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = complaint.status,
                                                color = when (complaint.status) {
                                                    "RESOLVED" -> Color(0xFF065F46)
                                                    "IN_PROGRESS" -> Color(0xFF1E40AF)
                                                    else -> Color(0xFF92400E)
                                                },
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 10.sp,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    Text(
                                        text = complaint.message,
                                        style = MaterialTheme.typography.bodyMedium,
                                        maxLines = 3
                                    )

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = "Category: ${complaint.category} • ${complaint.replies.size} replies",
                                            style = MaterialTheme.typography.labelSmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        )
                                        Text(
                                            text = "Tap to view conversation",
                                            style = MaterialTheme.typography.labelSmall.copy(color = RoyalBlue, fontWeight = FontWeight.Bold)
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

        // New Complaint Dialog (Parent only)
        if (showCreateDialog) {
            AlertDialog(
                onDismissRequest = { showCreateDialog = false },
                title = { Text("Submit Parent Inquiry / Complaint") },
                text = {
                    Column(
                        modifier = Modifier.verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (formError != null) {
                            Text(formError ?: "", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                        }

                        // Select Learner
                        if (learnersList.isNotEmpty()) {
                            Text("Related Learner:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                            learnersList.forEach { l ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.fillMaxWidth().clickable { learnerId = l.id }
                                ) {
                                    RadioButton(selected = learnerId == l.id, onClick = { learnerId = l.id })
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("${l.name} (${l.admissionNo})", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }

                        OutlinedTextField(
                            value = subject,
                            onValueChange = { subject = it; formError = null },
                            label = { Text("Subject") },
                            placeholder = { Text("e.g. CBC Term Report Query") },
                            modifier = Modifier.fillMaxWidth().testTag("complaint_subject_input")
                        )

                        // Category
                        Text("Category:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("ACADEMIC", "FEES", "SAFETY", "WELLBEING").forEach { cat ->
                                FilterChip(
                                    selected = category == cat,
                                    onClick = { category = cat },
                                    label = { Text(cat, fontSize = 11.sp) }
                                )
                            }
                        }

                        // Recipient Role
                        Text("Send To:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("HEAD_TEACHER" to "Head Teacher", "DIRECTOR" to "Director", "BOTH" to "Both").forEach { (code, label) ->
                                FilterChip(
                                    selected = recipientRole == code,
                                    onClick = { recipientRole = code },
                                    label = { Text(label, fontSize = 11.sp) }
                                )
                            }
                        }

                        OutlinedTextField(
                            value = message,
                            onValueChange = { message = it; formError = null },
                            label = { Text("Message / Description") },
                            minLines = 3,
                            modifier = Modifier.fillMaxWidth().testTag("complaint_message_input")
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (subject.isBlank() || message.isBlank()) {
                                formError = "Please enter subject and message."
                                return@Button
                            }
                            if (learnerId.isBlank()) {
                                formError = "Please link this inquiry to a child."
                                return@Button
                            }
                            isSubmitting = true
                            formError = null
                            coroutineScope.launch {
                                val res = repo.createComplaint(
                                    subject = subject,
                                    category = category,
                                    message = message,
                                    recipientRole = recipientRole,
                                    learnerId = learnerId
                                )
                                isSubmitting = false
                                res.fold(
                                    onSuccess = {
                                        showCreateDialog = false
                                        subject = ""
                                        message = ""
                                        loadComplaints()
                                    },
                                    onFailure = { formError = it.message }
                                )
                            }
                        },
                        enabled = !isSubmitting,
                        colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                        modifier = Modifier.testTag("submit_complaint_button")
                    ) {
                        Text("Submit")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showCreateDialog = false }) { Text("Cancel") }
                }
            )
        }

        // Thread Conversation Modal Bottom Sheet
        if (selectedComplaint != null) {
            val complaint = selectedComplaint!!
            ModalBottomSheet(
                onDismissRequest = { selectedComplaint = null }
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 12.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(complaint.subject, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = RoyalBlue)
                    Text("Category: ${complaint.category} • Status: ${complaint.status}", style = MaterialTheme.typography.bodySmall)
                    HorizontalDivider()

                    // Original Complaint Message
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = "${complaint.openedBy?.name ?: "Parent"} (${complaint.openedBy?.role ?: "PARENT"}):",
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.bodySmall
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(complaint.message, style = MaterialTheme.typography.bodyMedium)
                        }
                    }

                    // Replies Thread
                    Text("Replies & Follow-ups:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                    if (complaint.replies.isEmpty()) {
                        Text("No replies yet. School leadership will review shortly.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } else {
                        complaint.replies.forEach { reply ->
                            Surface(
                                color = if (reply.author.role == "PARENT") MaterialTheme.colorScheme.surfaceVariant else RoyalBlue.copy(alpha = 0.08f),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        text = "${reply.author.name} (${reply.author.role}):",
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (reply.author.role != "PARENT") RoyalBlue else Color.Unspecified
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(reply.message, style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                    }

                    // Reply Input
                    OutlinedTextField(
                        value = replyText,
                        onValueChange = { replyText = it },
                        placeholder = { Text("Write a reply...") },
                        modifier = Modifier.fillMaxWidth().testTag("reply_input")
                    )

                    Button(
                        onClick = {
                            if (replyText.isNotBlank()) {
                                isSendingReply = true
                                coroutineScope.launch {
                                    repo.addReply(complaint.id, replyText)
                                    isSendingReply = false
                                    replyText = ""
                                    loadComplaints()
                                    selectedComplaint = null
                                }
                            }
                        },
                        enabled = !isSendingReply && replyText.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                        modifier = Modifier.fillMaxWidth().testTag("send_reply_button")
                    ) {
                        Text("Send Reply")
                    }
                }
            }
        }
    }
}
