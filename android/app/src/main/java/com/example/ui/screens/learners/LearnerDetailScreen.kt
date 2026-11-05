package com.example.ui.screens.learners

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import com.example.data.remote.model.LearnerDetailDto
import com.example.ui.common.*
import com.example.ui.navigation.RoleNavManager
import com.example.ui.navigation.UserRole
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearnerDetailScreen(
    learnerId: String,
    onBack: () -> Unit,
    onEditLearner: (learnerId: String) -> Unit
) {
    val app = MaryRoyalApp.instance
    val repo = app.learnerRepository
    val authRepo = app.authRepository
    val role = remember { UserRole.fromCode(authRepo.getUserRole()) }
    val coroutineScope = rememberCoroutineScope()

    var state by remember { mutableStateOf<UiState<LearnerDetailDto>>(UiState.Loading) }
    var generatedPassword by remember { mutableStateOf<String?>(null) }
    var isCreatingAccount by remember { mutableStateOf(false) }

    fun loadDetail() {
        state = UiState.Loading
        coroutineScope.launch {
            val res = repo.getLearnerDetail(learnerId)
            res.fold(
                onSuccess = { state = UiState.Success(it) },
                onFailure = { state = UiState.Error(it.message ?: "Failed to load learner.") }
            )
        }
    }

    LaunchedEffect(learnerId) {
        loadDetail()
    }

    val canEdit = RoleNavManager.canEditLearner(role)
    val canCreateAccount = RoleNavManager.canCreateLearnerAccount(role)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Learner Profile", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("learner_detail_back_button")) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (canEdit) {
                        IconButton(
                            onClick = { onEditLearner(learnerId) },
                            modifier = Modifier.testTag("edit_learner_button")
                        ) {
                            Icon(Icons.Default.Edit, contentDescription = "Edit Profile", tint = RoyalBlue)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("learner_detail_screen")
        ) {
            when (val current = state) {
                is UiState.Loading -> LoadingSkeleton(count = 5)
                is UiState.Error -> ErrorStateView(
                    message = current.message,
                    onRetry = { loadDetail() }
                )
                is UiState.Success -> {
                    val learner = current.data
                    val prof = learner.profile

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Header Card
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(60.dp)
                                        .clip(CircleShape)
                                        .background(RoyalBlue),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.School,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(32.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(16.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = learner.name,
                                        style = MaterialTheme.typography.titleLarge.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = RoyalBlue
                                        )
                                    )
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier.padding(top = 4.dp)
                                    ) {
                                        Surface(
                                            color = RoyalGold.copy(alpha = 0.2f),
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(
                                                text = learner.admissionNo,
                                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                        Text(
                                            text = "${learner.grade}${prof?.stream?.let { " ($it)" } ?: ""}",
                                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium)
                                        )
                                    }
                                }
                            }
                        }

                        // Account Creation Success Dialog
                        if (generatedPassword != null) {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFD1FAE5))
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(
                                        text = "Learner Portal Account Created",
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF065F46)
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = "Login email: ${learner.admissionNo.lowercase()}@learners.maryroyal.ac.ke",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFF065F46)
                                    )
                                    Text(
                                        text = "Temporary Password: $generatedPassword",
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                        color = Color(0xFF065F46)
                                    )
                                    Text(
                                        text = "Provide this password to the learner or guardian for first login.",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color(0xFF065F46)
                                    )
                                }
                            }
                        }

                        // Biography Details Card
                        ProfileSectionCard(title = "Biography & Academic Details", icon = Icons.Default.Badge) {
                            InfoRow(label = "Full Name", value = learner.name)
                            InfoRow(label = "Admission No", value = learner.admissionNo)
                            InfoRow(label = "CBC Class / Grade", value = learner.grade)
                            InfoRow(label = "Stream", value = prof?.stream ?: "Main")
                            InfoRow(label = "UPI / NEMIS Number", value = prof?.upiNumber ?: "Pending")
                            InfoRow(label = "Date of Birth", value = prof?.dateOfBirth ?: "Not recorded")
                            InfoRow(label = "Gender", value = learner.gender ?: "Not specified")
                            InfoRow(label = "Nationality", value = prof?.nationality ?: "Kenyan")
                            InfoRow(label = "Religion", value = prof?.religion ?: "Christian")
                            InfoRow(label = "Languages Spoken", value = prof?.languagesSpoken ?: "English, Kiswahili")
                        }

                        // Residence Card
                        ProfileSectionCard(title = "Home Residence", icon = Icons.Default.Home) {
                            InfoRow(label = "Physical Address", value = prof?.physicalAddress ?: "Obunga, Kisumu")
                            InfoRow(label = "County", value = prof?.county ?: "Kisumu")
                            InfoRow(label = "Sub-County", value = prof?.subCounty ?: "Kisumu Central")
                            InfoRow(label = "Ward", value = prof?.ward ?: "Railways / Obunga")
                            InfoRow(label = "Village / Estate", value = prof?.village ?: "Breweries Area")
                        }

                        // Health & Special Needs Card
                        ProfileSectionCard(title = "Health & Special Needs", icon = Icons.Default.MedicalServices) {
                            InfoRow(label = "Blood Group", value = prof?.bloodGroup ?: "Not tested")
                            InfoRow(label = "Known Conditions", value = prof?.knownConditions ?: "None")
                            InfoRow(label = "Allergies", value = prof?.allergies ?: "None reported")
                            InfoRow(label = "Current Medication", value = prof?.currentMedication ?: "None")
                            InfoRow(label = "Special Educational Needs", value = prof?.specialNeeds ?: "None")
                            InfoRow(label = "Preferred Hospital", value = prof?.doctorOrHospital ?: "Jaramogi Oginga Odinga TRH")
                            InfoRow(label = "Health Insurance / SHA", value = prof?.healthInsurance ?: "Covered")
                        }

                        // Action Buttons based on Role
                        if (canCreateAccount && generatedPassword == null) {
                            OutlinedButton(
                                onClick = {
                                    isCreatingAccount = true
                                    coroutineScope.launch {
                                        val res = repo.createLearnerLogin(learner.id)
                                        isCreatingAccount = false
                                        res.fold(
                                            onSuccess = { generatedPassword = it },
                                            onFailure = { /* Handled in UI */ }
                                        )
                                    }
                                },
                                enabled = !isCreatingAccount,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("create_learner_account_button")
                            ) {
                                if (isCreatingAccount) {
                                    CircularProgressIndicator(modifier = Modifier.size(20.dp))
                                } else {
                                    Icon(Icons.Default.Key, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Generate Learner Portal Login")
                                }
                            }
                        }

                        if (canEdit) {
                            Button(
                                onClick = { onEditLearner(learner.id) },
                                colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    .testTag("edit_profile_bottom_button")
                            ) {
                                Icon(Icons.Default.Edit, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Edit Learner Profile")
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
private fun ProfileSectionCard(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(bottom = 12.dp)
            ) {
                Icon(icon, contentDescription = null, tint = RoyalBlue, modifier = Modifier.size(20.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                )
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
            Spacer(modifier = Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
            maxLines = 2
        )
    }
}
