package com.example.ui.screens.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.example.MaryRoyalApp
import com.example.ui.common.SchoolCrestHeader
import com.example.ui.theme.RoyalBlue
import kotlinx.coroutines.launch

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.ui.text.input.VisualTransformation

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChangePasswordScreen(
    onPasswordChanged: () -> Unit
) {
    val authRepo = MaryRoyalApp.instance.authRepository
    val coroutineScope = rememberCoroutineScope()

    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var showCurrentPassword by remember { mutableStateOf(true) }
    var showNewPassword by remember { mutableStateOf(true) }
    var showConfirmPassword by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            SchoolCrestHeader(title = "Change Password", subtitle = "Secure Your Mary Royal Account")
        }
    ) { padding ->
        val scrollState = rememberScrollState()
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(scrollState)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Shield,
                contentDescription = null,
                tint = RoyalBlue,
                modifier = Modifier.size(56.dp)
            )

            Text(
                text = "Password Update Required",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
            )

            Text(
                text = "For security reasons, temporary or initial credentials must be updated before proceeding into the school management portal.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (errorMessage != null) {
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = errorMessage ?: "",
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            OutlinedTextField(
                value = currentPassword,
                onValueChange = { currentPassword = it; errorMessage = null },
                label = { Text("Current or Temporary Password") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = RoyalBlue) },
                trailingIcon = {
                    IconButton(onClick = { showCurrentPassword = !showCurrentPassword }) {
                        Icon(
                            imageVector = if (showCurrentPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = if (showCurrentPassword) "Hide password" else "Show password"
                        )
                    }
                },
                visualTransformation = if (showCurrentPassword) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("current_password_input")
            )

            OutlinedTextField(
                value = newPassword,
                onValueChange = { newPassword = it; errorMessage = null },
                label = { Text("New Password (min 8 chars)") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = RoyalBlue) },
                trailingIcon = {
                    IconButton(onClick = { showNewPassword = !showNewPassword }) {
                        Icon(
                            imageVector = if (showNewPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = if (showNewPassword) "Hide password" else "Show password"
                        )
                    }
                },
                visualTransformation = if (showNewPassword) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("new_password_input")
            )

            OutlinedTextField(
                value = confirmPassword,
                onValueChange = { confirmPassword = it; errorMessage = null },
                label = { Text("Confirm New Password") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = RoyalBlue) },
                trailingIcon = {
                    IconButton(onClick = { showConfirmPassword = !showConfirmPassword }) {
                        Icon(
                            imageVector = if (showConfirmPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = if (showConfirmPassword) "Hide password" else "Show password"
                        )
                    }
                },
                visualTransformation = if (showConfirmPassword) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("confirm_password_input")
            )

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = {
                    if (currentPassword.isBlank()) {
                        errorMessage = "Please enter your current password."
                        return@Button
                    }
                    if (newPassword.length < 8) {
                        errorMessage = "New password must be at least 8 characters long."
                        return@Button
                    }
                    if (newPassword != confirmPassword) {
                        errorMessage = "Passwords do not match."
                        return@Button
                    }
                    isSubmitting = true
                    coroutineScope.launch {
                        val result = authRepo.changePassword(currentPassword, newPassword)
                        isSubmitting = false
                        result.fold(
                            onSuccess = { onPasswordChanged() },
                            onFailure = { errorMessage = it.message }
                        )
                    }
                },
                enabled = !isSubmitting,
                colors = ButtonDefaults.buttonColors(containerColor = RoyalBlue),
                modifier = Modifier.fillMaxWidth().height(50.dp).testTag("change_password_submit")
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(24.dp))
                } else {
                    Text("Update Password & Continue", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
