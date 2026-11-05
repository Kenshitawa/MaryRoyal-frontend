package com.example.ui.screens.accounts

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.MaryRoyalApp
import com.example.data.remote.model.AccountDto
import com.example.data.remote.model.CreateAccountRequest
import com.example.ui.common.*
import com.example.ui.theme.RoyalBlue
import com.example.ui.theme.RoyalGold
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountsScreen() {
    val repo = MaryRoyalApp.instance.accountRepository
    val coroutineScope = rememberCoroutineScope()

    var state by remember { mutableStateOf<UiState<List<AccountDto>>>(UiState.Loading) }
    var showCreateDialog by remember { mutableStateOf(false) }

    // Create Account Form
    var newName by remember { mutableStateOf("") }
    var newEmail by remember { mutableStateOf("") }
    var newRole by remember { mutableStateOf("TEACHER") }
    var staffNo by remember { mutableStateOf("") }
    var tscNo by remember { mutableStateOf("") }
    var isCreating by remember { mutableStateOf(false) }
    var createdResultPassword by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun loadAccounts() {
        state = UiState.Loading
        coroutineScope.launch {
            val res = repo.getAccounts()
            res.fold(
                onSuccess = { list ->
                    if (list.isEmpty()) state = UiState.Empty
                    else state = UiState.Success(list)
                },
                onFailure = { state = UiState.Error(it.message ?: "Failed to load accounts.") }
            )
        }
    }

    LaunchedEffect(Unit) {
        loadAccounts()
    }

    Scaffold(
        topBar = {
            SchoolCrestHeader(title = "User Account Management", subtitle = "Director Security Administration")
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showCreateDialog = true },
                icon = { Icon(Icons.Default.PersonAdd, contentDescription = null) },
                text = { Text("Create User Account") },
                containerColor = RoyalBlue,
                contentColor = Color.White,
                modifier = Modifier.testTag("create_account_fab")
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .testTag("accounts_screen")
        ) {
            if (createdResultPassword != null) {
                Surface(
                    color = Color(0xFFD1FAE5),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth().padding(16.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF065F46))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Account Provisioned Successfully", fontWeight = FontWeight.Bold, color = Color(0xFF065F46))
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Temporary Password: $createdResultPassword",
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF065F46),
                            fontSize = 14.sp
                        )
                        Text(
                            text = "Share this password securely with the user. They will be forced to change it upon first login.",
                            style = MaterialTheme.typography.labelSmall,
                            color = Color(0xFF065F46)
                        )
                    }
                }
            }

            when (val current = state) {
                is UiState.Loading -> LoadingSkeleton(count = 5)
                is UiState.Empty -> EmptyStateView(
                    title = "No Accounts Found",
                    message = "Tap the button below to provision a new staff, parent, or learner account.",
                    actionLabel = "Create Account",
                    onAction = { showCreateDialog = true }
                )
                is UiState.Error -> ErrorStateView(message = current.message, onRetry = { loadAccounts() })
                is UiState.Success -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(current.data, key = { it.id }) { acc ->
                            Card(
                                modifier = Modifier.fillMaxWidth().testTag("account_card_${acc.id}"),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                            ) {
                                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(acc.name, fontWeight = FontWeight.Bold, color = RoyalBlue)
                                            Text(acc.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }

                                        Surface(
                                            color = RoyalBlue.copy(alpha = 0.12f),
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = acc.role,
                                                fontWeight = FontWeight.Bold,
                                                color = RoyalBlue,
                                                fontSize = 10.sp,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            if (acc.suspended) {
                                                Surface(color = Color(0xFFFEE2E2), shape = RoundedCornerShape(4.dp)) {
                                                    Text("SUSPENDED", color = Color(0xFF991B1B), fontWeight = FontWeight.Bold, fontSize = 9.sp, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp))
                                                }
                                            }
                                            if (acc.failedLogins > 0) {
                                                Surface(color = Color(0xFFFEF3C7), shape = RoundedCornerShape(4.dp)) {
                                                    Text("${acc.failedLogins} failed logins", color = Color(0xFF92400E), fontSize = 9.sp, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp))
                                                }
                                            }
                                        }

                                        // Action buttons: Suspend / Unlock / Reset
                                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            if (acc.failedLogins > 0) {
                                                TextButton(onClick = {
                                                    coroutineScope.launch {
                                                        repo.patchAccount(acc.id, "unlock")
                                                        loadAccounts()
                                                    }
                                                }) {
                                                    Text("Unlock", fontSize = 11.sp)
                                                }
                                            }

                                            TextButton(onClick = {
                                                coroutineScope.launch {
                                                    val action = if (acc.suspended) "reactivate" else "suspend"
                                                    repo.patchAccount(acc.id, action)
                                                    loadAccounts()
                                                }
                                            }) {
                                                Text(if (acc.suspended) "Reactivate" else "Suspend", fontSize = 11.sp, color = if (acc.suspended) Color(0xFF059669) else Color(0xFFDC2626))
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

        // Create Account Dialog
        if (showCreateDialog) {
            AlertDialog(
                onDismissRequest = { showCreateDialog = false },
                title = { Text("Provision New User Account") },
                text = {
                    Column(
                        modifier = Modifier.verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (errorMessage != null) {
                            Text(errorMessage ?: "", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                        }

                        OutlinedTextField(
                            value = newName,
                            onValueChange = { newName = it; errorMessage = null },
                            label = { Text("Full Name") },
                            modifier = Modifier.fillMaxWidth().testTag("account_name_input")
                        )

                        OutlinedTextField(
                            value = newEmail,
                            onValueChange = { newEmail = it; errorMessage = null },
                            label = { Text("Official Email") },
                            placeholder = { Text("name@maryroyal.ac.ke") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            modifier = Modifier.fillMaxWidth().testTag("account_email_input")
                        )

                        // Role Selector
                        Text("System Role:", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                        val roles = listOf("HEAD_TEACHER", "DEPUTY", "ACCOUNTANT", "SECRETARY", "TEACHER", "PARENT", "LEARNER")
                        Column {
                            roles.forEach { r ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    RadioButton(selected = newRole == r, onClick = { newRole = r })
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(r.replace("_", " "), style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }

                        if (newRole == "TEACHER" || newRole == "HEAD_TEACHER" || newRole == "DEPUTY") {
                            OutlinedTextField(
                                value = staffNo,
                                onValueChange = { staffNo = it },
                                label = { Text("Staff Number (Optional)") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = tscNo,
                                onValueChange = { tscNo = it },
                                label = { Text("TSC Number (Optional)") },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (newName.isBlank() || newEmail.isBlank()) {
                                errorMessage = "Please enter name and email."
                                return@Button
                            }
                            isCreating = true
                            errorMessage = null
                            coroutineScope.launch {
                                val req = CreateAccountRequest(
                                    name = newName,
                                    email = newEmail,
                                    role = newRole,
                                    staffNumber = staffNo,
                                    tscNumber = tscNo
                                )
                                val res = repo.createAccount(req)
                                isCreating = false
                                res.fold(
                                    onSuccess = { created ->
                                        createdResultPassword = created.temporaryPassword
                                        showCreateDialog = false
                                        newName = ""
                                        newEmail = ""
                                        loadAccounts()
                                    },
                                    onFailure = { errorMessage = it.message }
                                )
                            }
                        },
                        enabled = !isCreating,
                        colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                        modifier = Modifier.testTag("submit_create_account_button")
                    ) {
                        Text("Provision Account")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showCreateDialog = false }) { Text("Cancel") }
                }
            )
        }
    }
}
